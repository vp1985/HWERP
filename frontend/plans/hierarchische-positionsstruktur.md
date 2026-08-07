---
title: "Hierarchische Positionsstruktur für calculationLineItems"
status: erledigt
priority: hoch
created: 2026-02-25
updated: 2026-02-25
---

## Beschreibung

Asset-Header werden zu echten Aggregatoren. Positionen erhalten hierarchische Nummern
(1, 1.1, 1.2, 2, …). Header zeigen kumulierten Preis aller Child-Positionen.
DnD verschiebt Header-Blöcke explizit via `assetHeaderId`, nicht mehr implizit positional.

---

## Bestandsanalyse (Ergebnis des Scans)

### Was existiert

| Aspekt | Ist-Stand |
|--------|-----------|
| `positionNumber` | `number \| null` (INTEGER in DB, nullable seit Migration 003) |
| Gruppen-Zugehörigkeit | **implizit** positional: Kinder = alle Items nach Header bis zum nächsten Header |
| Block-Move-Trigger | nur wenn `positionNumber === null` (= Workshop-Header) — buy_sell-Header werden NICHT als Block bewegt |
| `totalPrice` | immer `quantity * unitPrice`, keine Ausnahmen |
| `assetHeaderId` | **existiert nicht** |
| Tests | keine vorhanden, kein Framework konfiguriert |

### Kritische Lücken

1. **Buy_sell-Header werden nicht als Block bewegt** — `moveLineItem` prüft `positionNumber === null`, buy_sell-Header haben aber eine Nummer.
2. **Kein explizites Parent-Child** — Gruppe bricht sofort, wenn man ein Kind vor den Header zieht.
3. **Flache Nummerierung** — keine Hierarchie in der Nummer erkennbar.

---

## Entscheidungen

### 1. `positionNumber`: string | null

- Ziel: `string` (`"1"`, `"1.1"`, `"1.2"`)
- `null` bleibt erlaubt für `type === 'info'` (Textreihen ohne Verkaufsposition)
- `asset_header` und `material`/`service` bekommen **immer** eine Nummer
- Workshop-Header bisher mit `null` → bekommen jetzt eine Root-Nummer (`"1"`, `"2"`, …)
- **Konsequenz für Block-Move-Trigger:** nicht mehr `positionNumber === null`, sondern `type === 'asset_header'`

### 2. `assetHeaderId`: explizites Parent-Feld

- Neues Feld `assetHeaderId: string | null` in `CalculationLineItem`
- Ein Item ist Child eines Headers, wenn `assetHeaderId === header.id`
- `asset_header` selbst hat `assetHeaderId: null` (flache Hierarchie, kein Header-in-Header)
- Bestehende Daten: per Migrations-Backfill aus impliziter Reihenfolge ableiten

### 3. `totalPrice` bleibt Zeilenpreis

- `totalPrice = quantity * unitPrice` — keine Änderung an der Semantik
- Bei Workshop/On-Site-Headern: `totalPrice = 0` (wie bisher)
- Bei Buy_sell-Headern: `totalPrice = quantity * unitPrice` (eigener Preis, kein Kind-Aggregat)
- **Aggregat** wird **berechnet, nicht gespeichert** — separates computed Feld im UI

### 4. Aggregat-Strategie

- Nur direkte Children (keine Rekursion — flache Hierarchie)
- Aggregat = Summe der `totalPrice` aller Items mit `assetHeaderId === header.id`
- `info`-Items: zählen mit 0 (haben `totalPrice = 0`)
- Buy_sell-Header zeigen **eigenen Preis** (nicht Aggregat) — Kinder wären ohnehin keine typischen Preiszeilen
- Workshop/On-Site-Header zeigen **Aggregat** aller Kinder

### 5. Positionsnummern-Strategie

```
Root-Level-Items (assetHeaderId === null):  1, 2, 3, …
  └ Kinder von Header "1":                  1.1, 1.2, 1.3, …
  └ Kinder von Header "2":                  2.1, 2.2, 2.3, …
info-Items:                                 null (keine Nummer)
```

