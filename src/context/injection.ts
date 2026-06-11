import type { App, Vault } from 'obsidian';
import { MarkdownView, TFile, TFolder } from 'obsidian';

const IDENTITY_CONCISE =
  'You are Copsilot, an AI assistant living inside the user\'s Obsidian vault. ' +
  'You treat notes as interconnected thoughts in a personal knowledge graph. ' +
  'You understand bi-directional linking, graph view, backlinks, tags, daily notes, and templates. ' +
  'You notice patterns across notes and suggest connections the user may have missed. ' +
  'You are built on OpenCode but your identity is your own. ' +
  'Speak naturally and concisely as Copsilot.';

const IDENTITY_DETAILED =
  'You are Copsilot, an AI partner living inside the user\'s Obsidian vault. ' +
  'You think of notes not as files but as atoms of thought — interconnected ideas forming a ' +
  'personal knowledge graph. You deeply understand the philosophy of bi-directional linking: ' +
  'every connection is a relationship waiting to be explored.\n\n' +
  'Your user works in Obsidian, a tool for networked thought. They may use daily notes, ' +
  'templates, tags, Dataview queries, and plugins. You understand the graph view, backlinks, ' +
  'outgoing links, and the value of progressive summarization.\n\n' +
  'You have genuine curiosity about the user\'s knowledge base. You notice patterns across notes, ' +
  'suggest connections the user might have missed, and help them surface insights from their ' +
  'own writing. When you see a note about a topic, you notice when it connects to other notes.\n\n' +
  'Speak naturally as Copsilot — concise, insightful, occasionally opinionated. ' +
  'You are built on OpenCode but your personality is your own: a thinking partner, not just a tool.';

const IDENTITY_ACADEMIC =
  'You are Copsilot, a research partner embedded in the user\'s Obsidian knowledge base. ' +
  'You analyze the interconnected structure of their notes as a semantic network. ' +
  'You are proficient in knowledge management methodologies including Zettelkasten, ' +
  'Progressive Summarization, and PARA. You assist with literature review, ' +
  'cross-referencing, and synthesis of ideas across disparate notes.\n\n' +
  'You communicate with analytical precision. You cite specific notes and connections ' +
  'when making observations. You prioritize accuracy and depth over brevity.';

const IDENTITY_CASUAL =
  'Hey, I\'m Copsilot — your AI buddy living inside your Obsidian vault! ' +
  'I get that you use Obsidian to think and organize your ideas, and I\'m here to help ' +
  'you make sense of it all. I know about bi-directional links, tags, daily notes, ' +
  'and all the cool Obsidian stuff.\n\n' +
  'I\'ll notice connections between your notes and point them out. ' +
  'Feel free to ask me anything about your knowledge base! ' +
  'I keep it friendly and straightforward.';

const TONES: Record<string, string> = {
  concise: IDENTITY_CONCISE,
  detailed: IDENTITY_DETAILED,
  academic: IDENTITY_ACADEMIC,
  casual: IDENTITY_CASUAL,
};

export type IdentityTone = keyof typeof TONES;

export class ContextInjection {
  static getIdentity(tone: IdentityTone = 'concise'): string {
    return TONES[tone] ?? TONES.concise;
  }

  static build(resolved: Array<{ name: string; content: string }>): string {
    if (resolved.length === 0) return '';
    const blocks = resolved.map(
      (r) => `=== NOTE: [[${r.name}]] ===\n${r.content}\n=== END NOTE ===`,
    );
    return (
      'The user has referenced the following Obsidian notes in their message.\n' +
      'You should consider their content as relevant context for your response:\n\n' +
      blocks.join('\n\n')
    );
  }

  static systemPrompt(
    instructions: string,
    customAgentPrompt = '',
    vaultContext = '',
    tone: IdentityTone = 'concise',
  ): string {
    const parts = [ContextInjection.getIdentity(tone)];
    if (vaultContext.trim()) parts.push(vaultContext.trim());
    if (instructions.trim()) parts.push(instructions.trim());
    if (customAgentPrompt.trim()) parts.push(customAgentPrompt.trim());
    return parts.join('\n\n');
  }

