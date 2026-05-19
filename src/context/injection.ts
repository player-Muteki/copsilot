/** Build context injection text from resolved notes */
export class ContextInjection {
  private static readonly IDENTITY =
    'You are Copsidian, an AI knowledge assistant for Obsidian powered by the OpenCode agent. ' +
    'You help users explore, understand, and build upon their Obsidian vault. ' +
    'When asked who you are, always identify yourself as Copsidian, not as OpenCode or any underlying model.';

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

  static systemPrompt(instructions: string): string {
    const parts = [ContextInjection.IDENTITY];
    if (instructions.trim()) parts.push(instructions.trim());
    return parts.join('\n\n');
  }

  static injectWikilinks(text: string, vault: { getAbstractFileByPath: (path: string) => unknown }): string {
    return text.replace(/`([^`]+)`/g, (match, code) => {
      if (!code.includes('/') && !code.includes('\\')) return match;
      const abstract = vault.getAbstractFileByPath(code);
      if (abstract) {
        const basename = (abstract as { basename?: string }).basename ?? code;
        return `[[${code}|${basename}]]`;
      }
      return match;
    });
  }
}
