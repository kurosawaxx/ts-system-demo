import holidayJp from '@holiday-jp/holiday_jp';

export const isHoliday = (date: Date): boolean => holidayJp.isHoliday(date);
