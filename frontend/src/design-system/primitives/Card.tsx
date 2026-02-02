import React from 'react';
import { cn } from '../utils/cn';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const paddingClass: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({ className, padding = 'md', ...props }) => {
  return (
    <div
      className={cn('rounded-lg border border-neutral-200 bg-neutral-0 shadow-md', paddingClass[padding], className)}
      {...props}
    />
  );
};

