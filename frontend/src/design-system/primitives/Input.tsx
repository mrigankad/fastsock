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
          'w-full rounded-xl border border-neutral-200 bg-white/50 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 shadow-sm backdrop-blur-sm transition-all duration-200',
          'dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-100',
          'focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-brand-primary/10 focus:outline-none dark:focus:bg-neutral-800',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid ? 'border-semantic-error focus:border-semantic-error focus:ring-semantic-error/10' : '',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

