import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * SearchableSelect - Wiederverwendbares durchsuchbares Dropdown
 *
 * DEV: Generische Komponente für alle Zuordnungs-Dropdowns (Parent, Kunde, Standort, Ansprechpartner).
 * Click-outside schließt das Dropdown, Autofokus auf Suchfeld beim Öffnen.
 *
 * Gruppen-Feature (suggestedIds):
 * Wenn suggestedIds angegeben und nicht leer, werden Optionen in zwei Gruppen dargestellt:
 * - Oben: "Zugeordnet"-Gruppe mit den vorgeschlagenen Optionen
 * - Unten: "Weitere"-Gruppe mit den restlichen Optionen (leicht abgeschwächt)
 * Damit bleiben ungewöhnliche Zuordnungen möglich, aber die relevanten stehen prominent oben.
 */

export interface SearchableSelectOption {
  id: string;
  label: string;
  /** Optionaler Subtext (z.B. Adresse, Rolle) */
  sublabel?: string;
}

interface SearchableSelectProps {
  /** Optional DOM id for the trigger button */
  id?: string;
  /** Aktuell gewählte ID (null = nichts gewählt) */
  value: string | null;
  /** Callback bei Auswahl */
  onChange: (id: string | null) => void;
  /** Verfügbare Optionen */
  options: SearchableSelectOption[];
  /** Placeholder-Text wenn nichts gewählt */
  placeholder?: string;
  /** Text für die "Nichts gewählt"-Option */
  emptyOptionLabel?: string;
  /** Suchfeld-Placeholder */
  searchPlaceholder?: string;
  /** Schlüsselwörter, bei denen die leere Option auch bei Suche angezeigt wird */
  emptyOptionKeywords?: string[];
  /** IDs der vorgeschlagenen/zugeordneten Optionen (werden oben gruppiert angezeigt) */
  suggestedIds?: Set<string>;
  /** Titel für die vorgeschlagene Gruppe */
  suggestedGroupLabel?: string;
  /** Titel für die restliche Gruppe */
  otherGroupLabel?: string;
}

export default function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Bitte wählen...',
  emptyOptionLabel = 'Keine Auswahl',
  searchPlaceholder = 'Suchen...',
  emptyOptionKeywords = [],
  suggestedIds,
  suggestedGroupLabel = 'Zugeordnet',
  otherGroupLabel = 'Weitere',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click-outside: Dropdown schließen
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Autofokus auf Suchfeld beim Öffnen
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = value ? options.find((o) => o.id === value) : null;
  const searchLower = search.toLowerCase();

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(searchLower) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(searchLower))
  );

  // Gruppen: Vorgeschlagene vs. Rest
  const hasGroups = suggestedIds && suggestedIds.size > 0;
  const suggestedOptions = hasGroups
    ? filteredOptions.filter((o) => suggestedIds.has(o.id))
    : [];
  const otherOptions = hasGroups
    ? filteredOptions.filter((o) => !suggestedIds.has(o.id))
    : filteredOptions;

  // Leere Option anzeigen wenn Suche leer oder Keyword passt
  const showEmptyOption =
    !search ||
    emptyOptionLabel.toLowerCase().includes(searchLower) ||
    emptyOptionKeywords.some((kw) => kw.toLowerCase().includes(searchLower));

  const noResults =
    search && filteredOptions.length === 0 && !showEmptyOption;

  const handleSelect = (id: string | null) => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
  };

  /** Rendert eine einzelne Option als <li> */
  const renderOption = (option: SearchableSelectOption, muted = false) => (
    <li key={option.id}>
      <button
        type="button"
        onClick={() => handleSelect(option.id)}
        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
          value === option.id
            ? 'bg-blue-50 text-blue-700'
            : muted
              ? 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              : 'text-gray-900 hover:bg-gray-100'
        }`}
      >
        <span>{option.label}</span>
        {option.sublabel && (
          <span className="block text-xs text-gray-400 mt-0.5">{option.sublabel}</span>
        )}
      </button>
    </li>
  );

  /** Rendert einen Gruppen-Header */
  const renderGroupHeader = (label: string) => (
    <li key={`group-${label}`} className="px-4 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider select-none">
      {label}
    </li>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-10 bg-white border border-gray-300 rounded-lg shadow-lg mt-1 overflow-hidden">
          {/* Suchfeld */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full outline-none bg-transparent text-sm"
            />
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {/* Leere Option */}
            {showEmptyOption && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    !value
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {emptyOptionLabel}
                </button>
              </li>
            )}

            {/* Gruppierte Darstellung */}
            {hasGroups ? (
              <>
                {/* Vorgeschlagene Gruppe */}
                {suggestedOptions.length > 0 && (
                  <>
                    {renderGroupHeader(suggestedGroupLabel)}
                    {suggestedOptions.map((o) => renderOption(o, false))}
                  </>
                )}

                {/* Trenner zwischen den Gruppen */}
                {suggestedOptions.length > 0 && otherOptions.length > 0 && (
                  <li className="my-1 border-t border-gray-200" />
                )}

                {/* Rest-Gruppe */}
                {otherOptions.length > 0 && (
                  <>
                    {renderGroupHeader(otherGroupLabel)}
                    {otherOptions.map((o) => renderOption(o, true))}
                  </>
                )}
              </>
            ) : (
              /* Ungroupierte Darstellung (kein Filter aktiv) */
              filteredOptions.map((o) => renderOption(o, false))
            )}

            {/* Keine Treffer */}
            {noResults && (
              <li className="px-4 py-3 text-sm text-gray-400 text-center">
                Keine Treffer
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
