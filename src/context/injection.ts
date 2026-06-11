import type { App, Vault } from 'obsidian';
import { MarkdownView, TFile, TFolder } from 'obsidian';

const BASE_IDENTITY =
  'You are Copsilot, an AI assistant living inside the user\'s Obsidian vault. ' +
  'You treat notes as interconnected thoughts in a personal knowledge graph. ' +
  'You understand bi-directional linking, graph view, backlinks, tags, daily notes, and templates. ' +
  'You notice patterns across notes and suggest connections the user may have missed. ' +
  'You are built on OpenCode but your identity is your own. ' +
  'Speak naturally and concisely as Copsilot.';

/** Convert a plugin ID like "obsidian-tasks-plugin" or "quickadd" to a readable display name. */
function idToDisplayName(id: string): string {
  return id
    .replace(/^obsidian-/, '')
    .replace(/-plugin$/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Build the full agent identity, combining base identity, plugin list, and workflow observations. */
function buildIdentity(pluginNames: string[], workflowBlock: string): string {
  const parts = [BASE_IDENTITY];
  if (pluginNames.length > 0) {
    parts.push(`## Enabled Plugins\n${pluginNames.join(', ')}.`);
  }
  if (workflowBlock) parts.push(workflowBlock);
  return parts.join('\n\n');
}

export class ContextInjection {
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
    vaultContextString = '',
    pluginNames: string[] = [],
    workflowHints = '',
  ): string {
    const identity = buildIdentity(pluginNames, workflowHints);
    const parts = [identity];
    if (vaultContextString.trim()) parts.push(vaultContextString.trim());
    if (instructions.trim()) parts.push(instructions.trim());
    if (customAgentPrompt.trim()) parts.push(customAgentPrompt.trim());
    return parts.join('\n\n');
  }

  /** Detect enabled plugins and return display names. Accepts optional App. */
  static detectPluginsRaw(app?: App): string[] {
    const target = app ?? (typeof (globalThis as Record<string, unknown>).app !== 'undefined'
      ? (globalThis as Record<string, unknown>).app as App : undefined);
    if (!target) return [];
    try {
      const appAny = target as unknown as Record<string, unknown>;
      const pluginsObj = appAny.plugins as Record<string, unknown> | undefined;
      if (!pluginsObj) return [];
      const pluginMap = pluginsObj.plugins as Record<string, { manifest?: { name?: string } }> | undefined;
      if (!pluginMap) return [];
      const names: string[] = [];
      for (const id of Object.keys(pluginMap)) {
        const plugin = pluginMap[id];
        const name = plugin?.manifest?.name ?? idToDisplayName(id);
        names.push(name);
      }
      return names.sort();
    } catch {
      return [];
    }
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
    const detected = ContextInjection.detectPluginsRaw(app);
    if (detected.length > 0) {
      lines.push(`Plugins: ${detected.join(', ')}`);
    }
    return lines.join('\n');
  }

  /** Scan vault structure and return workflow observations for the agent. */
  static async workflowHints(vault: Vault): Promise<string> {
    const hints: string[] = ['## Workflow Observations'];

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
