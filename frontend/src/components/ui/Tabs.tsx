import React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '../../utils/cn';

export type TabsProps = React.ComponentPropsWithoutRef<typeof RadixTabs.Root>;
export const Tabs: React.FC<TabsProps> = ({ className, children, ...props }) => {
  return (
    <RadixTabs.Root className={cn('w-full', className)} {...props}>
      {children}
    </RadixTabs.Root>
  );
};

export type TabsListProps = React.ComponentPropsWithoutRef<typeof RadixTabs.List>;
export const TabsList: React.FC<TabsListProps> = ({ className, children, ...props }) => {
  return (
    <RadixTabs.List
      className={cn('flex border-b border-neutral-200 dark:border-gray-700', className)}
      {...props}
    >
      {children}
    </RadixTabs.List>
  );
};

export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>;
export const TabsTrigger: React.FC<TabsTriggerProps> = ({ className, children, ...props }) => {
  return (
    <RadixTabs.Trigger
      className={cn(
        'flex-1 py-3 text-sm font-medium transition-colors data-[state=active]:border-b-2',
        'data-[state=active]:text-blue-600 data-[state=active]:border-blue-600',
        'dark:data-[state=active]:text-blue-400 dark:data-[state=active]:border-blue-400',
        'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
        className,
      )}
      {...props}
    >
      {children}
    </RadixTabs.Trigger>
  );
};

export type TabsContentProps = React.ComponentPropsWithoutRef<typeof RadixTabs.Content>;
export const TabsContent: React.FC<TabsContentProps> = ({ className, children, ...props }) => {
  return (
    <RadixTabs.Content className={cn('outline-none', className)} {...props}>
      {children}
    </RadixTabs.Content>
  );
};
