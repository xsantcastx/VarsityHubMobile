type AppleNotificationLogClient = {
  transactionLog: {
    create: (args: any) => Promise<unknown>;
  };
};

type RecordAppleNotificationArgs = {
  notificationUUID: string | null | undefined;
  originalTransactionId: string | null | undefined;
  productId: string | null | undefined;
  environment: string | null | undefined;
  expiresDate?: number | null | undefined;
  notificationType: string | null | undefined;
  subtype: string | null | undefined;
};

export async function recordAppleNotificationReceipt(
  client: AppleNotificationLogClient,
  args: RecordAppleNotificationArgs
): Promise<'recorded' | 'duplicate' | 'missing_uuid'> {
  const notificationUUID =
    typeof args.notificationUUID === 'string' ? args.notificationUUID.trim() : '';
  if (!notificationUUID) return 'missing_uuid';

  try {
    await client.transactionLog.create({
      data: {
        transaction_type: 'APPLE_S2S_NOTIFICATION',
        status: 'RECEIVED',
        order_id: args.originalTransactionId || `apple_s2s_${notificationUUID}`,
        // Reuse the existing unique Apple-side identifier slot to deduplicate
        // App Store Server Notification `notificationUUID` replays.
        apple_transaction_id: notificationUUID,
        metadata: {
          notificationUUID,
          notificationType: args.notificationType || null,
          subtype: args.subtype || null,
          originalTransactionId: args.originalTransactionId || null,
          productId: args.productId || null,
          environment: args.environment || null,
          expiresDate: args.expiresDate ? new Date(args.expiresDate).toISOString() : null,
        },
      },
    });
    return 'recorded';
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return 'duplicate';
    }
    throw error;
  }
}
