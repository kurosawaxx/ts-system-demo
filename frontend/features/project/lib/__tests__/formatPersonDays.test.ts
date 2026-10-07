import { describe, it, expect } from 'vitest';
import { formatDayCostRange, hoursToDays, formatDaysAndYen } from '@/features/project/lib/formatPersonDays';

describe('formatDayCostRange', () => {
  it('単価が変わっていなければ1つの値で表示する', () => {
    expect(formatDayCostRange(40000, 40000)).toBe('¥40,000/人日');
  });

  it('案件途中で単価改定があった場合は範囲で表示する', () => {
    expect(formatDayCostRange(44000, 48000)).toBe('¥44,000〜48,000');
  });

  it('単価が使われていない場合は空文字（呼び出し側で非表示）', () => {
    expect(formatDayCostRange(null, null)).toBe('');
    expect(formatDayCostRange(undefined, undefined)).toBe('');
    expect(formatDayCostRange(40000, null)).toBe('');
  });

  it('端数は円単位に丸める', () => {
    expect(formatDayCostRange(40000.4, 40000.4)).toBe('¥40,000/人日');
  });
});

describe('hoursToDays', () => {
  it('8時間を1人日として小数第二位まで丸める', () => {
    expect(hoursToDays(8)).toBe(1);
    expect(hoursToDays(4)).toBe(0.5);
    expect(hoursToDays(12.5)).toBe(1.56);
  });
});

describe('formatDaysAndYen', () => {
  it('人日と金額を並べて表示する', () => {
    expect(formatDaysAndYen(2.5, 100000)).toBe('2.5人日(¥100,000)');
  });
});
