import React from 'react';
import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import { cn } from '../../utils/cn';

export interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof RadixScrollArea.Root> {
  viewportClassName?: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
  scrollBarClassName?: string;
  viewportRef?: React.Ref<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ 
  className, 
  children, 
  viewportClassName,
  orientation = 'vertical',
  scrollBarClassName,
  viewportRef,
  onScroll,
  ...props 
}) => {
  return (
    <RadixScrollArea.Root
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <RadixScrollArea.Viewport 
        ref={viewportRef}
        onScroll={onScroll}
        className={cn('h-full w-full rounded-[inherit]', viewportClassName)}
      >
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar
        orientation={orientation === 'both' ? 'vertical' : orientation}
        className={cn(
          'flex touch-none select-none transition-colors',
          orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
          orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
          scrollBarClassName
        )}
      >
        <RadixScrollArea.Thumb className="relative flex-1 rounded-full bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500" />
      </RadixScrollArea.Scrollbar>
      {orientation === 'both' && (
         <RadixScrollArea.Scrollbar
         orientation="horizontal"
         className={cn(
           'flex touch-none select-none transition-colors h-2.5 flex-col border-t border-t-transparent p-[1px]',
           scrollBarClassName
         )}
       >
         <RadixScrollArea.Thumb className="relative flex-1 rounded-full bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500" />
       </RadixScrollArea.Scrollbar>
      )}
      <RadixScrollArea.Corner />
    </RadixScrollArea.Root>
  );
};
