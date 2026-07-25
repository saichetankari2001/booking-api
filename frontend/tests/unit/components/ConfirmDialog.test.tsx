import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and description when open, and calls onConfirm on click', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel this booking?"
        description="This can't be undone."
        confirmLabel="Confirm cancellation"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when dismissed', async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel this booking?"
        description="This can't be undone."
        confirmLabel="Confirm cancellation"
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Never mind' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Cancel this booking?"
        description="This can't be undone."
        confirmLabel="Confirm cancellation"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText('Cancel this booking?')).not.toBeInTheDocument();
  });
});
