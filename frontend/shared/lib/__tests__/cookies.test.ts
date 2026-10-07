import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, removeToken } from '@/shared/lib/cookies';

// js-cookie をモックせず happy-dom の document.cookie で実際の動作をテスト

function clearAllCookies() {
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

describe('cookies', () => {
  beforeEach(() => clearAllCookies());

  it('setToken → getToken で同じ値が返る', () => {
    setToken('my-token-123');
    expect(getToken()).toBe('my-token-123');
  });

  it('トークンがない場合は getToken が undefined を返す', () => {
    expect(getToken()).toBeUndefined();
  });

  it('removeToken 後は getToken が undefined を返す', () => {
    setToken('my-token-123');
    removeToken();
    expect(getToken()).toBeUndefined();
  });

  it('setToken を上書きすると新しい値が返る', () => {
    setToken('old-token');
    setToken('new-token');
    expect(getToken()).toBe('new-token');
  });
});
