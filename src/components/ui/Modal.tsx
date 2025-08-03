/**
 * Modal Component - Material Design 3 기반
 * Motion Connect HR System Design System
 */

'use client';

import React, { forwardRef, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ModalProps } from '@/lib/design-system/types';

// Modal 컴포넌트의 CSS 클래스 생성 함수
const getModalClasses = (
  size: ModalProps['size'] = 'md',
  centered: boolean = false
): string => {
  const baseClasses = [
    'fixed inset-0 z-50 flex',
    centered ? 'items-center justify-center' : 'items-start justify-center pt-16',
    'p-4',
  ];

  return baseClasses.join(' ');
};

const getModalContentClasses = (
  size: ModalProps['size'] = 'md'
): string => {
  const baseClasses = [
    'relative bg-surface-primary rounded-xl shadow-elevation-3',
    'max-h-full overflow-hidden',
    'transform transition-all duration-normal ease-standard',
    'flex flex-col',
  ];

  // Size classes
  const sizeClasses = {
    xs: 'w-full max-w-xs',
    sm: 'w-full max-w-md',
    md: 'w-full max-w-lg',
    lg: 'w-full max-w-2xl',
    xl: 'w-full max-w-4xl',
    '2xl': 'w-full max-w-6xl',
    '3xl': 'w-full max-w-7xl',
    '4xl': 'w-full max-w-screen-xl',
    '5xl': 'w-full max-w-screen-2xl',
    auto: 'w-auto max-w-4xl',
    full: 'w-full max-w-full h-full max-h-full rounded-none',
  };

  return [
    ...baseClasses,
    sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.md,
  ].join(' ');
};

// Backdrop component
const Backdrop = forwardRef<HTMLDivElement, {
  onClick?: () => void;
  className?: string;
}>(({ onClick, className = '' }, ref) => {
  const backdropClasses = cn(
    'fixed inset-0 bg-black/60 backdrop-blur-sm',
    'transition-opacity duration-normal ease-standard',
    className
  );
  
  return (
    <div
      ref={ref}
      className={backdropClasses}
      onClick={onClick}
      aria-hidden="true"
    />
  );
});

Backdrop.displayName = 'Backdrop';

// Modal Header component
export const ModalHeader = forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  showCloseButton?: boolean;
  onClose?: () => void;
}>(({ children, className = '', style, showCloseButton = true, onClose }, ref) => {
  const headerClasses = cn(
    'flex items-center justify-between p-6 border-b border-neutral-200',
    className
  );
  
  return (
    <div ref={ref} className={headerClasses} style={style}>
      <div className="flex-1">
        {children}
      </div>
      {showCloseButton && (
        <button
          type="button"
          className={cn(
            'ml-4 p-2 rounded-md',
            'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100',
            'focus:outline-none focus:ring-2 focus:ring-primary-500',
            'transition-colors duration-fast ease-standard'
          )}
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
});

ModalHeader.displayName = 'ModalHeader';

// Modal Title component
export const ModalTitle = forwardRef<HTMLHeadingElement, {
  children: React.ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}>(({ children, level = 2, className = '', style, ...props }, ref) => {
  const titleClasses = cn(
    'text-headline-small font-semibold text-text-primary leading-tight',
    className
  );
  
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  const titleElement = React.createElement(Tag, {
    ref,
    className: titleClasses,
    style,
    ...props
  }, children);
  
  return titleElement;
});

ModalTitle.displayName = 'ModalTitle';

// Modal Body component
export const ModalBody = forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  scrollable?: boolean;
}>(({ children, className = '', style, scrollable = true }, ref) => {
  const bodyClasses = `p-6 ${scrollable ? 'overflow-y-auto flex-1' : ''} ${className}`.trim();
  
  return (
    <div ref={ref} className={bodyClasses} style={style}>
      {children}
    </div>
  );
});

ModalBody.displayName = 'ModalBody';

// Modal Footer component
export const ModalFooter = forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  align?: 'left' | 'center' | 'right' | 'between';
}>(({ children, className = '', style, align = 'right' }, ref) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };
  
  const footerClasses = cn(
    'flex items-center gap-3 p-6 border-t border-neutral-200 bg-surface-secondary',
    alignClasses[align],
    className
  );
  
  return (
    <div ref={ref} className={footerClasses} style={style}>
      {children}
    </div>
  );
});

ModalFooter.displayName = 'ModalFooter';

// Main Modal component
export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({
    open,
    onClose,
    size = 'md',
    centered = false,
    closeOnBackdropClick = true,
    closeOnEsc = true,
    showCloseButton = true,
    title,
    footer,
    children,
    className = '',
    style,
    zIndex = 1000,
    'data-testid': testId,
    ...props
  }, ref) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle escape key
    const handleEscKey = useCallback((event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    }, [closeOnEsc, onClose]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((event: React.MouseEvent) => {
      if (closeOnBackdropClick && event.target === event.currentTarget) {
        onClose();
      }
    }, [closeOnBackdropClick, onClose]);

    // Focus management
    useEffect(() => {
      if (open) {
        // Add escape key listener
        document.addEventListener('keydown', handleEscKey);
        
        // Focus the modal
        if (modalRef.current) {
          modalRef.current.focus();
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        return () => {
          document.removeEventListener('keydown', handleEscKey);
          document.body.style.overflow = '';
        };
      }
    }, [open, handleEscKey]);

    if (!open) {
      return null;
    }

    const modalClasses = getModalClasses(size, centered);
    const contentClasses = getModalContentClasses(size);
    const combinedContentClasses = `${contentClasses} ${className}`.trim();

    const modalContent = (
      <div
        className={modalClasses}
        style={{ zIndex }}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${testId}-title` : undefined}
        data-testid={testId}
      >
        <Backdrop />
        <div
          ref={modalRef}
          className={combinedContentClasses}
          style={style}
          tabIndex={-1}
          {...props}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <ModalHeader showCloseButton={showCloseButton} onClose={onClose}>
              {title && (
                <ModalTitle id={`${testId}-title`}>
                  {title}
                </ModalTitle>
              )}
            </ModalHeader>
          )}

          {/* Body */}
          <ModalBody>
            {children}
          </ModalBody>

          {/* Footer */}
          {footer && (
            <ModalFooter>
              {footer}
            </ModalFooter>
          )}
        </div>
      </div>
    );

    // Render in portal
    if (typeof window !== 'undefined') {
      return createPortal(modalContent, document.body);
    }

    return null;
  }
);

Modal.displayName = 'Modal';

// Export compound component with sub-components
const ModalComponent = Modal as typeof Modal & {
  Header: typeof ModalHeader;
  Title: typeof ModalTitle;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
};

ModalComponent.Header = ModalHeader;
ModalComponent.Title = ModalTitle;
ModalComponent.Body = ModalBody;
ModalComponent.Footer = ModalFooter;

export default ModalComponent;