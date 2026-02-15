import React from 'react';
import { cn } from '../utils/cn';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass';
};

const paddingClass: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClass: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 shadow-lg',
  glass: 'bg-white/70 dark:bg-neutral-900/60 backdrop-blur-xl border-white/20 dark:border-white/5 shadow-xl',
};

export const Card: React.FC<CardProps> = ({ className, padding = 'md', variant = 'default', ...props }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-300',
        paddingClass[padding],
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
};

