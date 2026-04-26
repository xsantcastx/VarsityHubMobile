export type AdBadgeTone = 'draft' | 'pending' | 'approved' | 'live' | 'rejected' | 'archived';

export type AdBadgePresentation = {
  label: string;
  tone: AdBadgeTone;
};

export function getCompositeAdBadge(status?: string, paymentStatus?: string): AdBadgePresentation {
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
      return { label: 'Live', tone: 'live' };
    }

    return { label: 'Approved - Awaiting Payment', tone: 'approved' };
  }

  return { label: 'Draft', tone: 'draft' };
}
