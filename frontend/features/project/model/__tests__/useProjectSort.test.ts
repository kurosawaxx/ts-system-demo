import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectSort } from '@/features/project/model/useProjectSort';
import { PROJECT_COL_KEYS, MY_PROJECT_COL_KEYS } from '@/features/project/config/sort';

const KEY = 'test:sort';

describe('useProjectSort', () => {
  beforeEach(() => localStorage.clear());

  it('初期状態は未ソート(null)', () => {
    const { result } = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));
    expect(result.current.sort).toBeNull();
  });

  it('toggle で 昇順 → 降順 → 昇順 と切り替わる', () => {
    const { result } = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));

    act(() => result.current.toggle('amount'));
    expect(result.current.sort).toEqual({ key: 'amount', dir: 'asc' });

    act(() => result.current.toggle('amount'));
    expect(result.current.sort).toEqual({ key: 'amount', dir: 'desc' });

    act(() => result.current.toggle('amount'));
    expect(result.current.sort).toEqual({ key: 'amount', dir: 'asc' });
  });

  it('toggle 後に localStorage へ保存される', () => {
    const { result } = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));
    act(() => result.current.toggle('client'));

    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({ key: 'client', dir: 'asc' });
  });

  it('再マウント(ブラウザを閉じて開き直した想定)で保存したソートが復元される', () => {
    const first = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));
    act(() => first.result.current.toggle('billing'));
    act(() => first.result.current.toggle('billing'));
    first.unmount();

    const { result } = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));
    expect(result.current.sort).toEqual({ key: 'billing', dir: 'desc' });
  });

  it('reset で未ソートに戻り localStorage が削除される', () => {
    const { result } = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));
    act(() => result.current.toggle('client'));
    act(() => result.current.reset());

    expect(result.current.sort).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it.each([
    ['JSON として壊れている', '{broken'],
    ['許可されていないキー', JSON.stringify({ key: 'unknown', dir: 'asc' })],
    ['dir が asc/desc 以外', JSON.stringify({ key: 'client', dir: 'up' })],
    ['オブジェクトではない', JSON.stringify(['client', 'asc'])],
  ])('保存値が不正(%s)なら未ソートとして扱う', (_, saved) => {
    localStorage.setItem(KEY, saved);
    const { result } = renderHook(() => useProjectSort(KEY, PROJECT_COL_KEYS));
    expect(result.current.sort).toBeNull();
  });

  it('そのテーブルに無い列のキーは復元しない', () => {
    // 担当者向けテーブルに「アカウントディレクター」列は無い
    localStorage.setItem(KEY, JSON.stringify({ key: 'director', dir: 'asc' }));
    const { result } = renderHook(() => useProjectSort(KEY, MY_PROJECT_COL_KEYS));
    expect(result.current.sort).toBeNull();
  });

  it('storageKey ごとに独立して保存される', () => {
    const a = renderHook(() => useProjectSort('test:a', PROJECT_COL_KEYS));
    const b = renderHook(() => useProjectSort('test:b', MY_PROJECT_COL_KEYS));

    act(() => a.result.current.toggle('amount'));
    act(() => b.result.current.toggle('work_status'));
    act(() => a.result.current.reset());

    expect(localStorage.getItem('test:a')).toBeNull();
    expect(JSON.parse(localStorage.getItem('test:b') ?? 'null')).toEqual({ key: 'work_status', dir: 'asc' });
  });
});
