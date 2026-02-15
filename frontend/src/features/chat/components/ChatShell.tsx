import React from 'react';
import { cn } from '../../../design-system/utils/cn';

export type ChatShellProps = {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  right?: React.ReactNode;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  isRightPanelOpen: boolean;
};

export const ChatShell: React.FC<ChatShellProps> = ({
  sidebar,
  main,
  right,
  isSidebarOpen,
  onCloseSidebar,
  isRightPanelOpen,
}) => {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[var(--color-bg-app)] flex">
      <div className="flex h-full w-full overflow-hidden bg-[var(--color-surface)]">
        {/* Sidebar Panel */}
        <div
          className={cn(
            "flex w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:w-[320px] lg:w-[380px] xl:w-[400px] md:flex-shrink-0 transition-all duration-300",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            "absolute inset-y-0 left-0 z-20 md:relative"
          )}
        >
          {sidebar}
        </div>

        {/* Main Chat Panel */}
        <div className="flex flex-1 min-w-0 flex-col relative z-0">
          {main}
        </div>

        {/* Right Panel (Info) */}
        {right && isRightPanelOpen && (
          <div className="hidden border-l border-[var(--color-border)] bg-[var(--color-surface)] lg:block lg:w-[320px] xl:w-[360px]">
            {right}
          </div>
        )}
      </div>


      {/* Mobile Overlay for Sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 md:hidden"
          onClick={onCloseSidebar}
        />
      )}
    </div>
  );
};
