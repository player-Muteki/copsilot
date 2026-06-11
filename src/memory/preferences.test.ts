import { describe, expect, it, vi } from 'vitest';
import { UserPreferenceStore } from './preferences';
import type { UserPreferences } from '../types';

function createStore(prefs: Partial<UserPreferences> = {}) {
  const save = vi.fn();
  const store = new UserPreferenceStore(
    () => prefs as UserPreferences,
    save,
  );
  return { store, save };
}

describe('UserPreferenceStore', () => {
  describe('inferFromMessage', () => {
    it('infers concise style from short messages', () => {
      const { store } = createStore();
      store.inferFromMessage('Hello');
      expect(store.get('writingStyle')).toBe('concise');
    });

    it('infers detailed style from medium messages', () => {
      const { store } = createStore();
      store.inferFromMessage('A'.repeat(120));
      expect(store.get('writingStyle')).toBe('detailed');
    });

    it('infers academic style from long messages with academic words', () => {
      const { store } = createStore();
      store.inferFromMessage('A'.repeat(150) + ' therefore we must consider however the implications');
      expect(store.get('writingStyle')).toBe('academic');
    });

    it('accumulates style across messages (majority wins)', () => {
      const { store } = createStore();
      store.inferFromMessage('short');                    // concise
      store.inferFromMessage('A'.repeat(120));             // detailed
      store.inferFromMessage('A'.repeat(120));             // detailed (majority)
      expect(store.get('writingStyle')).toBe('detailed');
    });

    it('detects emoji usage across messages', () => {
      const { store } = createStore();
      store.inferFromMessage('hello 😊 world 🌟');
      store.inferFromMessage('another 🙂 message');
      expect(store.get('useEmojis')).toBe(true);
    });

    it('sets useEmojis false when emoji ratio is below threshold', () => {
      const { store } = createStore();
      store.inferFromMessage('hello world');
      store.inferFromMessage('good day');
      store.inferFromMessage('hi there');
      store.inferFromMessage('hello 😊');
      expect(store.get('useEmojis')).toBe(false); // 1/4 = 0.25 < 0.3
    });

    it('extracts common topics from repeated words', () => {
      const { store } = createStore();
      store.inferFromMessage('typescript typescript typescript types are great');
      store.inferFromMessage('more typescript configuration');
      const topics = store.get('commonTopics');
      expect(topics).toContain('typescript');
    });

    it('sets preferredResponseLength based on average message length', () => {
      const { store } = createStore();
      store.inferFromMessage('A'.repeat(50));
      store.inferFromMessage('B'.repeat(50));
      expect(store.get('preferredResponseLength')).toBe('short');
    });

    it('sets preferredResponseLength to medium for moderate messages', () => {
      const { store } = createStore();
      store.inferFromMessage('A'.repeat(100));
      expect(store.get('preferredResponseLength')).toBe('medium');
    });
  });

  describe('toPromptFragment', () => {
    it('returns empty string when no preferences set', () => {
      const { store } = createStore();
      expect(store.toPromptFragment()).toBe('');
    });

    it('includes writing style hint', () => {
      const { store } = createStore();
      store.inferFromMessage('A'.repeat(120));
      const fragment = store.toPromptFragment();
      expect(fragment).toContain('[Learned preferences:');
      expect(fragment).toContain('detailed');
    });

    it('includes emoji preference', () => {
      const { store } = createStore();
      store.inferFromMessage('hello 😊 world 🌟 test 🙂');
      const fragment = store.toPromptFragment();
      expect(fragment).toContain('emoji');
    });

    it('includes common topics', () => {
      const { store } = createStore();
      store.inferFromMessage('testing typescript typescript typescript code');
      store.inferFromMessage('more typescript stuff');
      const fragment = store.toPromptFragment();
      expect(fragment).toContain('Frequent topics:');
    });

    it('excludes emoji suppression when useEmojis is true', () => {
      const { store } = createStore({ useEmojis: true });
      const fragment = store.toPromptFragment();
      expect(fragment).not.toContain('minimal emoji');
    });
  });

  describe('get/set', () => {
    it('returns undefined for unset key', () => {
      const { store } = createStore();
      expect(store.get('writingStyle')).toBeUndefined();
    });

    it('stores and retrieves a value', () => {
      const { store } = createStore();
      store.set('writingStyle', 'concise');
      expect(store.get('writingStyle')).toBe('concise');
    });

    it('calls savePrefs on set', () => {
      const { store, save } = createStore();
      store.set('writingStyle', 'academic');
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ writingStyle: 'academic' }));
    });
  });
});
