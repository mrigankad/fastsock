import React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from '../../utils/cn';

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof RadixAvatar.Root> {
  src?: string;
  fallback: React.ReactNode;
  alt?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, alt, className, ...props }) => {
  return (
    <RadixAvatar.Root
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      <RadixAvatar.Image
        className="aspect-square h-full w-full object-cover"
        src={src}
        alt={alt}
      />
      <RadixAvatar.Fallback
        className="flex h-full w-full items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400"
        delayMs={600}
      >
        {fallback}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
};
