import type { UserPreferences } from '../types';

const EMOJI_PATTERN = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{FE00}-\u{FEFF}]|[\u{200D}]/gu;

interface PreferenceHistory {
  styleCounts: Record<string, number>;
  totalMessages: number;
  emojiMessages: number;
  topicCandidates: Record<string, number>;
  totalLength: number;
}

export class UserPreferenceStore {
  private prefs: UserPreferences;
  private history: PreferenceHistory;

  constructor(
    loadPrefs: () => UserPreferences,
    private savePrefs: (p: UserPreferences) => void,
  ) {
    this.prefs = loadPrefs();
    this.history = this.prefs._history ?? {
      styleCounts: {},
      totalMessages: 0,
      emojiMessages: 0,
      topicCandidates: {},
      totalLength: 0,
    };
  }

  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] | undefined {
    return this.prefs[key];
  }

  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.prefs = { ...this.prefs, [key]: value };
    this.flush();
  }

  inferFromMessage(text: string): void {
    this.history.totalMessages++;
    this.history.totalLength += text.length;

    const style = this.inferStyle(text);
    this.history.styleCounts[style] = (this.history.styleCounts[style] ?? 0) + 1;

    const emojiCount = (text.match(EMOJI_PATTERN) ?? []).length;
    if (emojiCount > 0) this.history.emojiMessages++;

    // Track unique meaningful words per message as topic candidates
    const words = text.toLowerCase().split(/[\s,.;!?()]+/).filter((w) => w.length > 3);
    const uniqueWords = new Set(words);
    for (const word of uniqueWords) {
      this.history.topicCandidates[word] = (this.history.topicCandidates[word] ?? 0) + 1;
    }

    this.consolidate();
  }

  private inferStyle(text: string): string {
    const academicWords = /\b(therefore|however|consequently|furthermore|moreover|nevertheless|accordingly|thus|hence)\b/i;
    if (text.length > 200 && academicWords.test(text)) return 'academic';
    if (text.length > 100) return 'detailed';
    return 'concise';
  }

  private consolidate(): void {
    const { totalMessages, emojiMessages, styleCounts, topicCandidates, totalLength } = this.history;
    if (totalMessages === 0) return;

    // Pick majority writing style
    const bestStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'concise';
    this.prefs.writingStyle = bestStyle as UserPreferences['writingStyle'];

    // Emoji usage: >30% of messages have emoji
    this.prefs.useEmojis = emojiMessages / totalMessages > 0.3;

    // Preferred response length based on average
    const avgLen = totalLength / totalMessages;
    this.prefs.preferredResponseLength = avgLen > 200 ? 'long' : avgLen > 80 ? 'medium' : 'short';

    // Common topics (appeared in >= 10% of messages)
    const threshold = Math.max(2, Math.floor(totalMessages * 0.1));
    this.prefs.commonTopics = Object.entries(topicCandidates)
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Persist history alongside preferences
    this.prefs._history = this.history;
    this.savePrefs(this.prefs);
  }

  private flush(): void {
    this.prefs._history = this.history;
    this.savePrefs(this.prefs);
  }

  toPromptFragment(): string {
    const parts: string[] = [];

    if (this.prefs.writingStyle === 'academic') {
      parts.push('User prefers academic, analytical responses.');
    } else if (this.prefs.writingStyle === 'detailed') {
      parts.push('User prefers detailed, thorough responses.');
    } else if (this.prefs.writingStyle === 'concise') {
      parts.push('User prefers concise, direct responses.');
    }

    if (this.prefs.preferredResponseLength === 'long') {
      parts.push('User tends to write long messages — detailed answers are appropriate.');
    } else if (this.prefs.preferredResponseLength === 'short') {
      parts.push('User tends to write short messages — keep answers brief.');
    }

    if (this.prefs.useEmojis === false) {
      parts.push('User prefers minimal emoji use.');
    } else if (this.prefs.useEmojis === true) {
      parts.push('User is comfortable with emoji in responses.');
    }

    if (this.prefs.commonTopics && this.prefs.commonTopics.length > 0) {
      parts.push(`Frequent topics: ${this.prefs.commonTopics.slice(0, 5).join(', ')}.`);
    }

    return parts.length > 0 ? `[Learned preferences: ${parts.join(' ')}]` : '';
  }
}
