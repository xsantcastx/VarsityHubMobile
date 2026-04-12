export type AdStatus = 'draft' | 'pending' | 'approved' | 'active' | 'rejected' | 'archived';

export function normalizeAdStatus(status: string | null | undefined): AdStatus {
  switch (status) {
    case 'pending':
    case 'approved':
    case 'active':
    case 'rejected':
    case 'archived':
      return status;
    default:
      return 'draft';
  }
}

export function getAdStatusForCheckoutSubmission(status: string | null | undefined): AdStatus {
  return status === 'draft' ? 'pending' : normalizeAdStatus(status);
}

export function getAdStatusAfterApproval(paymentStatus: string | null | undefined): AdStatus {
  return paymentStatus === 'paid' ? 'active' : 'approved';
}

export function getAdStatusAfterSuccessfulPayment(status: string | null | undefined): AdStatus {
  const normalized = normalizeAdStatus(status);
  return normalized === 'approved' || normalized === 'active' ? 'active' : 'pending';
}

export function canReviewAd(status: string | null | undefined): boolean {
  const normalized = normalizeAdStatus(status);
  return normalized === 'pending' || normalized === 'approved';
}
