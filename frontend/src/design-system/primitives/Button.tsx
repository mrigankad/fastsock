import React from 'react';
import { cn } from '../utils/cn';
import { Spinner } from './Loader';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const base =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-neutral-0 hover:bg-brand-primaryHover',
  secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100',
  icon: 'bg-transparent text-neutral-600 hover:bg-neutral-100 rounded-full',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-11 px-5 text-base rounded-md',
};

const iconSizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
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
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading && <Spinner size="sm" className={variant === 'primary' ? 'border-neutral-200 border-t-neutral-0' : ''} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

