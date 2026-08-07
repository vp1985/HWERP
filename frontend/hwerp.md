# Übernommener React-Ausgangsstand (Legacy)

Historische Projektzusammenfassung des übernommenen Frontends (Stand: 2026-02-25).

> Diese Datei beschreibt den technischen Ausgangsstand und ausdrücklich nicht die HWERP-Zielarchitektur. ERPNext/Frappe ist das einzige führende System. Der Express-/PostgreSQL-Code darf nur noch als Migrationsquelle beziehungsweise vorübergehende Kompatibilitätsschicht dienen; neue und migrierte Kalkulationsfunktionen verwenden die versionierte Frappe-API.

## Überblick des Ausgangsstands

Die browserbasierte Single-Page-Application verwaltet Kunden, Standorte, Assets, Kalkulationen, Materialien und Dienstleistungen.

Das Frontend wurde ursprünglich aus Figma Make generiert und wird schrittweise in die HWERP-Zielarchitektur überführt.

## Tech Stack

| Bereich        | Technologie                          |
|----------------|--------------------------------------|
| Framework      | React 18 + TypeScript                |
| Bundler        | Vite 6                               |
| Routing        | React Router 7                       |
| UI-Basis       | shadcn/ui (Radix UI + Tailwind CSS 4)|
| Icons          | Lucide React + MUI Icons             |
| Formulare      | React Hook Form                      |
| Animationen    | Motion (Framer Motion Nachfolger)    |
| Datenbank      | PostgreSQL (via `pg` / Pool)         |
| Backend        | Express.js (Node.js, Port 3001)      |
| Diagramme      | Recharts                             |
| Drag & Drop    | react-dnd                            |

## Datenpersistenz

Das Backend ist ein Express-Server (`server/`, Port 3001), der eine PostgreSQL-Datenbank nutzt.
Die Verbindung erfolgt über `DATABASE_URL` in `.env.local`.

- Vite proxied `/api` → `http://localhost:3001` (in `vite.config.ts`)
- `server/db.ts`: PostgreSQL-Pool mit `pg`, TIMESTAMPTZ als ISO-String, NUMERIC als Float
- `server/routes/entities.ts`: generische CRUD-Endpunkte für alle Entities
- `server/routes/sequences.ts`: Sequenznummern (z.B. Kalkulationsnummern `K-000001`)
- `server/routes/assetTypes.ts`: Asset-Typen (separater Endpunkt)
- `server/routes/reset.ts`: Dev-Reset-Endpunkt
- Frontend-Repository: `src/app/lib/repository.ts` (`ApiRepository`) kommuniziert ausschließlich über `/api`

### Schemamigrationen

SQL-Migrationsdateien in `migrations/`:
- `001_initial_schema.sql` – Basis-Schema
- `002_asset_line_items.sql` – Asset-Header / Info LineItem-Typen
- `003_nullable_position_number.sql` – `position_number` NOT NULL Constraint entfernt

## Dev-Befehle

```bash
pnpm dev          # Vite Frontend (Port 5174)
pnpm server       # Express Backend (Port 3001)
# oder:
tsx watch server/index.ts
```

## State Management

`AppStoreContext` (`src/app/context/AppStoreContext.tsx`):
- React `useReducer` mit zentralem AppState
- Beim Mount: Hydration aller Entities aus dem Repository (API-Calls)
- Actions: `SET_ENTITIES`, `ADD_ENTITY`, `UPDATE_ENTITY`, `DELETE_ENTITY`

## Datenmodell (Entities)

