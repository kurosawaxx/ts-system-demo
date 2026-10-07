import { describe, it, expect } from 'vitest';
import { formatUserName, isInactiveUser } from '@/shared/lib/userLabel';

describe('formatUserName', () => {
  it('現役メンバーは氏名のみ', () => {
    expect(formatUserName({ name: 'テスト太郎', is_active: true })).toBe('テスト太郎');
  });

  it('無効化されたメンバーは「（無効）」を付ける', () => {
    expect(formatUserName({ name: 'テスト花子', is_active: false })).toBe('テスト花子（無効）');
  });

  it('is_active を返さないAPIのレスポンスは現役扱い', () => {
    expect(formatUserName({ name: 'テスト太郎' })).toBe('テスト太郎');
  });

  it('undefined / null は空文字', () => {
    expect(formatUserName(undefined)).toBe('');
    expect(formatUserName(null)).toBe('');
  });
});

describe('isInactiveUser', () => {
  it('is_active が明示的に false のときだけ無効と判定する', () => {
    expect(isInactiveUser({ name: 'a', is_active: false })).toBe(true);
    expect(isInactiveUser({ name: 'a', is_active: true })).toBe(false);
    expect(isInactiveUser({ name: 'a' })).toBe(false);
    expect(isInactiveUser(undefined)).toBe(false);
  });
});
