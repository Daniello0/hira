'use client';

import { useRef, type FormEvent } from 'react';

/**
 * Submit handler for a form that saves. It keeps the page from reloading, and a submit
 * while the last save still runs does nothing, so a held or repeated Enter sends one request.
 */
export function useFormSubmit(save: (form: HTMLFormElement) => Promise<unknown>): (event: FormEvent<HTMLFormElement>) => void {
  const saving = useRef(false);
  return (event) => {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    void save(event.currentTarget).finally(() => {
      saving.current = false;
    });
  };
}
