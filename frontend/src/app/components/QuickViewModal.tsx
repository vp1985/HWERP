import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface QuickViewModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

/**
 * QuickViewModal - Schnell schließbares Modal für Preview-Inhalte
 *
 * Features:
 * - Schließt auf Overlay-Klick
 * - Schließt auf ESC-Taste
 * - Schließt auf X-Button
 * - Scrollbar im Content bei Bedarf
 */
export function QuickViewModal({
  open,
  title,
  onClose,
  children,
  maxWidth = '900px'
}: QuickViewModalProps) {
  // ESC-Handler
  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  // Body scroll lock bei geöffnetem Modal
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className="relative bg-white rounded-lg shadow-lg w-full mx-4 animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content mit Scroll */}
        <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
