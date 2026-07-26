import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAdminSlots, useCreateSlot, useUpdateSlot, useDeleteSlot } from '../hooks/useAdminSlots';
import { createSlotFormSchema, CreateSlotFormInput } from '../lib/schemas/slot.schema';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ApiError } from '../api/apiClient';
import { Slot } from '../api/types';

export default function AdminSlots() {
  const { data: slots, isLoading, isError } = useAdminSlots();
  const createSlot = useCreateSlot();
  const updateSlot = useUpdateSlot();
  const deleteSlot = useDeleteSlot();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    label: '',
    startTime: '',
    durationMinutes: '',
    isActive: true,
  });
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSlotFormInput>({ resolver: zodResolver(createSlotFormSchema) });

  function startEdit(slot: Slot) {
    setEditingId(slot.id);
    setEditValues({
      label: slot.label,
      startTime: slot.startTime,
      durationMinutes: String(slot.durationMinutes),
      isActive: slot.isActive,
    });
  }

  function saveEdit(id: number) {
    setEditError(null);
    updateSlot.mutate(
      {
        id,
        payload: {
          label: editValues.label,
          startTime: editValues.startTime,
          durationMinutes: Number(editValues.durationMinutes),
          isActive: editValues.isActive,
        },
      },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => {
          setEditError(err instanceof ApiError ? err.message : 'Could not save slot.');
        },
      },
    );
  }

  async function onCreate(values: CreateSlotFormInput) {
    try {
      await createSlot.mutateAsync(values);
      setCreateError(null);
      reset();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create slot.');
    }
  }

  function confirmDelete() {
    if (deleteTargetId === null) return;
    setDeleteError(null);
    deleteSlot.mutate(deleteTargetId, {
      onSuccess: () => setDeleteTargetId(null),
      onError: (err) => {
        setDeleteError(err instanceof ApiError ? err.message : 'Could not delete slot.');
      },
    });
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display text-2xl font-semibold mb-6">Time Slots</h1>

      <form onSubmit={handleSubmit(onCreate)} className="flex gap-3 items-end mb-8">
        <div>
          <label htmlFor="new-label" className="block text-sm font-medium mb-1">
            Label
          </label>
          <input
            id="new-label"
            className="rounded border border-border px-3 py-2"
            {...register('label')}
          />
          {errors.label && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.label.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-startTime" className="block text-sm font-medium mb-1">
            Start time
          </label>
          <input
            id="new-startTime"
            placeholder="HH:MM"
            className="rounded border border-border px-3 py-2 w-24"
            {...register('startTime')}
          />
          {errors.startTime && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.startTime.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-durationMinutes" className="block text-sm font-medium mb-1">
            Duration (min)
          </label>
          <input
            id="new-durationMinutes"
            type="number"
            className="rounded border border-border px-3 py-2 w-24"
            {...register('durationMinutes')}
          />
          {errors.durationMinutes && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.durationMinutes.message}
            </p>
          )}
        </div>
        <Button type="submit">Add slot</Button>
      </form>

      {createError && (
        <p role="alert" className="text-accent mb-4">
          {createError}
        </p>
      )}

      {isLoading && <p>Loading slots…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load slots.
        </p>
      )}
      {deleteError && (
        <p role="alert" className="text-accent mb-4">
          {deleteError}
        </p>
      )}
      {editError && (
        <p role="alert" className="text-accent mb-4">
          {editError}
        </p>
      )}

      {slots && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-sm text-text/70">
              <th className="py-2">Label</th>
              <th className="py-2">Start</th>
              <th className="py-2">Duration</th>
              <th className="py-2">Active</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) =>
              editingId === slot.id ? (
                <tr key={slot.id} className="border-b border-border">
                  <td className="py-2">
                    <input
                      aria-label="Edit label"
                      value={editValues.label}
                      onChange={(e) => setEditValues((v) => ({ ...v, label: e.target.value }))}
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit start time"
                      value={editValues.startTime}
                      onChange={(e) => setEditValues((v) => ({ ...v, startTime: e.target.value }))}
                      className="rounded border border-border px-2 py-1 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit duration"
                      type="number"
                      value={editValues.durationMinutes}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, durationMinutes: e.target.value }))
                      }
                      className="rounded border border-border px-2 py-1 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit active"
                      type="checkbox"
                      checked={editValues.isActive}
                      onChange={(e) => setEditValues((v) => ({ ...v, isActive: e.target.checked }))}
                    />
                  </td>
                  <td className="py-2 flex gap-2">
                    <Button onClick={() => saveEdit(slot.id)}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={slot.id} className="border-b border-border">
                  <td className="py-2">{slot.label}</td>
                  <td className="py-2">{slot.startTime}</td>
                  <td className="py-2">{slot.durationMinutes} min</td>
                  <td className="py-2">{slot.isActive ? 'Yes' : 'No'}</td>
                  <td className="py-2 flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(slot)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => setDeleteTargetId(slot.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="Delete this slot?"
        description="This can't be undone. Slots with future confirmed bookings can't be deleted."
        confirmLabel="Delete slot"
        isConfirming={deleteSlot.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
