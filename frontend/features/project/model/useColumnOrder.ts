'use client';

import { useState } from 'react';
import { COL_LABELS } from '@/features/project/config/columns';

export const STORAGE_KEY = 'projects:colOrder:v2';
const DEFAULT_ORDER = Array.from({ length: COL_LABELS.length }, (_, i) => i);

function loadFromStorage(): number[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as number[];
      if (Array.isArray(parsed) && parsed.length === DEFAULT_ORDER.length) return parsed;
    }
  } catch {}
  return [...DEFAULT_ORDER];
}

export function useColumnOrder() {
  const [colOrder, setColOrder] = useState<number[]>(() =>
    typeof window === 'undefined' ? [...DEFAULT_ORDER] : loadFromStorage()
  );

  const reorder = (fromDisplayIdx: number, toDisplayIdx: number) => {
    if (fromDisplayIdx === toDisplayIdx) return;
    setColOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromDisplayIdx, 1);
      next.splice(toDisplayIdx, 0, moved);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const resetOrder = () => {
    setColOrder([...DEFAULT_ORDER]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return { colOrder, reorder, resetOrder };
}
