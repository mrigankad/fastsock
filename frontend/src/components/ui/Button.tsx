import React from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';
import { Slot } from '@radix-ui/react-slot';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'destructive' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background whitespace-nowrap text-sm';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  icon: 'hover:bg-accent hover:text-accent-foreground rounded-full',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3',
  md: 'h-10 px-4 py-2',
  lg: 'h-11 px-8',
  icon: 'h-10 w-10',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    // Handle special case for icon variant sizing to match previous API if user passes size='sm' with variant='icon'
    // But ideally, size should be 'icon'
    let appliedSize = sizeClass[size];
    if (variant === 'icon' && size !== 'icon') {
        // Map old sizes to new dimensions if needed, or just use the size class
        if (size === 'sm') appliedSize = 'h-8 w-8';
        if (size === 'md') appliedSize = 'h-10 w-10';
        if (size === 'lg') appliedSize = 'h-11 w-11';
    } else if (size === 'icon') {
        appliedSize = 'h-10 w-10';
    }

    return (
      <Comp
        ref={ref}
        className={cn(
          base,
          variantClass[variant],
          appliedSize,
          className,
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading && <Spinner size="sm" className={variant === 'primary' ? 'border-primary-foreground border-t-transparent' : ''} />}
        {children}
      </Comp>
    );
  },
);

Button.displayName = 'Button';
