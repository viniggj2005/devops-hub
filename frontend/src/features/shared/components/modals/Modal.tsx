import { CircleX } from 'lucide-react';
import { createPortal } from 'react-dom';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

export interface ModalProps {
    title: string;
    isOpen: boolean;
    className?: string;
    onClose: () => void;
    description?: string;
    icon?: React.ReactNode;
    footer?: React.ReactNode;
    theme?: 'light' | 'dark';
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
    icon,
    title,
    isOpen,
    footer,
    onClose,
    children,
    description,
    size = 'md',
    className = '',
}) => {
    const { dictionary } = useTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getSizeClasses = () => {
        switch (size) {
            case 'sm': return 'max-w-md';
            case 'lg': return 'max-w-4xl';
            case 'xl': return 'max-w-6xl';
            case 'full': return 'max-w-[95vw] h-[95vh]';
            case 'md':
            default: return 'max-w-2xl';
        }
    };

    const modalContent = (
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center
      bg-white/60 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            aria-modal
            role="dialog"
            aria-labelledby="modal-title"
        >
            <div
                ref={dialogRef}
                onClick={(event) => event.stopPropagation()}
                className={`relative w-full ${getSizeClasses()} 
          bg-white dark:bg-[#0f172a]/95 dark:backdrop-blur-2xl
          rounded-2xl border border-gray-200 dark:border-white/5
          shadow-2xl text-black dark:text-white flex flex-col max-h-[90vh] 
          transform transition-all animate-in zoom-in-95 duration-200 ${className}`}
            >
                <div className="flex-none flex items-center rounded-t-2xl gap-3 border-b
         border-gray-100 dark:border-white/5 px-5 py-4
         bg-gray-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-2">
                        {icon ? (
                            <div className="flex items-center justify-center">
                                {icon}
                            </div>
                        ) : (
                            <span className="inline-block h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                        )}
                        <h2 id="modal-title" className="text-sm font-semibold tracking-wide text-gray-900 dark:text-white uppercase">
                            {title}
                        </h2>
                        {description && (
                            <>
                                <span className="text-gray-300 dark:text-gray-700 mx-1">|</span>
                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 font-mono tracking-tight">{description}</span>
                            </>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="ml-auto text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 rounded-lg p-1 transition-colors"
                        title={dictionary.app.common.close}
                        aria-label={dictionary.app.common.closeModal}
                    >
                        <CircleX className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {children}
                </div>

                {footer && (
                    <div className="flex-none border-t border-gray-100 dark:border-white/5 p-4 bg-gray-50/50 dark:bg-white/5 rounded-b-2xl flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