| Entity                    | Beschreibung                                         |
|---------------------------|------------------------------------------------------|
| `customers`               | Kunden                                               |
| `locations`               | Physische Standorte (mit GPS Decimal + DMS)          |
| `locationCustomers`       | M:N – Standort ↔ Kunde                               |
| `contactPersons`          | Ansprechpartner                                      |
| `customerContactPersons`  | M:N – Kunde ↔ Ansprechpartner                        |
| `locationContactOverrides`| Manuelle AP-Überschreibung für Standort              |
| `assetContactOverrides`   | Manuelle AP-Überschreibung für Asset                 |
| `assets`                  | Anlagen/Assets (hierarchisch via `parentId`)         |
| `materials`               | Artikel/Materialien für Kalkulationen                |
| `services`                | Dienstleistungen (mit Kategorie: Fahrtkosten, Stundensätze, ...) |
| `calculations`            | Kalkulationen (MVP: nur Status DRAFT)                |
| `calculationLineItems`    | Positionen in Kalkulationen (s.u.)                   |
| `tags`                    | Flexible Tags zur Klassifizierung                    |
| `sequences`               | Laufende Nummern (z.B. für Kalkulationsnummern)      |
| `settings`                | App-Einstellungen (Single-Row, ID = "app")           |

### CalculationLineItem

```ts
interface CalculationLineItem {
  calculationId: string;
  positionNumber: number | null;   // null bei workshop/on_site-Asset-Headern
  type: 'material' | 'service' | 'asset_header' | 'info';
  materialId: string | null;
  serviceId: string | null;
  assetNodeId?: string | null;     // Referenz auf Asset (bei type='asset_header')
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;              // quantity * unitPrice
}
```

**Asset-Behandlungsarten** (beim Hinzufügen per Dialog):
- `buy_sell` – Asset wird verkauft, Header bekommt Positionsnummer + Preis
- `workshop` – Asset in Werkstatt, Header ohne Positionsnummer (null)
- `on_site` – Vor-Ort-Einsatz: Header null, Info-Zeile null, auto. Fahrtkosten + Stundensatz mit Pos.-Nummer

### Vererbungslogik (Ansprechpartner)

- Standort erbt AP von seinen Kunden – außer es gibt `locationContactOverrides`
- Asset erbt AP über `locationId`, sonst über `parentId` – außer es gibt `assetContactOverrides`

## Routing (`src/app/routes.tsx`)

| Pfad                        | Seite                        |
|-----------------------------|------------------------------|
| `/`                         | Dashboard                    |
| `/customers`                | Kundenliste                  |
| `/customers/new`, `/:id`    | Kundenformular               |
| `/locations`                | Standortliste                |
| `/locations/new`, `/:id`    | Standortformular             |
| `/contacts`                 | Ansprechpartnerliste         |
| `/contacts/new`, `/:id`     | Ansprechpartnerformular      |
| `/suppliers`                | Lieferanten                  |
| `/assets`                   | Asset-Baum                   |
| `/assets/new`, `/:id`       | Asset-Detail                 |
| `/materials`                | Materialliste                |
| `/services`                 | Dienstleistungsliste         |
| `/calculations`             | Kalkulationsliste            |
| `/calculations/new`, `/:id` | Kalkulations-Detail          |
| `/tags`                     | Tag-Verwaltung               |
| `/settings/inheritances`    | Vererbungseinstellungen      |
| `/masterdata/asset-types`   | Asset-Typen (Stammdaten)     |
| `/admin/tools`              | Admin-Tools (Reset, etc.)    |
| `/admin/ui-elements`        | UI-Elemente (Dev)            |
| `/admin/vorlagen`           | Vorlagen/DataTable-Demo      |

## Projektstruktur

