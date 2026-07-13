import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type DailyCount = { date: string; count: number };

export type FounderMetricsReport = {
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalUsers: number;
    totalReports: number;
    totalMessages: number;
    newUsersToday: number;
    reportsToday: number;
    messagesToday: number;
    newUsersLastDays: number;
    reportsLastDays: number;
    messagesLastDays: number;
    days: number;
  };
  daily: {
    users: DailyCount[];
    reports: DailyCount[];
    messages: DailyCount[];
  };
};

type RawDailyRow = { day: Date; count: number };

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDateRange(startDate: Date, days: number): string[] {
  const dates: string[] = [];
  const cursor = new Date(startDate);
  for (let i = 0; i < days; i += 1) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function fillDailyCounts(dateKeys: string[], rows: RawDailyRow[]): DailyCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(toDateKey(row.day), Number(row.count || 0));
  }
  return dateKeys.map(date => ({ date, count: map.get(date) ?? 0 }));
}

async function getDailyCounts(
  table: '"User"' | '"AbuseReport"' | '"Message"',
  start: Date,
  end: Date
) {
  return prisma.$queryRaw<RawDailyRow[]>`
    SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS count
    FROM ${Prisma.raw(table)}
    WHERE created_at >= ${start} AND created_at < ${end}
    GROUP BY day
    ORDER BY day
  `;
}

export async function getFounderMetricsReport(days = 7): Promise<FounderMetricsReport> {
  const safeDays = Math.min(Math.max(days, 1), 30);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfRange = new Date(startOfToday);
  startOfRange.setDate(startOfRange.getDate() - (safeDays - 1));

  const endExclusive = new Date(startOfToday);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const dateKeys = buildDateRange(startOfRange, safeDays);

  const [
    totalUsers,
    totalReports,
    totalMessages,
    newUsersToday,
    reportsToday,
    messagesToday,
    usersDaily,
    reportsDaily,
    messagesDaily,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.abuseReport.count(),
    prisma.message.count(),
    prisma.user.count({ where: { created_at: { gte: startOfToday } } }),
    prisma.abuseReport.count({ where: { created_at: { gte: startOfToday } } }),
    prisma.message.count({ where: { created_at: { gte: startOfToday } } }),
    getDailyCounts('"User"', startOfRange, endExclusive),
    getDailyCounts('"AbuseReport"', startOfRange, endExclusive),
    getDailyCounts('"Message"', startOfRange, endExclusive),
  ]);

  const filledUsers = fillDailyCounts(dateKeys, usersDaily);
  const filledReports = fillDailyCounts(dateKeys, reportsDaily);
  const filledMessages = fillDailyCounts(dateKeys, messagesDaily);

  const newUsersLastDays = filledUsers.reduce((sum, row) => sum + row.count, 0);
  const reportsLastDays = filledReports.reduce((sum, row) => sum + row.count, 0);
  const messagesLastDays = filledMessages.reduce((sum, row) => sum + row.count, 0);

  return {
    dateRange: {
      start: dateKeys[0],
      end: dateKeys[dateKeys.length - 1],
    },
    summary: {
      totalUsers,
      totalReports,
      totalMessages,
      newUsersToday,
      reportsToday,
      messagesToday,
      newUsersLastDays,
      reportsLastDays,
      messagesLastDays,
      days: safeDays,
    },
    daily: {
      users: filledUsers,
      reports: filledReports,
      messages: filledMessages,
    },
  };
}
