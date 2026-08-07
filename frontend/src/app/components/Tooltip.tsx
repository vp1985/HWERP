import { Info } from 'lucide-react';
import { useState } from 'react';

/**
 * Tooltip - Generische Komponente für Benutzerhinweise
 *
 * Motivation: Zentrale Komponente für User-Tooltips, die normale Hilfe/Erklärungen
 * bieten. Keine "DEV:"-Präfixe, da für Endanwender gedacht.
 *
 * Für Entwicklerhinweise: DevTooltip verwenden (Wrapper um diese Komponente).
 */

type Placement = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  text: string;
  placement?: Placement;
  maxWidth?: number;
}

export default function Tooltip({
  text,
  placement = 'top',
  maxWidth = 320
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Position CSS-Klassen basierend auf placement
  const getPositionClasses = (): string => {
    switch (placement) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  return (
    <div className="inline-block relative">
      {/* Info Icon - Hover + Click Support */}
      <button
        type="button"
        className="inline-flex items-center justify-center cursor-help focus:outline-none"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        aria-label="Information"
      >
        <Info size={16} className="text-blue-500 hover:text-blue-600 transition-colors" />
      </button>

      {/* Tooltip Content */}
      {isOpen && (
        <div
          className={`absolute z-50 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg transition-opacity ${getPositionClasses()}`}
          style={{ maxWidth: `${maxWidth}px` }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {text}
        </div>
      )}
    </div>
  );
}
