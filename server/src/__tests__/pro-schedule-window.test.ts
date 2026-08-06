import { DEFAULT_PRO_SCHEDULE_WINDOW_DAYS, getProScheduleWindowDays } from '../lib/proSchedule/window.js';

describe('pro schedule ingest window', () => {
  it('defaults to a preseason-safe horizon', () => {
    expect(DEFAULT_PRO_SCHEDULE_WINDOW_DAYS).toBe(45);
    expect(getProScheduleWindowDays({} as NodeJS.ProcessEnv)).toBe(45);
  });

  it('accepts an env override', () => {
    expect(
      getProScheduleWindowDays({ PRO_SCHEDULE_WINDOW_DAYS: '60' } as NodeJS.ProcessEnv)
    ).toBe(60);
  });

  it('clamps invalid overrides safely', () => {
    expect(
      getProScheduleWindowDays({ PRO_SCHEDULE_WINDOW_DAYS: '0' } as NodeJS.ProcessEnv)
    ).toBe(1);
    expect(
      getProScheduleWindowDays({ PRO_SCHEDULE_WINDOW_DAYS: '500' } as NodeJS.ProcessEnv)
    ).toBe(90);
    expect(
      getProScheduleWindowDays({ PRO_SCHEDULE_WINDOW_DAYS: 'abc' } as NodeJS.ProcessEnv)
    ).toBe(45);
  });
});
