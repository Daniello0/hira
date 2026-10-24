'use client';

import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog keyboard contract: focus moves inside on open, Tab cycles inside,
 * Escape closes, and focus returns to the opener on close.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): (event: ReactKeyboardEvent<HTMLElement>) => void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusFirst(container.current);
    return () => opener?.focus();
  }, [active, container]);
  return (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeRef.current();
      return;
    }
    if (event.key === 'Tab') cycleFocus(event, container.current);
  };
}

function focusFirst(root: HTMLElement | null): void {
  if (root === null) return;
  const first = root.querySelector<HTMLElement>(FOCUSABLE);
  (first ?? root).focus();
}

function cycleFocus(event: ReactKeyboardEvent<HTMLElement>, root: HTMLElement | null): void {
  if (root === null) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