- Nummern sind **Anzeige/Sortierungsinfo**, nicht ID
- Nummern werden nach **jedem** DnD-Move neu berechnet
- Berechnung: deterministisch aus sort-Reihenfolge + `assetHeaderId`
- Quelle der Wahrheit: **clientseitig** berechnen und persistieren

### 6. Nested Headers

Nicht in diesem Schritt. Validierung: `asset_header` kann kein Child eines anderen `asset_header` sein (Constraint clientseitig beim Reparenting).

---

## Datenbankmigrationen

### Migration 004: `asset_header_id` + `position_number` → TEXT

```sql
-- migration 004_hierarchical_positions.sql

-- 1. Neue Spalte assetHeaderId
ALTER TABLE calculation_line_items
  ADD COLUMN IF NOT EXISTS asset_header_id UUID
    REFERENCES calculation_line_items(id) ON DELETE SET NULL;

-- 2. position_number: INTEGER → TEXT
--    Schritt A: neue TEXT-Spalte anlegen
ALTER TABLE calculation_line_items
  ADD COLUMN IF NOT EXISTS position_number_text TEXT;

--    Schritt B: Daten migrieren (bestehende Zahlen als String)
UPDATE calculation_line_items
  SET position_number_text = position_number::TEXT
  WHERE position_number IS NOT NULL;

--    Schritt C: alte Spalte löschen, neue umbenennen
ALTER TABLE calculation_line_items DROP COLUMN position_number;
ALTER TABLE calculation_line_items RENAME COLUMN position_number_text TO position_number;

-- 3. Backfill asset_header_id aus impliziter Reihenfolge
--    (pro calculation_id: jedes Non-Header-Item bekommt den letzten Header vor ihm)
--    Das ist ein einmaliger Datenmigrations-Step; Logik in Node-Migrationsskript
--    oder per SQL-Fensterfunktion:
WITH ordered AS (
  SELECT
    id,
    calculation_id,
    type,
    (ROW_NUMBER() OVER (PARTITION BY calculation_id ORDER BY position_number::int NULLS LAST, created_at)) AS rn
  FROM calculation_line_items
),
headers AS (
  SELECT id, calculation_id, rn FROM ordered WHERE type = 'asset_header'
),
assignments AS (
  SELECT
    o.id,
    (SELECT h.id FROM headers h
     WHERE h.calculation_id = o.calculation_id AND h.rn < o.rn
     ORDER BY h.rn DESC LIMIT 1) AS header_id
  FROM ordered o
  WHERE o.type != 'asset_header'
)
UPDATE calculation_line_items c
  SET asset_header_id = a.header_id
  FROM assignments a
  WHERE c.id = a.id;
```

---

## TypeScript-Typen

### `src/app/lib/types.ts`

```typescript
export interface CalculationLineItem extends BaseEntity {
  calculationId: string;
  positionNumber: string | null;          // war: number | null
  assetHeaderId: string | null;           // NEU: explizite Parent-Referenz
  type: 'material' | 'service' | 'asset_header' | 'info';
  materialId: string | null;
  serviceId: string | null;
  assetNodeId?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;                     // bleibt quantity * unitPrice
}
```

---

## Neue Hilfsfunktionen (`src/app/lib/calculationUtils.ts`)

Neue Datei. Keine doppelten Utilities — `getGroup` in `CalculationDetailPage.tsx` wird
**ersetzt** (nicht parallel gehalten), da es jetzt `assetHeaderId` nutzt.

### `assignPositionNumbers(items)`

```
Input:  CalculationLineItem[] (sortiert nach gewünschter Reihenfolge)
Output: CalculationLineItem[] mit aktualisierten positionNumber-Strings

Algorithmus:
  rootCounter = 0
  childCounters = Map<headerId, number>

  für jedes item:
    if type === 'info':
      positionNumber = null
    else if assetHeaderId === null:          // Root-Level
      rootCounter++
      positionNumber = String(rootCounter)
      childCounters.set(item.id, 0)          // Header initialisiert seinen Counter
    else:                                    // Child
      childCounters[assetHeaderId]++
      parentPos = items.find(h => h.id === assetHeaderId).positionNumber
      positionNumber = `${parentPos}.${childCounters[assetHeaderId]}`
```

### `computeHeaderAggregates(items)`

