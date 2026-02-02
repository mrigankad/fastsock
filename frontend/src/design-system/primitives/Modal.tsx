import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { Button } from './Button';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer, size = 'md', className }) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className={cn('relative w-full rounded-lg bg-neutral-0 shadow-lg', sizeClass[size], className)}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div className="text-base font-semibold text-neutral-900">{title}</div>
          <Button variant="icon" size="sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="border-t border-neutral-200 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
