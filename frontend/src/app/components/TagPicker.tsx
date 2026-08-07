import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Info } from 'lucide-react';
import { Tag, TagContext } from '../types/tag';
import TagBadge from './TagBadge';
import { useAppStore } from '../context/AppStoreContext';
import DevTooltip from './DevTooltip';

/**
 * TagPicker - Komponente zur Auswahl von Tags aus dem managed Tag-Katalog
 *
 * Design-Entscheidung: Es können nur bestehende Tags aus dem Katalog ausgewählt werden.
 * Keine Inline-Erstellung neuer Tags mehr. Grund: Dadurch bleiben Tags zentral verwaltet
 * und können umbenannt/gelöscht werden ohne Dateninkonsistenzen in referenzierenden Objekten.
 *
 * Statt String-Arrays (alte Variante) werden nur noch tagIds gespeichert.
 * Vorteile:
 * - Zentrale Tag-Verwaltung möglich
 * - Umbenennen wirkt sich automatisch überall aus
 * - Löschen kann blockiert werden wenn Tags in Verwendung sind
 * - Code-Feld erlaubt kompakte Darstellung (z.B. "Tx" statt "Trafo")
 *
 * Context-Aware Filtering (neu):
 * - Tags mit blockedContexts werden im Dropdown NICHT angezeigt
 * - Tags mit suggestedContexts werden prominent sortiert (oben)
 * - Bereits ausgewählte, nun blockierte Tags werden als "gesperrt" markiert
 */

interface TagPickerProps {
  context: TagContext; // PFLICHT: Kontext bestimmt Filterung/Sortierung
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  displayMode?: 'name' | 'code';
  label?: string; // Optional label für bessere Integration
  showTooltip?: boolean; // Tooltip optional, da nicht überall nötig
}

export default function TagPicker({
  context,
  selectedTagIds,
  onChange,
  placeholder = 'Tags suchen...',
  displayMode = 'name',
  label,
  showTooltip = false,
}: TagPickerProps) {
  const { state } = useAppStore();
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tags = (state.tags as Tag[]) || [];

  // Get selected tags
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));

  // Helper: Check if tag is blocked in current context
  const isTagBlocked = (tag: Tag): boolean => {
    return tag.blockedContexts?.includes(context) || false;
  };

  // Helper: Check if tag is suggested in current context
  const isTagSuggested = (tag: Tag): boolean => {
    return tag.suggestedContexts?.includes(context) || false;
  };

  // Filter suggestions:
  // 1. Exclude already selected
  // 2. Exclude blocked in current context
  // 3. Filter by query (name or code) - wenn query leer, alle anzeigen
  const filteredSuggestions = tags.filter(
    (tag) =>
      !selectedTagIds.includes(tag.id) &&
      !isTagBlocked(tag) &&
      (query.trim() === '' || // Zeige alle wenn leer
        tag.name.toLowerCase().includes(query.toLowerCase()) ||
        (tag.code && tag.code.toLowerCase().includes(query.toLowerCase())))
  );

  // Sort suggestions: Suggested tags first, then alphabetical
  const sortedSuggestions = [...filteredSuggestions].sort((a, b) => {
    const aSuggested = isTagSuggested(a);
    const bSuggested = isTagSuggested(b);

    if (aSuggested && !bSuggested) return -1;
    if (!aSuggested && bSuggested) return 1;

    // Both suggested or both not suggested: sort alphabetically
    return a.name.localeCompare(b.name);
  });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tagId: string) => {
    if (selectedTagIds.length >= 10) {
      alert('Maximal 10 Tags erlaubt');
      return;
    }

    onChange([...selectedTagIds, tagId]);
    setQuery('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId));
  };

  return (
    <div>
      {/* Label mit Tooltip */}
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          {showTooltip && (
            <DevTooltip
              text="DEV: Asset-Klassifizierung erfolgt über managed tags (tagIds). Typ wurde entfernt, um weniger starre Strukturen zu erzwingen. Tags sind flexibel und zentral verwaltbar."
              placement="right"
            />
          )}
        </div>
      )}

      <div ref={containerRef} className="relative">
        {/* Selected Tags (Chips) */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedTags.map((tag) => {
              // Display based on displayMode: code with fallback to name, or just name
              const chipText = displayMode === 'code' ? (tag.code || tag.name) : tag.name;
              const blocked = isTagBlocked(tag);

              return (
                <span
                  key={tag.id}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                    blocked
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {blocked && (
                    <AlertCircle size={12} className="text-red-600" />
                  )}
                  {chipText}
                  {blocked && (
                    <span className="text-xs text-red-600 ml-1">(gesperrt)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className={`rounded-full p-0.5 transition-colors ${
                      blocked ? 'hover:bg-red-200' : 'hover:bg-blue-200'
                    }`}
                    title="Entfernen"
                  >
                    <X size={14} />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={
              selectedTagIds.length >= 10
                ? 'Maximal 10 Tags erreicht'
                : placeholder
            }
            disabled={selectedTagIds.length >= 10}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {sortedSuggestions.length > 0 ? (
                <>
                  {sortedSuggestions.map((tag) => {
                    const suggested = isTagSuggested(tag);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAddTag(tag.id)}
                        className={`w-full px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center justify-between ${
                          suggested ? 'bg-blue-25' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-sm ${
                            suggested
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {tag.name}
                          </span>
                          {suggested && (
                            <span className="text-xs text-green-600">Empfohlen</span>
                          )}
                        </div>
                        {tag.code && (
                          <span className="text-xs text-gray-500 font-mono">
                            {tag.code}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              ) : (
                <div className="px-4 py-2 text-gray-500 text-sm">
                  Kein passender Tag gefunden
                </div>
              )}
            </div>
          )}
        </div>

        {/* Counter */}
        <div className="mt-1 text-xs text-gray-500">
          {selectedTagIds.length} / 10 Tags
        </div>
      </div>
    </div>
  );
}
