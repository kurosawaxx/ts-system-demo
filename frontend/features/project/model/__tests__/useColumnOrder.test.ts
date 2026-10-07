import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnOrder, STORAGE_KEY } from '@/features/project/model/useColumnOrder';
import { COL_LABELS } from '@/features/project/config/columns';

const DEFAULT_ORDER = Array.from({ length: COL_LABELS.length }, (_, i) => i);

describe('useColumnOrder', () => {
  beforeEach(() => localStorage.clear());

  it('初期状態はデフォルト順', () => {
    const { result } = renderHook(() => useColumnOrder());
    expect(result.current.colOrder).toEqual(DEFAULT_ORDER);
  });

  it('reorder で列の順序が変わる', () => {
    const { result } = renderHook(() => useColumnOrder());
    const original = [...result.current.colOrder];

    act(() => result.current.reorder(0, 2));

    const reordered = result.current.colOrder;
    expect(reordered[2]).toBe(original[0]);
    expect(reordered[0]).toBe(original[1]);
  });

  it('同じ位置への reorder は何も変わらない', () => {
    const { result } = renderHook(() => useColumnOrder());
    const before = [...result.current.colOrder];

    act(() => result.current.reorder(1, 1));

    expect(result.current.colOrder).toEqual(before);
  });

  it('reorder 後に localStorage へ保存される', () => {
    const { result } = renderHook(() => useColumnOrder());
    act(() => result.current.reorder(0, 1));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as number[];
    expect(saved).toEqual(result.current.colOrder);
  });

  it('resetOrder でデフォルト順に戻り localStorage が削除される', () => {
    const { result } = renderHook(() => useColumnOrder());
    act(() => result.current.reorder(0, 2));
    act(() => result.current.resetOrder());

    expect(result.current.colOrder).toEqual(DEFAULT_ORDER);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('localStorage に保存された順序が初期状態として復元される', () => {
    const saved = [2, 0, 1, ...DEFAULT_ORDER.slice(3)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = renderHook(() => useColumnOrder());
    expect(result.current.colOrder).toEqual(saved);
  });
});
