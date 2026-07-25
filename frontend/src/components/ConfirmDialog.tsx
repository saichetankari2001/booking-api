import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-background border border-border p-6 w-full max-w-sm">
          <Dialog.Title className="font-display text-lg font-semibold mb-2">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-text/70 mb-6">
            {description}
          </Dialog.Description>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" type="button">
                Never mind
              </Button>
            </Dialog.Close>
            <Button type="button" onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? 'Please wait…' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
