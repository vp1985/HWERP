import { useState } from 'react';
import {
  Search,
  CheckSquare,
  List,
  Tag,
  AlertCircle,
  Settings,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import DevTooltip from '../components/DevTooltip';
import TagPicker from '../components/TagPicker';
import { DataTable, DataTableColumn, DataTableFilterConfig } from '../components/ui/DataTable';

/**
 * UIElements - Lebende Dokumentation aller UI-Bausteine in HWERP
 *
 * DEV: Diese Seite dient als zentrale Referenz für alle verfügbaren UI-Komponenten.
 * Motivation: Schnellere Entwicklung durch klare Übersicht, welche Elemente vorhanden sind.
 * Wartbarkeit: Katalog ist als Datenstruktur implementiert → neue Komponenten einfach ergänzen.
 *
 * Wichtig: Wenn neue UI-Komponenten hinzugefügt werden, hier dokumentieren!
 */

interface UIElement {
  name: string;
  category: string;
  description: string;
  props: string;
  devNote: string;
  demo: React.ReactNode;
}

interface DemoTableRow {
  id: string;
  number: string;
  customer: string;
  status: 'draft' | 'active' | 'done';
  amount: string;
  dueDate: string;
}

const demoTableRows: DemoTableRow[] = [
  { id: '1', number: 'ANG-2026-014', customer: 'Müller Elektrotechnik', status: 'active', amount: '12.450,00 €', dueDate: '22.06.2026' },
  { id: '2', number: 'ANG-2026-015', customer: 'Stadtwerke Nord', status: 'draft', amount: '8.900,00 €', dueDate: '24.06.2026' },
  { id: '3', number: 'ANG-2026-016', customer: 'HT VoltEQ', status: 'done', amount: '31.200,00 €', dueDate: '28.06.2026' },
];

const demoStatusClasses: Record<DemoTableRow['status'], string> = {
  active: 'border-blue-200 bg-blue-50 text-blue-700',
  draft: 'border-gray-200 bg-gray-50 text-gray-600',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const demoStatusLabels: Record<DemoTableRow['status'], string> = {
  active: 'Aktiv',
  draft: 'Entwurf',
  done: 'Erledigt',
};

const demoTableColumns: DataTableColumn<DemoTableRow>[] = [
  {
    key: 'number',
    header: 'Nummer',
    sortable: true,
    render: (row) => <span className="font-mono font-bold text-blue-600">{row.number}</span>,
  },
  {
    key: 'customer',
    header: 'Kunde',
    sortable: true,
    render: (row) => <span className="font-semibold text-gray-900">{row.customer}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (row) => (
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${demoStatusClasses[row.status]}`}>
        {demoStatusLabels[row.status]}
      </span>
    ),
  },
  {
    key: 'amount',
    header: 'Summe',
    align: 'right',
    sortable: true,
    render: (row) => row.amount,
  },
  {
    key: 'dueDate',
    header: 'Fällig',
    sortable: true,
    render: (row) => row.dueDate,
  },
];

const demoTableFilters: DataTableFilterConfig<DemoTableRow>[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Aktiv' },
      { value: 'draft', label: 'Entwurf' },
      { value: 'done', label: 'Erledigt' },
    ],
  },
  {
    key: 'dueDate',
    label: 'Fällig',
    type: 'dateRange',
  },
  {
    key: 'amount',
    label: 'Summe',
    type: 'numberRange',
  },
];

// Katalog aller UI-Elemente (strukturiert als Daten, nicht als Copy-Paste-Code)
const UI_CATALOG: UIElement[] = [
  // ============================================================
  // A) NAVIGATION
  // ============================================================
  {
    name: 'SidebarLink',
    category: 'Navigation',
    description: 'Standard-Link in der Sidebar mit Icon, aktiv-State und Hover-Effekt',
    props: 'path: string, label: string, icon: LucideIcon',
    devNote: 'DEV: Integriert in Sidebar.tsx. Nutzt react-router Link mit location.pathname für aktiv-State. Aktive Links haben bg-blue-600.',
    demo: (
      <div className="bg-gray-900 p-3 rounded">
        <div className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded">
          <Settings size={20} />
          <span>Beispiel Link (aktiv)</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 text-gray-300 hover:bg-gray-800 rounded mt-2">
          <List size={20} />
          <span>Beispiel Link (inaktiv)</span>
        </div>
      </div>
    ),
  },
  {
    name: 'AccordionSection',
    category: 'Navigation',
    description: 'Ausklappbares Untermenü für Sidebar (z.B. Stammdaten, Admin)',
    props: 'title: string, expanded: boolean, onToggle: () => void, children: ReactNode',
    devNote: 'DEV: Nutzt ChevronDown/ChevronRight Icons. State wird per useState im Parent (Sidebar) verwaltet. Standardmäßig zugeklappt; letzter Stand wird per localStorage wiederhergestellt.',
    demo: (
      <div className="bg-gray-900 p-3 rounded space-y-2">
        <button className="w-full flex items-center gap-3 px-6 py-3 text-gray-300 hover:bg-gray-800 rounded">
          <ChevronDown size={20} />
          <span>Admin (ausgeklappt)</span>
        </button>
        <div className="flex items-center gap-3 px-6 py-3 pl-12 text-gray-300 hover:bg-gray-800 rounded">
          <Settings size={20} />
          <span>Tools</span>
        </div>
        <button className="w-full flex items-center gap-3 px-6 py-3 text-gray-300 hover:bg-gray-800 rounded mt-4">
          <ChevronRight size={20} />
          <span>Stammdaten (eingeklappt)</span>
        </button>
      </div>
    ),
  },

  // ============================================================
  // B) FORM CONTROLS
  // ============================================================
  {
    name: 'TextInput',
    category: 'Form Controls',
    description: 'Standard-Textfeld mit Label, Placeholder und Error-State',
    props: 'value: string, onChange: (val: string) => void, placeholder?: string, error?: string',
    devNote: 'DEV: Verwendet Tailwind-Klassen für Styling. Error-State zeigt roten Border + Fehlertext darunter. Disabled-State hat bg-gray-100.',
    demo: (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name (normal)</label>
          <input
            type="text"
            placeholder="Name eingeben..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name (Fehler)</label>
          <input
            type="text"
            value="Fehlerhafter Wert"
            className="w-full px-4 py-2 border border-red-500 rounded-lg"
            readOnly
          />
          <p className="text-sm text-red-600 mt-1">⚠ Pflichtfeld darf nicht leer sein</p>
        </div>
      </div>
    ),
  },
  {
    name: 'TextArea',
    category: 'Form Controls',
    description: 'Mehrzeiliges Textfeld für längere Eingaben (z.B. Notizen, Beschreibungen)',
    props: 'value: string, onChange: (val: string) => void, rows?: number, placeholder?: string',
    devNote: 'DEV: rows={4} als Standard. Kein Auto-Resize implementiert (bewusste Entscheidung für einfachere Handhabung).',
    demo: (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
        <textarea
          rows={4}
          placeholder="Notizen eingeben..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    ),
  },
  {
    name: 'NumberInput',
    category: 'Form Controls',
    description: 'Input für numerische Werte mit optionaler Einheit',
    props: 'value: number, onChange: (val: number) => void, min?: number, step?: number, unit?: string',
    devNote: 'DEV: type="number" mit min/step-Attributen. Unit (z.B. "€", "m²") wird rechts angezeigt. Wichtig: onChange muss parseFloat/parseInt nutzen!',
    demo: (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preis</label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">€</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fläche</label>
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              step="1"
              min="0"
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">m²</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    name: 'Select',
    category: 'Form Controls',
    description: 'Dropdown zur Auswahl einer Option aus einer Liste',
    props: 'value: string, onChange: (val: string) => void, options: {value: string, label: string}[]',
    devNote: 'DEV: Natives <select>-Element mit Tailwind-Styling. Keine Custom-Dropdown-Lib nötig. Disabled-State: opacity-50.',
    demo: (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">Bitte wählen...</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
          <option value="pending">Ausstehend</option>
        </select>
      </div>
    ),
  },
  {
    name: 'Checkbox',
    category: 'Form Controls',
    description: 'Checkbox für Ja/Nein-Entscheidungen',
    props: 'checked: boolean, onChange: (checked: boolean) => void, label: string',
    devNote: 'DEV: Natives <input type="checkbox"> mit Label. htmlFor/id für Accessibility. Styling mit accent-blue-600.',
    demo: (
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-blue-600" />
          <span>Option aktivieren</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked readOnly className="w-4 h-4 accent-blue-600" />
          <span>Option ausgewählt</span>
        </label>
        <label className="flex items-center gap-2 cursor-not-allowed opacity-50">
          <input type="checkbox" disabled className="w-4 h-4 accent-blue-600" />
          <span>Option deaktiviert</span>
        </label>
      </div>
    ),
  },
  {
    name: 'Button',
    category: 'Form Controls',
    description: 'Standard-Button mit Varianten (primary, secondary, danger)',
    props: 'onClick: () => void, variant?: "primary" | "secondary" | "danger", disabled?: boolean',
    devNote: 'DEV: Primary (blue), Secondary (gray border), Danger (red). Disabled-State: opacity-50 + cursor-not-allowed. Icon-Support mit gap-2.',
    demo: (
      <div className="flex flex-wrap gap-3">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          Primary Button
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
          Secondary Button
        </button>
        <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
          Danger Button
        </button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded opacity-50 cursor-not-allowed" disabled>
          Disabled Button
        </button>
      </div>
    ),
  },
  {
    name: 'ConfirmDialog',
    category: 'Form Controls',
    description: 'Modal-Dialog zur Bestätigung kritischer Aktionen (z.B. Löschen)',
    props: 'open: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string',
    devNote: 'DEV: Overlay mit fixed inset-0 + bg-black/50. Zentriert mit flex + items-center/justify-center. z-50 für Stacking. Escape-Key-Support kann ergänzt werden.',
    demo: (
      <div className="relative h-40 bg-gray-100 rounded overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-xl font-bold mb-2">Bestätigung erforderlich</h2>
            <p className="text-gray-600 mb-4">Möchten Sie diese Aktion wirklich durchführen?</p>
            <div className="flex gap-3 justify-end">
              <button className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                Abbrechen
              </button>
              <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // ============================================================
  // C) FEEDBACK
  // ============================================================
  {
    name: 'DevTooltip',
    category: 'Feedback',
    description: 'Info-Icon (ⓘ) mit Tooltip für technische Erklärungen',
    props: 'text: string, placement?: "top" | "right" | "bottom" | "left", maxWidth?: number',
    devNote: 'DEV: Zentrales Element für DEV-Hinweise. Nutzt Info-Icon von lucide-react. CSS-basiertes Positioning (kein Popper.js). Text beginnt immer mit "DEV:". Hover + Click-Support.',
    demo: (
      <div className="flex items-center gap-2">
        <span>Beispiel-Label</span>
        <DevTooltip
          text="DEV: Dies ist ein Beispiel-Tooltip mit technischer Erklärung. Tooltips helfen, Design-Entscheidungen zu dokumentieren."
          placement="right"
        />
      </div>
    ),
  },
  {
    name: 'StatusMessage',
    category: 'Feedback',
    description: 'Inline-Statusmeldung (Erfolg/Fehler) nach Aktionen',
    props: 'type: "success" | "error" | "info", message: string',
    devNote: 'DEV: Verwendet in AdminTools nach Reset-Aktionen. Grün für Erfolg (✅), Rot für Fehler (❌), Blau für Info. Auto-Hide kann implementiert werden.',
    demo: (
      <div className="space-y-3">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">✅ Aktion erfolgreich durchgeführt</p>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">❌ Fehler beim Speichern</p>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">ℹ Information zur Kenntnis</p>
        </div>
      </div>
    ),
  },
  {
    name: 'InlineValidationError',
    category: 'Feedback',
    description: 'Fehlertext unterhalb von Formfeldern',
    props: 'message: string',
    devNote: 'DEV: Zeigt Validierungsfehler direkt unter Input-Feld. Rot gefärbt (text-red-600). Kopplung: Input bekommt border-red-500 bei Fehler.',
    demo: (
      <div>
        <input
          type="text"
          value="Fehlerhafter Wert"
          className="w-full px-4 py-2 border border-red-500 rounded-lg"
          readOnly
        />
        <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
          <AlertCircle size={14} />
          Pflichtfeld darf nicht leer sein
        </p>
      </div>
    ),
  },

  // ============================================================
  // D) DATA DISPLAY
  // ============================================================
  {
    name: 'DataTable',
    category: 'Data Display',
    description: 'Verbindliche Standard-Tabelle für HWERP mit Toolbar, Suche, Sortierung, Sticky Header, Empty/Loading/Error States und optionaler Spaltenauswahl',
    props: 'title, columns, rows, rowKey, search?, filters?, actions?, columnLayout?, columnVisibility?, density?',
    devNote: 'DEV: Nutze src/app/components/ui/DataTable.tsx statt manueller <table>-Layouts. Spaltenpositionen fachlich über columnLayout festlegen; Filter zentral über filters definieren, damit Status-/Datum-/Zahlenfilter nicht pro Tabelle neu gebaut werden.',
    demo: (
      <div className="h-[360px] min-w-0">
        <DataTable<DemoTableRow>
          title="Angebotsübersicht"
          primaryAction={{ label: 'Neu', onClick: () => {} }}
          search={{ value: '', onChange: () => {}, placeholder: 'Suchen...' }}
          columns={demoTableColumns}
          filters={demoTableFilters}
          rows={demoTableRows}
          rowKey={(row) => row.id}
          actions={() => (
            <button className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
              Öffnen
            </button>
          )}
          columnLayout={{
            defaultOrder: ['number', 'customer', 'status', 'dueDate', 'amount'],
            defaultVisible: ['number', 'customer', 'status', 'dueDate', 'amount'],
            lockedLeft: ['number'],
            lockedRight: ['amount'],
            required: ['number'],
          }}
          columnVisibility={{
            enabled: true,
            storageKey: 'datatable.ui-elements-demo.v2',
            defaultVisibleKeys: ['number', 'customer', 'status', 'dueDate', 'amount'],
            enableReordering: true,
          }}
        />
      </div>
    ),
  },
  {
    name: 'ListRow',
    category: 'Data Display',
    description: 'Einfache Listenzeile mit Hover-Effekt (Alternative zu Table)',
    props: 'onClick?: () => void, children: ReactNode',
    devNote: 'DEV: Leichtgewichtige Alternative zu Table. Nutze bei einfachen Listen. hover:bg-gray-50 + cursor-pointer.',
    demo: (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer">
          <h3 className="font-semibold">Listeneintrag 1</h3>
          <p className="text-sm text-gray-600">Beschreibung des Eintrags</p>
        </div>
        <div className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer">
          <h3 className="font-semibold">Listeneintrag 2</h3>
          <p className="text-sm text-gray-600">Weitere Informationen</p>
        </div>
      </div>
    ),
  },
  {
    name: 'EmptyState',
    category: 'Data Display',
    description: 'Platzhalter wenn keine Daten vorhanden (z.B. leere Liste)',
    props: 'message: string, actionLabel?: string, onAction?: () => void',
    devNote: 'DEV: Zentriert mit text-center. Optional CTA-Button (z.B. "Ersten Eintrag erstellen"). Grauer Text für unaufdringliche Darstellung.',
    demo: (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-4">Noch keine Einträge vorhanden</p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          + Ersten Eintrag erstellen
        </button>
      </div>
    ),
  },
  {
    name: 'Chip / Badge',
    category: 'Data Display',
    description: 'Kleine farbige Chips für Tags, Status oder Kategorien',
    props: 'text: string, color?: "blue" | "green" | "red" | "gray", onRemove?: () => void',
    devNote: 'DEV: inline-flex mit px-3 py-1 rounded-full. Mit/ohne X-Button für Entfernung. Farben: bg-blue-100 text-blue-800 (oder green/red/gray).',
    demo: (
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
          Tag 1
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
          Empfohlen
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm border border-red-300">
          <AlertCircle size={12} />
          Gesperrt
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
          Status
        </span>
      </div>
    ),
  },
  {
    name: 'SearchInput',
    category: 'Data Display',
    description: 'Suchfeld mit Lupen-Icon für Filterung von Listen',
    props: 'value: string, onChange: (val: string) => void, placeholder?: string',
    devNote: 'DEV: Input mit Search-Icon links (pl-10 für Platz). Echtzeit-Filterung im Parent-Component. Keine Debounce standardmäßig.',
    demo: (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Suchen..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    ),
  },

  // ============================================================
  // E) DOMAIN-SPEZIFISCH
  // ============================================================
  {
    name: 'TagPicker',
    category: 'Domain-Spezifisch',
    description: 'Context-aware Tag-Auswahl aus managed Tag-Katalog',
    props: 'context: TagContext, selectedTagIds: string[], onChange: (ids: string[]) => void',
    devNote: 'DEV: WICHTIG - Nutzt tagIds (nicht String-Arrays)! Context-Regeln: blockedContexts werden ausgeblendet, suggestedContexts oben. Max 10 Tags. Bereits ausgewählte blockierte Tags als "gesperrt" markiert.',
    demo: (
      <div>
        <TagPicker
          context="ASSETS"
          selectedTagIds={[]}
          onChange={() => {}}
          placeholder="Tags suchen..."
          label="Tags (Demo)"
          showTooltip={true}
        />
      </div>
    ),
  },
];

export default function UIElements() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [searchQuery, setSearchQuery] = useState('');

  // Kategorien extrahieren
  const categories = ['Alle', ...Array.from(new Set(UI_CATALOG.map((el) => el.category)))];

  // Filtern nach Kategorie und Suchbegriff
  const filteredElements = UI_CATALOG.filter((el) => {
    const matchesCategory = selectedCategory === 'Alle' || el.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      el.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      el.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">UI-Elemente</h1>
          <DevTooltip
            text="DEV: Übersicht über verfügbare UI-Bausteine in diesem Projekt. Wenn du ein neues Element einführst, ergänze es hier. Struktur als Datenarray ermöglicht einfache Wartbarkeit."
            placement="right"
          />
        </div>
        <p className="text-gray-600">
          Lebende Dokumentation aller verfügbaren UI-Komponenten in HWERP.
          <br />
          Diese Seite hilft dir, schnell die passenden Bausteine zu finden und deren Zweck zu
          verstehen.
        </p>
      </div>

      {/* Filterung */}
      <div className="mb-6 space-y-4">
        {/* Suchfeld */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Komponente suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Kategorie-Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Element-Liste */}
      <div className="space-y-6">
        {filteredElements.length > 0 ? (
          filteredElements.map((el) => (
            <div
              key={el.name}
              className="bg-white border border-gray-200 rounded-lg p-3 transition-shadow hover:shadow-lg sm:p-6"
            >
              {/* Name + Tooltip */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-2xl font-bold">{el.name}</h2>
                <DevTooltip text={el.devNote} placement="right" />
                <span className="ml-auto text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                  {el.category}
                </span>
              </div>

              {/* Beschreibung */}
              <p className="text-gray-700 mb-4">{el.description}</p>

              {/* Props */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Props:</h3>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{el.props}</code>
              </div>

              {/* Demo */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Demo:</h3>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">{el.demo}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Keine Elemente gefunden</p>
            <p className="text-sm mt-2">Versuche einen anderen Filter oder Suchbegriff</p>
          </div>
        )}
      </div>

      {/* Footer-Hinweis */}
      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Komponente fehlt?</h3>
            <p className="text-sm text-blue-800">
              Wenn du eine neue UI-Komponente erstellst, ergänze sie bitte in dieser Übersicht.
              <br />
              Datei: <code className="bg-blue-100 px-2 py-0.5 rounded">
                /src/app/pages/UIElements.tsx
              </code>
              <br />
              Array: <code className="bg-blue-100 px-2 py-0.5 rounded">UI_CATALOG</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
