'use client';

import { useState } from 'react';
import { COL_LABELS } from '@/features/project/config/columns';

export const STORAGE_KEY = 'projects:visibleCols:v3';
const ALL_INDICES = Array.from({ length: COL_LABELS.length }, (_, i) => i);

function loadFromStorage(): Set<number> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as number[];
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch {}
  return new Set(ALL_INDICES);
}

export function useColumnVisibility() {
  const [visibleCols, setVisibleCols] = useState<Set<number>>(() =>
    typeof window === 'undefined' ? new Set(ALL_INDICES) : loadFromStorage()
  );

  const toggle = (i: number) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        if (next.size <= 1) return prev;
        next.delete(i);
      } else {
        next.add(i);
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next].sort((a, b) => a - b))); } catch {}
      return next;
    });
  };

  const reset = () => {
    const all = new Set(ALL_INDICES);
    setVisibleCols(all);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return { visibleCols, toggle, reset };
}
