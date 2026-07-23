/**
 * Returns UTC midnight of today's local calendar date.
 *
 * This must match how `Booking.date` is persisted (see BookingService.create's
 * ISO-string Date parse). `new Date(new Date().toDateString())` produces LOCAL
 * midnight instead, which is a later UTC instant on servers behind UTC — wrongly
 * excluding same-day bookings from "future confirmed bookings" counts.
 */
export function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  );
}