```
src/
├── main.tsx                       # Vite Einstiegspunkt
└── app/
    ├── App.tsx                    # Root-Komponente
    ├── routes.tsx                 # React Router Konfiguration
    ├── components/                # Wiederverwendbare Komponenten
    │   ├── Layout.tsx             # App-Layout mit Sidebar
    │   ├── Sidebar.tsx
    │   ├── QuickViewModal.tsx
    │   ├── SearchableSelect.tsx
    │   ├── TagBadge.tsx
    │   ├── TagPicker.tsx
    │   ├── Tooltip.tsx / DevTooltip.tsx
    │   └── ui/                    # shadcn/ui Komponenten (DataTable etc.)
    ├── config/
    │   └── assetTabRules.ts       # Tab-Regeln für Asset-Detail
    ├── context/
    │   ├── AppStoreContext.tsx    # Zentraler State + Repository
    │   └── PriceVisibilityContext.tsx
    ├── hooks/
    │   ├── useLocations.ts
    │   └── useModalClose.ts       # Backdrop-Click-Handler für Modals
    ├── lib/
    │   ├── types.ts               # Alle Entity-Interfaces
    │   ├── repository.ts          # ApiRepository (REST gegen /api)
    │   ├── assetTypeStorage.ts    # Asset-Typen (separater API-Endpunkt)
    │   ├── gpsUtils.ts            # GPS Decimal ↔ DMS Konvertierung
    │   └── utils.ts               # uuid(), Hilfsfunktionen
    ├── pages/                     # Alle Seiten-Komponenten
    └── types/
        └── tag.ts

server/
├── index.ts                       # Express-App, Route-Mounting, Port 3001
├── db.ts                          # PostgreSQL Pool (.env.local → DATABASE_URL)
├── mappers/
│   └── camelSnake.ts              # camelCase ↔ snake_case Konvertierung
└── routes/
    ├── entities.ts                # Generisches CRUD für alle Entities
    ├── sequences.ts               # Kalkulationsnummern-Sequenz
    ├── assetTypes.ts              # Asset-Typen
    └── reset.ts                   # Dev-Reset

migrations/
├── 001_initial_schema.sql
├── 002_asset_line_items.sql
└── 003_nullable_position_number.sql
```

## Feature-Backlog

| # | Feature | Status |
|---|---------|--------|
| 1 | Betriebssitz (CompanySettings) | ✅ Erledigt |
| 2 | Service-Kategorien | ✅ Erledigt |
| 3 | Standard-Services für Fahrtkosten | ✅ Erledigt |
| 4 | Asset-Gruppen in Kalkulationen | 🔄 In Bearbeitung |
| 5 | Hierarchische Positionsnummern (1, 1.1, 1.2...) | ⏳ Geplant |

### Feature 1: Betriebssitz (CompanySettings) ✅
- `AppSettings` Interface erweitert
- `CompanySettingsPage` mit Adress-Geocoding (Nominatim) und ORS API-Key
- Route + Sidebar-Eintrag ergänzt

### Feature 2: Service-Kategorien ✅
- System-Kategorien: `Fahrtkosten` (amber) + `Stundensätze` (blue)
- `Service.category` als Freitext-Feld
- `ServiceCategoryDialog`, ServicesPage und CalculationDetailPage aktualisiert

### Feature 3: Standard-Services für Fahrtkosten ✅
- Default-Services: PKW / Transporter / LKW, Servicetechniker / Monteur
- Auto-Seed beim ersten App-Start
- "Als Standard setzen" UI in ServicesPage

### Feature 4: Asset-Gruppen in Kalkulationen 🔄
- `asset_header`-LineItem-Typ implementiert
- Behandlungsarten: `buy_sell` | `workshop` | `on_site`
- `on_site`: auto. Fahrtkosten + Stundensatz werden als LineItems hinzugefügt
- DnD-Reorder mit Gruppen-Block-Move (`getGroup`-Hilfsfunktion)
- `positionNumber: null` für workshop/on_site-Header und Info-Zeilen
- Offen: hierarchische Positionsnummern (1.1, 1.2) + kumulierter Gesamtpreis

### Feature 5: Hierarchische Positionsnummern ⏳
- `positionNumber: string` (statt number|null)
- `assetHeaderId` für explizite Eltern-Kind-Zuordnung
- `assignPositionNumbers`-Hilfsfunktion
- Kumulierter Gesamtpreis auf Asset-Header-Zeilen

---

## Entwicklungshinweise

- Das Projekt wurde aus **Figma Make** heraus generiert (daher `@figma/my-make-file` in package.json)
- Pakete werden mit **pnpm** verwaltet
- Dev-Server: Port 5174 (HTTP) – `crypto.randomUUID` nicht verfügbar → `uuid()` aus `lib/utils.ts` nutzen
- Kalkulationsnummern-Format: `K-000001` (6-stellig, nullaufgefüllt)
- Tailwind v4: Opacity-Syntax `bg-black/40` (NICHT `bg-black bg-opacity-40`)
- TypeScript ohne separates `tsconfig.json` – Vite übernimmt die Konfiguration
