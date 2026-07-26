import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlots } from '../hooks/useSlots';
import { Button } from '../components/Button';

export default function Home() {
  const { data: slots, isLoading, isError } = useSlots();
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [partySize, setPartySize] = useState('');
  const [slotId, setSlotId] = useState('');

  const canSubmit = date !== '' && partySize !== '' && slotId !== '';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const params = new URLSearchParams({ date, partySize, slotId });
    navigate(`/book?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex items-center px-6">
      <div className="max-w-md w-full mx-auto">
        <h1 className="font-display text-3xl font-semibold mb-2">Reserve a table</h1>
        <p className="text-text/70 mb-6">
          Pick a date, party size, and time — we&apos;ll find your table.
        </p>
        {isError && (
          <p role="alert" className="text-accent mb-4">
            Couldn&apos;t load time slots. Please try again.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium mb-1">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded border border-border px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="partySize" className="block text-sm font-medium mb-1">
              Party size
            </label>
            <input
              id="partySize"
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className="w-full rounded border border-border px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="slotId" className="block text-sm font-medium mb-1">
              Time
            </label>
            <select
              id="slotId"
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
              className="w-full rounded border border-border px-3 py-2"
              required
              disabled={isLoading}
            >
              <option value="" disabled>
                Select a time
              </option>
              {slots?.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!canSubmit}>
            Check availability
          </Button>
        </form>
      </div>
    </div>
  );
}
