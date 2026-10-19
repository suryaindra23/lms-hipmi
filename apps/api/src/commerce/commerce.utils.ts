export function isPendingPaymentExpired(
  status: string,
  paymentExpiresAt: Date | null,
  now = new Date(),
) {
  return status === 'PENDING_PAYMENT'
    && paymentExpiresAt !== null
    && paymentExpiresAt.getTime() <= now.getTime();
}
