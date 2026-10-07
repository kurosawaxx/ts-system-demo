import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnVisibility, STORAGE_KEY } from '@/features/project/model/useColumnVisibility';
import { COL_LABELS } from '@/features/project/config/columns';

const ALL_INDICES = Array.from({ length: COL_LABELS.length }, (_, i) => i);

describe('useColumnVisibility', () => {
  beforeEach(() => localStorage.clear());

  it('初期状態ですべての列が表示される', () => {
    const { result } = renderHook(() => useColumnVisibility());
    expect(result.current.visibleCols.size).toBe(COL_LABELS.length);
  });

  it('toggle で列の表示/非表示が切り替わる', () => {
    const { result } = renderHook(() => useColumnVisibility());

    act(() => result.current.toggle(0));
    expect(result.current.visibleCols.has(0)).toBe(false);

    act(() => result.current.toggle(0));
    expect(result.current.visibleCols.has(0)).toBe(true);
  });

  it('最後の1列は非表示にできない', () => {
    const { result } = renderHook(() => useColumnVisibility());

    act(() => {
      ALL_INDICES.slice(1).forEach(i => result.current.toggle(i));
    });
    expect(result.current.visibleCols.size).toBe(1);

    act(() => result.current.toggle(0));
    expect(result.current.visibleCols.size).toBe(1);
    expect(result.current.visibleCols.has(0)).toBe(true);
  });

  it('toggle 後に localStorage へ保存される', () => {
    const { result } = renderHook(() => useColumnVisibility());

    act(() => result.current.toggle(0));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as number[];
    expect(saved).not.toContain(0);
  });

  it('reset で全列表示に戻り localStorage が削除される', () => {
    const { result } = renderHook(() => useColumnVisibility());
    act(() => result.current.toggle(0));

    act(() => result.current.reset());

    expect(result.current.visibleCols.size).toBe(COL_LABELS.length);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('localStorage に保存された値が初期状態として復元される', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([0, 1, 2]));
    const { result } = renderHook(() => useColumnVisibility());
    expect(result.current.visibleCols).toEqual(new Set([0, 1, 2]));
  });

  it('toggle(1) は 0番に影響しない', () => {
    const { result } = renderHook(() => useColumnVisibility());
    act(() => result.current.toggle(1));
    expect(result.current.visibleCols.has(0)).toBe(true);
    expect(result.current.visibleCols.has(1)).toBe(false);
  });
});
