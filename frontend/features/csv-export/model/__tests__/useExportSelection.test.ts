import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExportSelection } from '@/features/csv-export/model/useExportSelection';

const COUNT = 5;
const STORAGE_KEY = 'test:exportCols';

describe('useExportSelection', () => {
  beforeEach(() => localStorage.clear());

  it('初期状態ですべての項目が選択される', () => {
    const { result } = renderHook(() => useExportSelection(COUNT, STORAGE_KEY));
    expect(result.current.selected.size).toBe(COUNT);
  });

  it('toggle で項目の選択/解除が切り替わる', () => {
    const { result } = renderHook(() => useExportSelection(COUNT, STORAGE_KEY));

    act(() => result.current.toggle(0));
    expect(result.current.selected.has(0)).toBe(false);

    act(() => result.current.toggle(0));
    expect(result.current.selected.has(0)).toBe(true);
  });

  it('最後の1項目は解除できない', () => {
    const { result } = renderHook(() => useExportSelection(COUNT, STORAGE_KEY));

    act(() => {
      Array.from({ length: COUNT - 1 }, (_, i) => i + 1).forEach(i => result.current.toggle(i));
    });
    expect(result.current.selected.size).toBe(1);

    act(() => result.current.toggle(0));
    expect(result.current.selected.size).toBe(1);
    expect(result.current.selected.has(0)).toBe(true);
  });

  it('toggle 後に localStorage へ保存される', () => {
    const { result } = renderHook(() => useExportSelection(COUNT, STORAGE_KEY));

    act(() => result.current.toggle(0));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as number[];
    expect(saved).not.toContain(0);
  });

  it('reset で全項目選択に戻り localStorage が削除される', () => {
    const { result } = renderHook(() => useExportSelection(COUNT, STORAGE_KEY));
    act(() => result.current.toggle(0));

    act(() => result.current.reset());

    expect(result.current.selected.size).toBe(COUNT);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('localStorage に保存された値が初期状態として復元される', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([0, 1]));
    const { result } = renderHook(() => useExportSelection(COUNT, STORAGE_KEY));
    expect(result.current.selected).toEqual(new Set([0, 1]));
  });

  it('別々の storageKey は独立して保存される', () => {
    const { result: a } = renderHook(() => useExportSelection(COUNT, 'test:exportCols:a'));
    const { result: b } = renderHook(() => useExportSelection(COUNT, 'test:exportCols:b'));

    act(() => a.current.toggle(0));

    expect(a.current.selected.has(0)).toBe(false);
    expect(b.current.selected.has(0)).toBe(true);
  });
});
