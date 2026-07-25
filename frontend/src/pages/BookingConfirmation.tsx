import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBooking, useCancelBooking } from '../hooks/useBookings';
import { useSlots } from '../hooks/useSlots';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function BookingConfirmation() {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading, isError } = useBooking(id);
  const { data: slots } = useSlots();
  const cancelBooking = useCancelBooking(id as string);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p role="alert">We couldn&apos;t find that booking.</p>
      </div>
    );
  }

  const slot = slots?.find((s) => s.id === booking.slotId);

  return (
    <div className="min-h-screen px-6 py-10 max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">
        {booking.status === 'cancelled' ? 'Booking cancelled' : "You're booked!"}
      </h1>
      <dl className="space-y-2 mb-8">
        <div>
          <dt className="text-sm text-text/70">Date</dt>
          <dd>{booking.date}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Time</dt>
          <dd>{slot ? slot.label : `Slot #${booking.slotId}`}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Party size</dt>
          <dd>{booking.partySize}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Table</dt>
          <dd>Table #{booking.tableId}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Status</dt>
          <dd className="capitalize">{booking.status}</dd>
        </div>
      </dl>

      {booking.status === 'confirmed' && (
        <>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Cancel booking
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cancel this booking?"
            description="This can't be undone. You'll need to make a new booking if you change your mind."
            confirmLabel="Confirm cancellation"
            isConfirming={cancelBooking.isPending}
            onConfirm={() => {
              cancelBooking.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
            }}
          />
        </>
      )}
    </div>
  );
}
