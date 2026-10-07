import { describe, it, expect } from 'vitest';
import { isHoliday } from '@/shared/lib/holidays';

describe('isHoliday', () => {
  it('祝日はtrueを返す（元日）', () => {
    expect(isHoliday(new Date(2026, 0, 1))).toBe(true);
  });

  it('祝日はtrueを返す（振替休日）', () => {
    // 2026-05-03（憲法記念日）は日曜。5/4はみどりの日、5/5はこどもの日で
    // いずれも既に祝日のため、振替休日は最初の平日である5/6にずれる
    expect(isHoliday(new Date(2026, 4, 6))).toBe(true);
  });

  it('平日はfalseを返す', () => {
    expect(isHoliday(new Date(2026, 0, 5))).toBe(false);
  });

  it('日曜日は祝日判定の対象外（false）', () => {
    // 2026-01-04は日曜だが祝日ではない
    expect(isHoliday(new Date(2026, 0, 4))).toBe(false);
  });
});
