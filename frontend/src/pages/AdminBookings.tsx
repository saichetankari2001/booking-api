import { useState } from 'react';
import { useAdminBookings, useCancelAdminBooking } from '../hooks/useAdminBookings';
import { useAdminTables } from '../hooks/useAdminTables';
import { useAdminSlots } from '../hooks/useAdminSlots';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BookingStatus } from '../api/types';

const PAGE_SIZE = 20;

export default function AdminBookings() {
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAdminBookings({
    date: date || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: tables } = useAdminTables();
  const { data: slots } = useAdminSlots();
  const cancelBooking = useCancelAdminBooking();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  function tableName(tableId: number): string {
    return tables?.find((t) => t.id === tableId)?.name ?? `Table #${tableId}`;
  }
  function slotLabel(slotId: number): string {
    return slots?.find((s) => s.id === slotId)?.label ?? `Slot #${slotId}`;
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display text-2xl font-semibold mb-6">Bookings</h1>

      <div className="flex gap-4 mb-6">
        <div>
          <label htmlFor="filter-date" className="block text-sm font-medium mb-1">
            Date
          </label>
          <input
            id="filter-date"
            type="date"
            value={date}
            onChange={(e) => {
              setPage(1);
              setDate(e.target.value);
            }}
            className="rounded border border-border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="filter-status" className="block text-sm font-medium mb-1">
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as BookingStatus | '');
            }}
            className="rounded border border-border px-3 py-2"
          >
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading && <p>Loading bookings…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load bookings.
        </p>
      )}

      {data && data.bookings.length === 0 && <p>No bookings match these filters.</p>}

      {data && data.bookings.length > 0 && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-sm text-text/70">
              <th className="py-2">Guest</th>
              <th className="py-2">Date</th>
              <th className="py-2">Slot</th>
              <th className="py-2">Table</th>
              <th className="py-2">Party</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-border">
                <td className="py-2">{booking.guestName}</td>
                <td className="py-2">{booking.date}</td>
                <td className="py-2">{slotLabel(booking.slotId)}</td>
                <td className="py-2">{tableName(booking.tableId)}</td>
                <td className="py-2">{booking.partySize}</td>
                <td className="py-2 capitalize">{booking.status}</td>
                <td className="py-2">
                  {booking.status === 'confirmed' && (
                    <Button variant="secondary" onClick={() => setCancelTargetId(booking.id)}>
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <div className="flex gap-3 mt-4 items-center">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-text/70">Page {page}</span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * PAGE_SIZE >= data.total}
          >
            Next
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cancelTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        title="Cancel this booking?"
        description="The guest's table will be released for this slot and date."
        confirmLabel="Confirm cancellation"
        isConfirming={cancelBooking.isPending}
        onConfirm={() => {
          if (cancelTargetId) {
            cancelBooking.mutate(cancelTargetId, { onSuccess: () => setCancelTargetId(null) });
          }
        }}
      />
    </div>
  );
}
