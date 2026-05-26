// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SessionDropdown } from './sessionDropdown';
import { installObsidianDomHelpers } from '../test/domHelpers';
import { setLocale } from '../i18n/index';

installObsidianDomHelpers();

describe('SessionDropdown', () => {
  let container: HTMLDivElement;
  let anchor: HTMLButtonElement;
  let sessionStore: {
    list: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let callbacks: {
    onSwitch: ReturnType<typeof vi.fn>;
    onDelete: ReturnType<typeof vi.fn>;
    onNewSession: ReturnType<typeof vi.fn>;
  };
  let dropdown: SessionDropdown;

  beforeEach(() => {
    setLocale('en');
    container = document.createElement('div');
    anchor = document.createElement('button');
    document.body.appendChild(container);
    document.body.appendChild(anchor);

    sessionStore = {
      list: vi.fn().mockReturnValue([
        { sessionId: 'session-1', title: 'Chat 1' },
        { sessionId: 'session-2', title: 'Chat 2' },
        { sessionId: 'session-3', title: 'Chat 3' },
      ]),
      remove: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };

    callbacks = {
      onSwitch: vi.fn().mockResolvedValue(undefined),
      onDelete: vi.fn().mockResolvedValue(undefined),
      onNewSession: vi.fn().mockResolvedValue(undefined),
    };

    dropdown = new SessionDropdown(
      container,
      anchor,
      sessionStore as any,
      () => 'session-1',
      callbacks as any,
    );
  });

  describe('open', () => {
    it('creates dropdown element', () => {
      dropdown.open();
      const dropdownEl = container.querySelector('.copsidian-session-list');
      expect(dropdownEl).not.toBeNull();
    });

    it('creates search input', () => {
      dropdown.open();
      const search = container.querySelector('.copsidian-session-search') as HTMLInputElement;
      expect(search).not.toBeNull();
      expect(search.placeholder).toBe('Search sessions…');
    });

    it('renders all sessions', () => {
      dropdown.open();
      const items = container.querySelectorAll('.copsidian-session-item');
      expect(items.length).toBe(3);
    });

    it('marks current session as active', () => {
      dropdown.open();
      const activeItem = container.querySelector('.copsidian-session-item.active');
      expect(activeItem).not.toBeNull();
      expect(activeItem?.querySelector('.session-label')?.textContent).toBe('Chat 1');
    });

    it('shows empty message when no sessions', () => {
      sessionStore.list.mockReturnValue([]);
      dropdown.open();
      const empty = container.querySelector('.copsidian-session-empty');
      expect(empty).not.toBeNull();
      expect(empty?.textContent).toBe('No sessions found');
    });

    it('closes if already open', () => {
      dropdown.open();
      dropdown.open();
      const items = container.querySelectorAll('.copsidian-session-list');
      expect(items.length).toBe(0);
    });
  });

  describe('close', () => {
    it('removes dropdown element', () => {
      dropdown.open();
      dropdown.close();
      const dropdownEl = container.querySelector('.copsidian-session-list');
      expect(dropdownEl).toBeNull();
    });

    it('does nothing if not open', () => {
      dropdown.close();
      // Should not throw
    });
  });

  describe('isOpen', () => {
    it('returns false initially', () => {
      expect(dropdown.isOpen()).toBe(false);
    });

    it('returns true after open', () => {
      dropdown.open();
      expect(dropdown.isOpen()).toBe(true);
    });

    it('returns false after close', () => {
      dropdown.open();
      dropdown.close();
      expect(dropdown.isOpen()).toBe(false);
    });
  });

  describe('session interactions', () => {
    it('calls onSwitch when clicking a session', async () => {
      dropdown.open();
      const items = container.querySelectorAll('.copsidian-session-item');
      (items[1] as HTMLElement).click();
      await new Promise(r => setTimeout(r, 10));
      expect(callbacks.onSwitch).toHaveBeenCalledWith('session-2');
    });

    it('calls onNewSession when deleting current session', async () => {
      dropdown.open();
      const deleteBtn = container.querySelector('.copsidian-session-item.active .session-delete') as HTMLElement;
      deleteBtn.click();
      await new Promise(r => setTimeout(r, 10));
      expect(sessionStore.remove).toHaveBeenCalledWith('session-1');
      expect(sessionStore.save).toHaveBeenCalled();
      expect(callbacks.onNewSession).toHaveBeenCalled();
    });

    it('does not call onNewSession when deleting non-current session', async () => {
      dropdown.open();
      const items = container.querySelectorAll('.copsidian-session-item');
      const deleteBtn = items[1].querySelector('.session-delete') as HTMLElement;
      deleteBtn.click();
      await new Promise(r => setTimeout(r, 10));
      expect(sessionStore.remove).toHaveBeenCalledWith('session-2');
      expect(callbacks.onNewSession).not.toHaveBeenCalled();
    });
  });

  describe('search filtering', () => {
    it('filters sessions by title', () => {
      dropdown.open();
      const search = container.querySelector('.copsidian-session-search') as HTMLInputElement;
      search.value = 'Chat 2';
      search.dispatchEvent(new Event('input'));
      const items = container.querySelectorAll('.copsidian-session-item');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.session-label')?.textContent).toBe('Chat 2');
    });

    it('shows empty message when no matches', () => {
      dropdown.open();
      const search = container.querySelector('.copsidian-session-search') as HTMLInputElement;
      search.value = 'nonexistent';
      search.dispatchEvent(new Event('input'));
      const empty = container.querySelector('.copsidian-session-empty');
      expect(empty).not.toBeNull();
    });

    it('shows all sessions when search is cleared', () => {
      dropdown.open();
      const search = container.querySelector('.copsidian-session-search') as HTMLInputElement;
      search.value = 'Chat 2';
      search.dispatchEvent(new Event('input'));
      search.value = '';
      search.dispatchEvent(new Event('input'));
      const items = container.querySelectorAll('.copsidian-session-item');
      expect(items.length).toBe(3);
    });
  });

  describe('destroy', () => {
    it('closes dropdown', () => {
      dropdown.open();
      dropdown.destroy();
      expect(dropdown.isOpen()).toBe(false);
    });
  });
});