```
Input:  CalculationLineItem[]
Output: Map<headerId, number>  (aggregierter Preis je Header)

Für jeden asset_header:
  aggregate = sum(items.filter(i => i.assetHeaderId === header.id).map(i => i.totalPrice))
```

### Ersetzte `getGroup`-Logik

```
getGroup(items, headerIndex):
  headerId = items[headerIndex].id
  return indices aller items wo:
    index === headerIndex
    ODER items[index].assetHeaderId === headerId
```

---

## DnD-Änderungen (`CalculationDetailPage.tsx`)

### Block-Move-Trigger

**Vorher:**
```typescript
if (lineItems[fromIndex]?.type === 'asset_header' && lineItems[fromIndex].positionNumber === null)
```

**Nachher:**
```typescript
if (lineItems[fromIndex]?.type === 'asset_header')
```

### Child-Reparenting

Neues Verhalten beim Drop einer Nicht-Header-Zeile:

1. Ziel-Drop-Zone ist ein anderer Header (oder "Root" zwischen Headern)
2. `assetHeaderId` des gezogenen Items wird auf den neuen Header (oder `null`) gesetzt
3. Item wird an der richtigen Position in der Ziel-Gruppe eingefügt
4. `assignPositionNumbers` + `computeHeaderAggregates` neu berechnen
5. Persistenz via `updateLineItem` (bestehender CRUD-Patch)

### Drop-Zonen (neue DraggableRow-Erweiterung)

```
Bestehend: hover → move bei Mitte überschritten
Neu:
  - "In Header droppen": Drop-Target auf asset_header-Zeile →
    setzt assetHeaderId = header.id, fügt ans Ende der Gruppe ein
  - "Zwischen Gruppen": Drop-Target in Root-Zone → assetHeaderId = null
```

Implementierung: `DraggableRow` bekommt optionales `onDropIntoHeader`-Prop.
Header-Zeile akzeptiert Drop mit visuellem Indikator (blauer Rahmen unten).

### Nach jedem Move

```typescript
const reorderAndRecalculate = (newItems: CalculationLineItem[]) => {
  const numbered = assignPositionNumbers(newItems);
  setLineItems(numbered);
  // Persistenz: batch-update über bestehendes ApiRepository
  saveLineItemOrder(numbered);
};
```

---

## UI-Änderungen

### asset_header-Zeile: Aggregatpreis anzeigen

```tsx
// Workshop/On-Site-Header: kein eigener Preis → Aggregat rechts
{!hasBuySellPrice && (
  <td className="px-4 py-2 text-right font-mono text-purple-700 text-sm">
    {aggregates.get(item.id)?.toFixed(2) ?? '—'} €
  </td>
)}

// Buy_sell-Header: eigener Preis bleibt (wie bisher)
```

### Visuelle Einrückung von Children

```tsx
// material/service mit assetHeaderId → leichte Einrückung in Beschreibungsspalte
<td className="px-4 py-3">
  <div style={{ paddingLeft: item.assetHeaderId ? '1rem' : 0 }}>
    ...
  </div>
</td>
```

---

## Persistenz

- **Keine neuen API-Endpunkte** — generisches CRUD (`/api`) reicht
- Nach DnD: `UPDATE_ENTITY` für jedes geänderte Item (assetHeaderId + positionNumber)
- Batch über bestehendes `saveEntities`-Pattern
- Aggregatpreis wird **nicht** gespeichert — nur berechnet

---

## Tests (vitest hinzufügen — minimale Config)

Da kein Framework existiert: `vitest` als Dev-Dependency hinzufügen (passt zu Vite-Setup).

### Testdatei: `src/app/lib/calculationUtils.test.ts`

Testfälle:

1. **Block bleibt zusammen nach Header-Move**
   - Header mit 2 Children → nach Move zu Position 0: Header + Children an erster Stelle, Nummern korrekt

2. **Child-Reparenting A → B**
   - Child von Header A per Drop auf Header B → `assetHeaderId` = B.id, Nummern neu (war "1.2", jetzt "2.1")

3. **Aggregatpreis korrekt**
   - Header mit 3 Children (100€, 50€, 25€) → Aggregat = 175€
   - Info-Child zählt 0

