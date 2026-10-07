'use client';

import { useState } from 'react';
import type { ProjectSort, SortKey } from '@/features/project/config/sort';
import { nextSort } from '@/features/project/lib/projectSort';

function loadFromStorage(storageKey: string, allowedKeys: readonly SortKey[]): ProjectSort {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { key?: unknown; dir?: unknown } | null;
      if (
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        allowedKeys.includes(parsed.key as SortKey) &&
        (parsed.dir === 'asc' || parsed.dir === 'desc')
      ) {
        return { key: parsed.key as SortKey, dir: parsed.dir };
      }
    }
  } catch {}
  return null;
}

// ソート状態は列幅・列順と同じく localStorage に保存し、ブラウザを閉じても保持する。
// 解除はクリックでは行わず reset(各画面のリセットボタン)でのみ行う。
export function useProjectSort(storageKey: string, allowedKeys: readonly SortKey[]) {
  const [sort, setSort] = useState<ProjectSort>(() =>
    typeof window === 'undefined' ? null : loadFromStorage(storageKey, allowedKeys)
  );

  const toggle = (key: SortKey) => {
    setSort(prev => {
      const next = nextSort(prev, key);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const reset = () => {
    setSort(null);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  return { sort, toggle, reset };
}
