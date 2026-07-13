export type AdBadgeTone =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'rejected'
  | 'archived';

export type AdScheduleBucket = 'unscheduled' | 'scheduled' | 'live' | 'completed';

export type AdBadgePresentation = {
  label: string;
  tone: AdBadgeTone;
};

export function getAdScheduleBucket(dates: string[] = [], now = new Date()): AdScheduleBucket {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let hasPast = false;
  let hasToday = false;
  let hasFuture = false;

  for (const dateStr of dates) {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      hasFuture = true;
      continue;
    }

    if (date.getTime() === today.getTime()) {
      hasToday = true;
    } else if (date > today) {
      hasFuture = true;
    } else {
      hasPast = true;
    }
  }

  if (hasToday) {
    return 'live';
  }

  if (hasFuture) {
    return 'scheduled';
  }

  if (hasPast) {
    return 'completed';
  }

  return 'unscheduled';
}

export function getCompositeAdBadge(
  status?: string,
  paymentStatus?: string,
  dates: string[] = [],
  now = new Date()
): AdBadgePresentation {
  const normalizedStatus = String(status || 'draft');
  const normalizedPaymentStatus = String(paymentStatus || 'unpaid');

  if (normalizedStatus === 'rejected') {
    return { label: 'Rejected', tone: 'rejected' };
  }

  if (normalizedStatus === 'archived') {
    return { label: 'Archived', tone: 'archived' };
  }

  if (normalizedStatus === 'pending') {
    return { label: 'Pending Approval', tone: 'pending' };
  }

  if (normalizedStatus === 'approved' || normalizedStatus === 'active') {
    if (normalizedPaymentStatus === 'paid') {
      const scheduleBucket = getAdScheduleBucket(dates, now);

      if (scheduleBucket === 'live') {
        return { label: 'Live', tone: 'live' };
      }

      if (scheduleBucket === 'scheduled') {
        return { label: 'Scheduled', tone: 'scheduled' };
      }

      if (scheduleBucket === 'completed') {
        return { label: 'Completed', tone: 'completed' };
      }

      return { label: 'Paid - Schedule Dates', tone: 'approved' };
    }

    return { label: 'Approved - Awaiting Payment', tone: 'approved' };
  }

  return { label: 'Draft', tone: 'draft' };
}
