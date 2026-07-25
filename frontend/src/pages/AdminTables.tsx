import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAdminTables,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
} from '../hooks/useAdminTables';
import { createTableFormSchema, CreateTableFormInput } from '../lib/schemas/table.schema';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ApiError } from '../api/apiClient';
import { Table } from '../api/types';

export default function AdminTables() {
  const { data: tables, isLoading, isError } = useAdminTables();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ name: '', capacity: '', description: '' });
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTableFormInput>({ resolver: zodResolver(createTableFormSchema) });

  function startEdit(table: Table) {
    setEditingId(table.id);
    setEditValues({
      name: table.name,
      capacity: String(table.capacity),
      description: table.description ?? '',
    });
  }

  function saveEdit(id: number) {
    setEditError(null);
    updateTable.mutate(
      {
        id,
        payload: {
          name: editValues.name,
          capacity: Number(editValues.capacity),
          description: editValues.description,
        },
      },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => {
          setEditError(err instanceof ApiError ? err.message : 'Could not save table.');
        },
      },
    );
  }

  async function onCreate(values: CreateTableFormInput) {
    try {
      await createTable.mutateAsync(values);
      setCreateError(null);
      reset();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create table.');
    }
  }

  function confirmDelete() {
    if (deleteTargetId === null) return;
    setDeleteError(null);
    deleteTable.mutate(deleteTargetId, {
      onSuccess: () => setDeleteTargetId(null),
      onError: (err) => {
        setDeleteError(err instanceof ApiError ? err.message : 'Could not delete table.');
      },
    });
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display text-2xl font-semibold mb-6">Tables</h1>

      <form onSubmit={handleSubmit(onCreate)} className="flex gap-3 items-end mb-8">
        <div>
          <label htmlFor="new-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="new-name"
            className="rounded border border-border px-3 py-2"
            {...register('name')}
          />
          {errors.name && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-capacity" className="block text-sm font-medium mb-1">
            Capacity
          </label>
          <input
            id="new-capacity"
            type="number"
            className="rounded border border-border px-3 py-2 w-24"
            {...register('capacity')}
          />
          {errors.capacity && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.capacity.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <input
            id="new-description"
            className="rounded border border-border px-3 py-2"
            {...register('description')}
          />
        </div>
        <Button type="submit">Add table</Button>
      </form>

      {createError && (
        <p role="alert" className="text-accent mb-4">
          {createError}
        </p>
      )}

      {isLoading && <p>Loading tables…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load tables.
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

      {tables && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-sm text-text/70">
              <th className="py-2">Name</th>
              <th className="py-2">Capacity</th>
              <th className="py-2">Description</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) =>
              editingId === table.id ? (
                <tr key={table.id} className="border-b border-border">
                  <td className="py-2">
                    <input
                      aria-label="Edit name"
                      value={editValues.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit capacity"
                      type="number"
                      value={editValues.capacity}
                      onChange={(e) => setEditValues((v) => ({ ...v, capacity: e.target.value }))}
                      className="rounded border border-border px-2 py-1 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit description"
                      value={editValues.description}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, description: e.target.value }))
                      }
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="py-2 flex gap-2">
                    <Button onClick={() => saveEdit(table.id)}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={table.id} className="border-b border-border">
                  <td className="py-2">{table.name}</td>
                  <td className="py-2">{table.capacity}</td>
                  <td className="py-2">{table.description}</td>
                  <td className="py-2 flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(table)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => setDeleteTargetId(table.id)}>
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
        title="Delete this table?"
        description="This can't be undone. Tables with future confirmed bookings can't be deleted."
        confirmLabel="Delete table"
        isConfirming={deleteTable.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
