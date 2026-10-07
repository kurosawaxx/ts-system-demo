'use client';

import { useState } from 'react';

function allIndices(count: number): Set<number> {
  return new Set(Array.from({ length: count }, (_, i) => i));
}

function loadFromStorage(count: number, storageKey: string): Set<number> {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as number[];
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch {}
  return allIndices(count);
}

export function useExportSelection(count: number, storageKey: string) {
  const [selected, setSelected] = useState<Set<number>>(() =>
    typeof window === 'undefined' ? allIndices(count) : loadFromStorage(count, storageKey)
  );

  const toggle = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        if (next.size <= 1) return prev;
        next.delete(i);
      } else {
        next.add(i);
      }
      try { localStorage.setItem(storageKey, JSON.stringify([...next].sort((a, b) => a - b))); } catch {}
      return next;
    });
  };

  const reset = () => {
    const all = allIndices(count);
    setSelected(all);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  return { selected, toggle, reset };
}
