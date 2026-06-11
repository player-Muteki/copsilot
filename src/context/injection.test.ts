import { describe, expect, it } from 'vitest';
import { ContextInjection } from './injection';
import type { App } from 'obsidian';

describe('ContextInjection', () => {
  describe('systemPrompt', () => {
    it('includes base identity and user instructions', () => {
      const prompt = ContextInjection.systemPrompt('User instructions.', 'Custom agent instructions.');
      expect(prompt).toContain('You are Copsilot');
      expect(prompt).toContain('User instructions.');
      expect(prompt).toContain('Custom agent instructions.');
    });

    it('includes plugin names when provided', () => {
      const prompt = ContextInjection.systemPrompt('', '', '', ['Dataview', 'Calendar']);
      expect(prompt).toContain('## Enabled Plugins');
      expect(prompt).toContain('Dataview, Calendar');
    });

    it('includes workflow hints when provided', () => {
      const prompt = ContextInjection.systemPrompt('', '', '', [], '- Daily notes folder found');
      expect(prompt).toContain('Daily notes folder found');
    });

    it('preserves default when custom agent prompt is empty', () => {
      const prompt = ContextInjection.systemPrompt('', '');
      expect(prompt).toContain('You are Copsilot');
      expect(prompt).not.toContain('Custom agent:');
    });
  });

  describe('detectPluginsRaw', () => {
    it('returns empty array when app has no plugins', () => {
      const app = { plugins: {} } as unknown as App;
      expect(ContextInjection.detectPluginsRaw(app)).toEqual([]);
    });

    it('detects all plugins using manifest.name or id fallback', () => {
      const app = {
        plugins: {
          plugins: {
            'dataview': { manifest: { name: 'Dataview' } },
            'calendar': { manifest: { name: 'Calendar' } },
            'unknown-plugin': {},
          },
        },
      } as unknown as App;
      expect(ContextInjection.detectPluginsRaw(app)).toEqual(['Calendar', 'Dataview', 'Unknown']);
    });

    it('handles null app gracefully', () => {
      expect(ContextInjection.detectPluginsRaw(null as unknown as App)).toEqual([]);
    });
  });

  describe('vaultContext', () => {
    it('includes vault name and plugin names', () => {
      const app = {
        vault: { getName: () => 'Test' },
        plugins: { plugins: { dataview: {} } },
      } as unknown as App;
      const ctx = ContextInjection.vaultContext(app);
      expect(ctx).toContain('Vault: Test');
      expect(ctx).toContain('Dataview');
    });
  });
});
