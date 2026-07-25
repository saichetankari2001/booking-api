import { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded px-4 py-2 text-sm font-medium font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-accent text-background hover:bg-accent/90',
        variant === 'secondary' && 'border border-accent text-accent bg-transparent hover:bg-accent/10',
        className,
      )}
      {...props}
    />
  );
}
