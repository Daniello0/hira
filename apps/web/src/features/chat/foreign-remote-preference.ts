'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hira.includeForeignRemote';

/**
 * Whether chat searches include foreign remote vacancies (Q30). Shown by default.
 * Kept in this browser only; storage that throws (private mode) falls back to the default.
 */
export function useForeignRemotePreference(): [boolean, (value: boolean) => void] {
  const [include, setInclude] = useState(true);
  useEffect(() => setInclude(readPreference()), []);
  return [
    include,
    (value: boolean) => {
      setInclude(value);
      writePreference(value);
    },
  ];
}

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writePreference(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // The toggle still applies to this tab.
  }
}
