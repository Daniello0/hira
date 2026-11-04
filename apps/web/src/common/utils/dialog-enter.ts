/** The parts of a key press that decide it. A DOM `KeyboardEvent` fits. */
export type KeyPress = Pick<KeyboardEvent, 'key' | 'repeat' | 'isComposing' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey' | 'defaultPrevented'>;

/** The focused element. A DOM element fits. */
export type KeyTarget = Pick<HTMLElement, 'tagName' | 'isContentEditable' | 'getAttribute'>;

/** Controls with their own Enter: a button presses, a link opens, a single-line field submits its form natively. */
const OWN_ENTER_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'SUMMARY']);
const OWN_ENTER_ROLES = new Set(['button', 'combobox', 'link', 'menuitem', 'option', 'switch', 'tab', 'textbox']);

/** Enter on a native check box or radio submits the form; a custom one that cancels its own Enter does the same. */
const SUBMIT_ROLES = new Set(['checkbox', 'radio']);

/**
 * True when Enter in a dialog should press its default button, as Enter in a field does:
 * on the dialog itself or its text, and Cmd or Ctrl+Enter in a text area, where plain Enter starts a new line.
 * A held key and an IME candidate never submit.
 */
export function pressesDefaultButton(press: KeyPress, target: KeyTarget): boolean {
  if (press.key !== 'Enter' || press.repeat || press.isComposing || press.shiftKey || press.altKey) return false;
  const command = press.ctrlKey || press.metaKey;
  if (target.tagName === 'TEXTAREA') return command && !press.defaultPrevented;
  const role = target.getAttribute('role') ?? '';
  if (SUBMIT_ROLES.has(role)) return !command && press.defaultPrevented;
  if (command || press.defaultPrevented || target.isContentEditable) return false;
  return !OWN_ENTER_TAGS.has(target.tagName) && !OWN_ENTER_ROLES.has(role);
}
