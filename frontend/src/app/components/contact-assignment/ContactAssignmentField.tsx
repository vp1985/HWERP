import { useEffect, useMemo, useState } from 'react';

export type ContactAssignmentOptionType = 'customer' | 'contactPerson' | 'customerContact' | 'location' | 'asset';

export interface ContactAssignmentOption {
  id: string;
  label: string;
  type?: ContactAssignmentOptionType;
}

export function filterContactAssignmentOptions(options: ContactAssignmentOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return options.slice(0, 10);
  return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery)).slice(0, 10);
}

export function ContactAssignmentField({
  label,
  placeholder,
  value,
  options,
  onChange,
  onCreateNew,
  createLabel = 'Neu anlegen',
  warning,
  onWarningAction,
  warningActionLabel = 'Verknüpfung erstellen',
  disabled = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: ContactAssignmentOption[];
  onChange: (value: string) => void;
  onCreateNew?: () => void;
  createLabel?: string;
  warning?: string | null;
  onWarningAction?: () => void;
  warningActionLabel?: string;
  disabled?: boolean;
}) {
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.label ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const inputId = `assignment-${label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  const listboxId = `${inputId}-listbox`;

  useEffect(() => {
    if (!isOpen) setQuery(selectedOption?.label ?? '');
  }, [isOpen, selectedOption?.label]);

  const filteredOptions = useMemo(() => filterContactAssignmentOptions(options, query), [options, query]);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">{label}</label>
          <input
            id={inputId}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-disabled={disabled}
            disabled={disabled}
            className={`w-full border rounded-lg px-3 py-2 pr-9 text-sm ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
            placeholder={placeholder}
            value={query}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
            onChange={(event) => {
              if (disabled) return;
              setQuery(event.target.value);
              setIsOpen(true);
              if (value) onChange('');
            }}
          />
          {value && (
            <button
              type="button"
              aria-label={`${label} entfernen`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange('');
                setQuery('');
                setIsOpen(true);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              ×
            </button>
          )}
          {isOpen && !disabled && (
            <div id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-gray-500">Kein Treffer</div>
              ) : filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option.id);
                    setQuery(option.label);
                    setIsOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left hover:bg-blue-50 ${option.id === value ? 'bg-blue-100 text-blue-900' : 'text-gray-800'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            + {createLabel}
          </button>
        )}
      </div>
      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div>{warning}</div>
          {onWarningAction && (
            <button type="button" onClick={onWarningAction} className="mt-1 font-semibold underline">
              {warningActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