4. **Root + Children kollidieren nicht**
   - Root-Item hat "2", Kinder von Header "1" haben "1.1", "1.2" — keine Überschneidung

5. **Workshop-Header bekommt Nummer**
   - Workshop-Header (war `positionNumber: null`) → bekommt jetzt "1" oder "2"
   - Children: "1.1", "1.2"

6. **Buy_sell-Header: kein Aggregat im Preis**
   - Buy_sell-Header mit eigenem `unitPrice = 500` → `totalPrice = 500` bleibt, Aggregat-Anzeige entfällt

---

## Implementierungsschritte

- [x] **Schritt 1** — `migrations/004_hierarchical_positions.sql` schreiben und ausführen
- [x] **Schritt 2** — `types.ts`: `positionNumber` auf `string | null`, `assetHeaderId: string | null` hinzufügen
- [x] **Schritt 3** — `calculationUtils.ts` neu anlegen: `assignPositionNumbers`, `computeHeaderAggregates`, neue `getGroup`-Implementierung
- [x] **Schritt 4** — `CalculationDetailPage.tsx`: Block-Move-Trigger auf `type === 'asset_header'` umstellen, `getGroup` auf neue Implementierung umstellen
- [x] **Schritt 5** — `CalculationDetailPage.tsx`: Child-Reparenting via Drop-on-Header implementieren
- [x] **Schritt 6** — `CalculationDetailPage.tsx`: `reorderAndRecalculate` nach jedem Move aufrufen
- [x] **Schritt 7** — `CalculationDetailPage.tsx`: Aggregatpreis-Anzeige für Workshop/On-Site-Header einbauen
- [x] **Schritt 8** — `CalculationDetailPage.tsx`: visuelle Einrückung für Children
- [x] **Schritt 9** — `addMaterialToCalculation`, `addServiceToCalculation`, `addAssetToCalculation`: `assetHeaderId` und string-`positionNumber` beim Erstellen korrekt setzen
- [x] **Schritt 10** — vitest installieren + `calculationUtils.test.ts` schreiben (6 Testfälle)
- [x] **Schritt 11** — manuelle Verifikation: DnD-Szenarien durchspielen

---

## Kurzreferenz: Strategien (10–20 Zeilen)

**Nummerierungsstrategie:** Clientseitig berechnet nach jedem Reorder. Root-Items
(assetHeaderId = null) bekommen 1, 2, 3. Children bekommen parentNr.1, parentNr.2.
`info`-Items bekommen null (keine Nummer). Deterministisch aus Sortierreihenfolge.

**Aggregatstrategie:** Berechnet, nicht gespeichert. Aggregat = Summe der `totalPrice`
aller direkten Children (assetHeaderId === header.id). Wird in `computeHeaderAggregates`
als Map berechnet und per `useMemo` im UI gehalten. `totalPrice` auf LineItem-Ebene
bleibt immer `quantity * unitPrice`.

**buy_sell / workshop / on_site:**
- `buy_sell`-Header hat eigenen Preis (`unitPrice > 0`). Zeigt eigenen `totalPrice`.
  Kein Aggregat-Overlay (wäre verwirrend). Children unüblich, aber technisch möglich.
- `workshop`-Header hat `unitPrice = 0`. Zeigt Aggregat der Children.
- `on_site`-Header hat `unitPrice = 0`. Zeigt Aggregat (inkl. Auto-Services).
- Alle Header bekommen jetzt eine Positionsnummer — kein Sonderfall mehr für `null`.

---

## Offene Fragen

- Soll der Aggregat-Preis in der Tabellen-Fußzeile (Gesamtsumme) nur Root-Preise addieren
  (Children wären dann Doppelzählung wenn Header-Aggregat auch zählt)?
  → **Empfehlung:** Gesamtsumme = nur Items ohne `assetHeaderId` (Root-Level) oder nur
  `material`/`service`/`info` Items (keine Header). Das verhindert Doppelzählung.
- Block-Move: darf ein Child beim Reparenting auf einen buy_sell-Header abgelegt werden?
  → Erstmal ja, keine Einschränkung — buy_sell ist kein Sonderfall beim Reparenting.
