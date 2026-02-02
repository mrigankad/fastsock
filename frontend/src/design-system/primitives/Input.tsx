import React from 'react';
import { cn } from '../utils/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || props['aria-invalid']}
        className={cn(
          'w-full rounded-md border border-neutral-300 bg-neutral-0 px-4 py-2 text-neutral-900 placeholder:text-neutral-400 shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50',
          invalid ? 'border-semantic-error focus:ring-semantic-error focus:border-semantic-error' : '',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

