import { describe, expect, it } from 'vitest';
import { pressesDefaultButton, type KeyPress, type KeyTarget } from './dialog-enter';

describe('pressesDefaultButton', () => {
  it('confirms from the dialog itself and from its text', () => {
    expect(pressesDefaultButton(press(), target('DIV', 'dialog'))).toBe(true);
    expect(pressesDefaultButton(press(), target('P'))).toBe(true);
  });

  it('leaves Enter to buttons, links, and single-line fields', () => {
    for (const tag of ['BUTTON', 'A', 'INPUT', 'SELECT']) {
      expect(pressesDefaultButton(press(), target(tag))).toBe(false);
    }
    expect(pressesDefaultButton(press(), target('DIV', 'button'))).toBe(false);
    expect(pressesDefaultButton(press(), target('BUTTON', 'combobox'))).toBe(false);
  });

  it('keeps plain Enter for a new line in a text area; Cmd or Ctrl+Enter submits', () => {
    expect(pressesDefaultButton(press(), target('TEXTAREA'))).toBe(false);
    expect(pressesDefaultButton(press({ metaKey: true }), target('TEXTAREA'))).toBe(true);
    expect(pressesDefaultButton(press({ ctrlKey: true }), target('TEXTAREA'))).toBe(true);
  });

  it('submits from a check box that cancels its own Enter, as a native one does', () => {
    expect(pressesDefaultButton(press({ defaultPrevented: true }), target('BUTTON', 'checkbox'))).toBe(true);
    expect(pressesDefaultButton(press(), target('BUTTON', 'radio'))).toBe(false);
  });

  it('never submits on a held key, an IME candidate, another key, or a modifier', () => {
    const dialog = target('DIV', 'dialog');
    expect(pressesDefaultButton(press({ repeat: true }), dialog)).toBe(false);
    expect(pressesDefaultButton(press({ isComposing: true }), dialog)).toBe(false);
    expect(pressesDefaultButton(press({ key: ' ' }), dialog)).toBe(false);
    expect(pressesDefaultButton(press({ shiftKey: true }), dialog)).toBe(false);
    expect(pressesDefaultButton(press({ altKey: true }), dialog)).toBe(false);
    expect(pressesDefaultButton(press({ metaKey: true }), dialog)).toBe(false);
  });

  it('leaves an Enter that something inside already handled', () => {
    expect(pressesDefaultButton(press({ defaultPrevented: true }), target('DIV', 'dialog'))).toBe(false);
    expect(pressesDefaultButton(press({ ctrlKey: true, defaultPrevented: true }), target('TEXTAREA'))).toBe(false);
    expect(pressesDefaultButton(press(), { ...target('DIV'), isContentEditable: true })).toBe(false);
  });
});

function press(overrides: Partial<KeyPress> = {}): KeyPress {
  return {
    key: 'Enter',
    repeat: false,
    isComposing: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    ...overrides,
  };
}

function target(tagName: string, role: string | null = null): KeyTarget {
  return { tagName, isContentEditable: false, getAttribute: () => role };
}
