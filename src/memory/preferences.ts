import type { UserPreferences } from '../types';

export class UserPreferenceStore {
  private prefs: UserPreferences;

  constructor(
    loadPrefs: () => UserPreferences,
    private savePrefs: (p: UserPreferences) => void,
  ) {
    this.prefs = loadPrefs();
  }

  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] | undefined {
    return this.prefs[key];
  }

  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.prefs = { ...this.prefs, [key]: value };
    this.savePrefs(this.prefs);
  }

  inferFromMessage(text: string): void {
    if (text.length > 200 && /\b(therefore|however|consequently|furthermore|moreover)\b/i.test(text)) {
      this.set('writingStyle', 'academic');
    } else if (text.length > 100) {
      this.set('writingStyle', 'detailed');
    } else {
      this.set('writingStyle', 'concise');
    }
    const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) ?? []).length;
    this.set('useEmojis', emojiCount > 2);
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
    if (this.prefs.useEmojis === false) {
      parts.push('User prefers minimal emoji use.');
    }
    return parts.length > 0 ? `[Learned preferences: ${parts.join(' ')}]` : '';
  }
}
