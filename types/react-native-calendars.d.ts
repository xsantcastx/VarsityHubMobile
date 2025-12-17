declare module 'react-native-calendars' {
  import * as React from 'react';
  import { ViewStyle } from 'react-native';

  export interface DateData {
    dateString: string;
    day: number;
    month: number;
    year: number;
    timestamp: number;
  }

  export interface CalendarProps {
    onDayPress?: (day: DateData) => void;
    onDayLongPress?: (day: DateData) => void;
    onMonthChange?: (date: DateData) => void;
    markedDates?: Record<string, any>;
    markingType?: string;
    theme?: Record<string, any>;
    style?: ViewStyle | ViewStyle[];
    enableSwipeMonths?: boolean;
    hideExtraDays?: boolean;
    firstDay?: number;
    minDate?: string;
    maxDate?: string;
    [key: string]: any;
  }

  export const Calendar: React.ComponentType<CalendarProps>;
  export type AgendaEntry = Record<string, any>;
  export type AgendaSchedule = Record<string, AgendaEntry[]>;

  export default Calendar;
}
