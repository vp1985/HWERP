import React, { useCallback } from 'react';
import { X, Car, Info } from 'lucide-react';
import { CalculationLineItem } from '../lib/types';
import { useModalClose } from '../hooks/useModalClose';

interface AdjustReturnTripDialogProps {
  open: boolean;
  onClose: () => void;
  existingReturnItems: CalculationLineItem[];
  newAssetName: string;
  onRemoveReturn: (ids: string[]) => void;
}

export default function AdjustReturnTripDialog({
  open,
  onClose,
  existingReturnItems,
  newAssetName,
  onRemoveReturn,
}: AdjustReturnTripDialogProps) {
  const handleClose = useCallback(() => onClose(), [onClose]);
  const handleBackdrop = useModalClose(open, handleClose);

  if (!open) return null;

  const handleRemove = () => {
    onRemoveReturn(existingReturnItems.map((i) => i.id));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Car size={18} className="text-blue-500" />
            <h2 className="text-lg font-bold">Rückfahrt anpassen</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              Es existiert{existingReturnItems.length > 1 ? 'en' : ''} bereits{' '}
              <strong>{existingReturnItems.length} Rückfahrt-Position{existingReturnItems.length > 1 ? 'en' : ''}</strong>
              {' '}von einem vorherigen Asset. Da jetzt{' '}
              <strong>{newAssetName}</strong> hinzugefügt wird, könnte die Rückfahrt
              gemeinsam genutzt werden.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Bestehende Rückfahrten:</p>
            {existingReturnItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"
              >
                <Car size={13} className="text-blue-400 shrink-0" />
                {item.description}
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-600">
            Soll{existingReturnItems.length > 1 ? 'en' : ''} die vorhandene{existingReturnItems.length > 1 ? 'n' : ''} Rückfahrt-Position{existingReturnItems.length > 1 ? 'en' : ''} entfernt werden?
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Behalten
          </button>
          <button
            onClick={handleRemove}
            className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Rückfahrt entfernen
          </button>
        </div>
      </div>
    </div>
  );
}