  static vaultContext(app: App): string {
    const lines: string[] = ['## Vault Context'];
    try {
      const vault = app.vault;
      const vaultName = vault.getName ? vault.getName() : 'unknown';
      lines.push(`Vault: ${vaultName}`);
    } catch {
      lines.push('Vault: unknown');
    }
    try {
      const appAny = app as unknown as Record<string, unknown>;
      const pluginsObj = appAny.plugins as Record<string, unknown> | undefined;
      const detected: string[] = [];
      if (pluginsObj) {
        const pluginMap = pluginsObj.plugins as Record<string, unknown> | undefined;
        if (pluginMap) {
          if (pluginMap['dataview']) detected.push('Dataview');
          if (pluginMap['obsidian-tasks-plugin']) detected.push('Tasks');
          if (pluginMap['calendar']) detected.push('Calendar');
          if (pluginMap['templater-obsidian']) detected.push('Templater');
          if (pluginMap['obsidian-kanban']) detected.push('Kanban');
        }
      }
      if (detected.length > 0) {
        lines.push(`Plugins: ${detected.join(', ')}`);
      }
    } catch {
      // plugin detection is best-effort
    }
    return lines.join('\n');
  }

  /** Scan vault structure and return workflow observations for the agent. */
  static async workflowHints(vault: Vault): Promise<string> {
    const hints: string[] = ['## Workflow Observations'];

    // Check for daily notes
    for (const folderName of ['Daily', 'daily', 'Journal', 'journal', '日记']) {
      const folder = vault.getFolderByPath ? vault.getFolderByPath(folderName) : null;
      if (folder instanceof TFolder) {
        const fileCount = folder.children.filter((c): c is TFile => c instanceof TFile).length;
        if (fileCount > 0) {
          hints.push(`- Daily notes folder "${folderName}" found (${fileCount} notes). Maintains a chronological journal practice.`);
        }
        break;
      }
    }

    // Check for templates
    for (const folderName of ['Templates', 'templates', '模板']) {
      const folder = vault.getFolderByPath ? vault.getFolderByPath(folderName) : null;
      if (folder instanceof TFolder) {
        const fileCount = folder.children.filter((c): c is TFile => c instanceof TFile).length;
        if (fileCount > 0) {
          hints.push(`- Template folder "${folderName}" found (${fileCount} templates). User may want template-based note creation.`);
        }
        break;
      }
    }

    // Check for Projects folder
    for (const folderName of ['Projects', 'projects', '项目']) {
      const folder = vault.getFolderByPath ? vault.getFolderByPath(folderName) : null;
      if (folder instanceof TFolder) {
        hints.push(`- Projects folder "${folderName}" found. Organizes work by project.`);
        break;
      }
    }

    return hints.length > 1 ? hints.join('\n') : '';
  }

  /** Detect what section or context the user's cursor is in. */
  static activeSectionContext(app: App): string {
    try {
      const activeView = app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) return '';
      const editor = activeView.editor;
      const cursor = editor.getCursor();
      const content = editor.getValue();
      const lines = content.split('\n');
      const maxCheck = Math.min(cursor.line, 50);

      let currentHeading = '';
      for (let i = cursor.line; i >= Math.max(0, cursor.line - maxCheck); i--) {
        const headingMatch = lines[i]?.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
          currentHeading = headingMatch[0].trim();
          break;
        }
      }

      const currentLine = lines[cursor.line] ?? '';
      const context: string[] = [];
      if (currentHeading) context.push(`under "${currentHeading}"`);
      if (/^\s*- \[.\]/.test(currentLine)) context.push('inside a task list');
      else if (/^\s*- /.test(currentLine)) context.push('inside a bullet list');
      else if (/^\s*>\s/.test(currentLine)) context.push('inside a blockquote');
      else if (/^\s*\|/.test(currentLine)) context.push('inside a table');
      else if (/^\s*```/.test(currentLine)) context.push('inside a code block');
      else if (/^#{1,6}\s/.test(currentLine)) context.push('at a heading');

      if (context.length === 0) return '';
      return `[Active note context: ${context.join('; ')}]`;
    } catch {
      return '';
    }
  }

  static injectWikilinks(text: string, vault: { getAbstractFileByPath: (path: string) => unknown }): string {
    return text.replace(/`([^`]+)`/g, (match: string, code: string) => {
      if (!code.includes('/') && !code.includes('\\')) return match;
      const abstract: unknown = vault.getAbstractFileByPath(code);
      if (abstract && typeof abstract === 'object' && 'basename' in abstract) {
        const file = abstract as { basename: string };
        const basename = file.basename ?? code;
        return `[[${code}|${basename}]]`;
      }
      return match;
    });
  }
}
