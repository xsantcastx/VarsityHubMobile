export function getAdPaymentStatusLabel(
  status?: string | null,
  paymentStatus?: string | null
): string {
  const normalizedStatus = String(status || 'draft').toLowerCase();
  const normalizedPaymentStatus = String(paymentStatus || 'unpaid').toLowerCase();

  if (normalizedPaymentStatus === 'pending_approval') {
    return normalizedStatus === 'approved' || normalizedStatus === 'active'
      ? 'Awaiting Payment'
      : 'Pending Approval';
  }

  if (normalizedPaymentStatus === 'hold') {
    return 'Checkout In Progress';
  }

  if (normalizedPaymentStatus === 'paid') {
    return 'Paid';
  }

  if (normalizedPaymentStatus === 'refunded') {
    return 'Refunded';
  }

  if (normalizedPaymentStatus === 'refund_pending') {
    return 'Refund Pending';
  }

  return 'Unpaid';
}
