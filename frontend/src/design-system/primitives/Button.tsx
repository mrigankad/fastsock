import React from 'react';
import { cn } from '../utils/cn';
import { Spinner } from './Loader';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95';

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] hover:bg-[var(--color-brand-primary-hover)] text-white shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:shadow-brand-primary/40 hover:-translate-y-0.5 border border-transparent',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] shadow-sm hover:shadow-md',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-primary)]',
  icon: 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-accent)] rounded-full transition-colors',
  danger: 'bg-semantic-error text-white shadow-lg shadow-semantic-error/25 hover:bg-red-600 hover:shadow-xl hover:shadow-semantic-error/40',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg uppercase tracking-wide',
  md: 'h-10 px-5 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
};

const iconSizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-1.5',
  md: 'h-10 w-10 p-2',
  lg: 'h-12 w-12 p-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(
          base,
          variantClass[variant],
          variant === 'icon' ? iconSizeClass[size] : sizeClass[size],
          loading && 'cursor-wait opacity-70',
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <Spinner
            size="sm"
            className={variant === 'primary' || variant === 'danger' ? 'border-white/30 border-t-white' : ''}
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
