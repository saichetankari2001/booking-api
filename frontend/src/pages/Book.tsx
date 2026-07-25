import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAvailableTables } from '../hooks/useAvailableTables';
import { useCreateBooking } from '../hooks/useBookings';
import { guestBookingFormSchema, GuestBookingFormInput } from '../lib/schemas/booking.schema';
import { Button } from '../components/Button';
import { ApiError } from '../api/apiClient';

export default function Book() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const date = searchParams.get('date');
  const partySize = Number(searchParams.get('partySize'));
  const slotId = Number(searchParams.get('slotId'));
  const hasValidParams = Boolean(date) && Number.isInteger(partySize) && Number.isInteger(slotId);

  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const availableTablesParams = useMemo(
    () => (hasValidParams ? { date: date as string, partySize, slotId } : null),
    [hasValidParams, date, partySize, slotId],
  );
  const { data: tables, isLoading, isError } = useAvailableTables(availableTablesParams);
  const createBooking = useCreateBooking();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestBookingFormInput>({ resolver: zodResolver(guestBookingFormSchema) });

  if (!hasValidParams) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p>
          Missing booking details.{' '}
          <a href="/" className="underline text-accent">
            Start over
          </a>
          .
        </p>
      </div>
    );
  }

  async function onSubmit(values: GuestBookingFormInput) {
    if (selectedTableId === null) return;
    try {
      const booking = await createBooking.mutateAsync({
        date: date as string,
        slotId,
        partySize,
        tableId: selectedTableId,
        ...values,
      });
      navigate(`/bookings/${booking.id}`);
    } catch {
      // surfaced via createBooking.error below
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-6">Choose a table</h1>

      {isLoading && <p>Loading availability…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load available tables.
        </p>
      )}
      {tables && tables.length === 0 && (
        <p>No tables available for this date, time, and party size.</p>
      )}

      {tables && tables.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelectedTableId(table.id)}
              aria-pressed={selectedTableId === table.id}
              className={`rounded border px-4 py-3 text-left ${
                selectedTableId === table.id ? 'border-accent bg-accent/10' : 'border-border'
              }`}
            >
              <div className="font-medium">{table.name}</div>
              <div className="text-sm text-text/70">Seats {table.capacity}</div>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="guestName" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="guestName"
            className="w-full rounded border border-border px-3 py-2"
            {...register('guestName')}
          />
          {errors.guestName && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.guestName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="guestEmail" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="guestEmail"
            type="email"
            className="w-full rounded border border-border px-3 py-2"
            {...register('guestEmail')}
          />
          {errors.guestEmail && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.guestEmail.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="guestPhone" className="block text-sm font-medium mb-1">
            Phone (optional)
          </label>
          <input
            id="guestPhone"
            className="w-full rounded border border-border px-3 py-2"
            {...register('guestPhone')}
          />
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            className="w-full rounded border border-border px-3 py-2"
            {...register('notes')}
          />
        </div>
        {createBooking.isError && (
          <p role="alert" className="text-accent text-sm">
            {createBooking.error instanceof ApiError
              ? createBooking.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}
        <Button type="submit" disabled={selectedTableId === null || createBooking.isPending}>
          {createBooking.isPending ? 'Booking…' : 'Confirm booking'}
        </Button>
      </form>
    </div>
  );
}
