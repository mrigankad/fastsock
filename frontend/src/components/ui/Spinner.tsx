import React from 'react';
import { cn } from '../../utils/cn';

export type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'aria-label'?: string;
};

const sizeClass: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-6 w-6 border-2',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Loading',
}) => {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'animate-spin rounded-full border-neutral-300 border-t-brand-primary',
        sizeClass[size],
        className,
      )}
    />
  );
};
