---
title: "Asset einem Kunden und Standort zuordnen"
status: geplant
priority: high
created: 2026-06-04
updated: 2026-06-04
---

# Asset-Kunden-/Standort-Zuordnung

> **For Hermes:** Vor Umsetzung `test-driven-development` und `user-webapp-default-workflow` laden. Erst UI-/Validierungslogik absichern, dann Formular erweitern. Keine neue Datenstruktur erfinden: `AssetNode.customerId` und `AssetNode.locationId` existieren bereits.

**Goal:** Im Asset-Formular kann beim Erstellen/Bearbeiten direkt ein Kunde und optional ein zugehöriger Standort gewählt werden.

**Architecture:** Das bestehende `AssetDetailPage`-Formular bekommt zwei neue Stammdatenfelder. Kunden und Standorte werden über das bestehende Repository geladen; Standorte werden nach gewähltem Kunden über `locationCustomers` gefiltert. Beim Speichern werden `customerId` und `locationId` im bestehenden `assets`-Datensatz persistiert.

**Tech Stack:** React/Vite + TypeScript, bestehendes `repository`/`AppStoreContext`, bestehendes `SearchableSelect`, bestehende Entities `customers`, `locations`, `locationCustomers`, `assets`.

---

## Ist-Zustand

- `AssetNode` hat bereits:
  - `customerId: string | null`
  - `locationId: string | null`
- PostgreSQL/Migration kennt bereits `assets.customer_id` und `assets.location_id`.
- Das Formular `src/app/pages/AssetDetailPage.tsx` speichert aktuell aber nur:
  - `parentId`
  - `tagIds`
  - Notizen
  - Kunden-Asset-ID
  - Interne Asset-ID
  - Baujahr/Gewicht/Hersteller/Seriennummer
- Die sichtbare **Kunden-Asset-ID** ist keine Kundenzuordnung, sondern nur eine externe Nummer beim Kunden.

---

## Zielverhalten

### Asset erstellen/bearbeiten

Im Tab **Stammdaten** erscheinen oberhalb oder direkt unter **Parent** zwei Felder:

1. **Kunde**
   - leer erlaubt: `Kein Kunde zugeordnet`
   - Auswahl aus bestehenden Kunden
2. **Standort**
   - leer erlaubt: `Kein Standort zugeordnet`
   - wenn Kunde gewählt: nur Standorte, die über `locationCustomers` diesem Kunden zugeordnet sind
   - wenn kein Kunde gewählt: entweder alle Standorte anzeigen oder Feld deaktivieren; MVP bevorzugt: deaktivieren mit Hinweis `Bitte zuerst Kunde wählen`

### Kaskadierung

- Wenn Kunde geändert wird und der aktuell gewählte Standort nicht mehr zum Kunden gehört, wird `locationId` geleert.
- Wenn Kunde geleert wird, wird `locationId` ebenfalls geleert.
- Parent-Hierarchie bleibt unabhängig davon; kein automatisches Vererben in diesem Schritt.

### Speicherung

Beim Speichern eines Assets:

```ts
const assetData: AssetNode = {
  ...,
  customerId: customerId || null,
  locationId: locationId || null,
};
```

Wichtig: Nicht `undefined` speichern, sondern `null`, weil `AssetNode` und DB-Feld nullable sind.

---

## Umsetzungsschritte

### Task 1: Daten im Asset-Formular laden

**Objective:** `AssetDetailPage` kennt Kunden, Standorte und Standort-Kunden-Zuordnungen.

**Files:**
- Modify: `src/app/pages/AssetDetailPage.tsx`
- Use types from: `src/app/lib/types.ts`

**Änderungen:**

- Import erweitern:

```ts
import { AssetNode, Customer, Location, LocationCustomer } from '../lib/types';
```

- Lokalen State ergänzen:

```ts
const [customerId, setCustomerId] = useState<string | null>(null);
const [locationId, setLocationId] = useState<string | null>(null);
const [customers, setCustomers] = useState<Customer[]>([]);
const [locations, setLocations] = useState<Location[]>([]);
const [locationCustomers, setLocationCustomers] = useState<LocationCustomer[]>([]);
```

- Beim Laden zusätzlich abrufen:

```ts
const [customersData, locationsData, locationCustomersData] = await Promise.all([
  repository.list<Customer>('customers'),
  repository.list<Location>('locations'),
  repository.list<LocationCustomer>('locationCustomers'),
]);
```

**Verification:**

- Asset-Formular lädt weiter ohne Console-Fehler.
- Keine Änderung an bestehenden Feldern sichtbar außer später ergänzten Selects.

---

### Task 2: Bestehende Asset-Zuordnung ins Formular übernehmen

**Objective:** Beim Bearbeiten bestehender Assets werden `customerId` und `locationId` korrekt angezeigt.

**Files:**
- Modify: `src/app/pages/AssetDetailPage.tsx`

**Änderungen:**

Im Edit-Load ergänzen:

```ts
setCustomerId(existingAsset.customerId || null);
setLocationId(existingAsset.locationId || null);
```

Im New-Mode initial:

```ts
setCustomerId(null);
setLocationId(null);
```

**Verification:**

- Bestehendes Asset mit gespeicherter Kundenzuordnung zeigt Kunde/Standort vorausgewählt.
- Neues Asset startet ohne Zuordnung.

---

### Task 3: Gefilterte Standort-Auswahl bauen

**Objective:** Standorte werden abhängig vom Kunden sinnvoll gefiltert.

**Files:**
- Modify: `src/app/pages/AssetDetailPage.tsx`

**Code-Skizze:**

```ts
const filteredLocations = customerId
  ? locations.filter((location) =>
      locationCustomers.some(
        (link) => link.customerId === customerId && link.locationId === location.id,
      ),
    )
  : [];

const handleCustomerChange = (newCustomerId: string | null) => {
  const nextCustomerId = newCustomerId || null;
  setCustomerId(nextCustomerId);
  setIsDirty(true);

  if (!nextCustomerId) {
    setLocationId(null);
    return;
  }

  const allowedLocationIds = new Set(
    locationCustomers
      .filter((link) => link.customerId === nextCustomerId)
      .map((link) => link.locationId),
  );

  if (locationId && !allowedLocationIds.has(locationId)) {
    setLocationId(null);
  }
};
```

**Verification:**

- Kunde A gewählt → nur Standorte von Kunde A sichtbar.
- Wechsel auf Kunde B → ungültiger alter Standort wird gelöscht.
- Kunde gelöscht → Standort wird gelöscht.

---

### Task 4: UI-Felder im Stammdaten-Tab ergänzen

**Objective:** Nutzer kann Kunde und Standort im Asset-Formular auswählen.

**Files:**
- Modify: `src/app/pages/AssetDetailPage.tsx`

**UI-Platzierung:**

Direkt nach **Parent (optional)** und vor **Tags**.

**Code-Skizze:**

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Kunde
  </label>
  <SearchableSelect
    value={customerId}
    onChange={(id) => handleCustomerChange(id)}
    options={customers.map((customer) => ({ id: customer.id, label: customer.name }))}
    placeholder="Kein Kunde zugeordnet"
    emptyOptionLabel="Kein Kunde zugeordnet"
    searchPlaceholder="Kunde suchen..."
  />
</div>

<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Standort
  </label>
  <SearchableSelect
    value={locationId}
    onChange={(id) => {
      setLocationId(id || null);
      setIsDirty(true);
    }}
    options={filteredLocations.map((location) => ({ id: location.id, label: location.name }))}
    placeholder={customerId ? 'Kein Standort zugeordnet' : 'Bitte zuerst Kunde wählen'}
    emptyOptionLabel="Kein Standort zugeordnet"
    searchPlaceholder="Standort suchen..."
  />
</div>
```

Falls `SearchableSelect` kein `disabled` unterstützt, im MVP nicht deaktivieren, sondern leere Optionsliste + Placeholder nutzen.

**Verification:**

- Im Screenshot-Flow ist klar erkennbar: Kundenzuordnung ≠ Kunden-Asset-ID.
- Felder sind im Stammdaten-Tab sichtbar.

---

### Task 5: Speichern erweitern

**Objective:** `customerId` und `locationId` werden im Asset gespeichert.

**Files:**
- Modify: `src/app/pages/AssetDetailPage.tsx`

**Änderung in `assetData`:**

```ts
customerId: customerId || null,
locationId: locationId || null,
```

**Wichtig:** Bestehende Felder nicht auf `undefined` setzen, falls Typ `AssetNode` `null` verlangt:

```ts
parentId: parentId || null,
tagIds: tagIds.length > 0 ? tagIds : [],
```

Nur ändern, wenn TypeScript/Build es verlangt; ansonsten minimal bleiben.

**Verification:**

- Neues Asset speichern → API/Repository-Datensatz enthält `customerId` und optional `locationId`.
- Asset erneut öffnen → Auswahl bleibt gesetzt.

---

### Task 6: Asset-Liste optional mit Kunde/Standort ergänzen

**Objective:** Zuordnung ist auch in der Übersicht prüfbar.

**Files:**
- Modify: `src/app/pages/Assets.tsx`

**MVP-Optionen:**

- Entweder eine neue kompakte Spalte **Kunde** ergänzen.
- Oder wegen Tabellenbreite nur die Suchfunktion um Kunden-/Standortnamen erweitern und Anzeige später verdichten.

**Empfehlung für MVP:**

- Neue Spalte **Kunde** nach Name.
- Standort vorerst nicht als eigene Spalte, um die bestehende breite Asset-Tabelle nicht weiter zu überladen.

**Verification:**

- Zugeordnetes Asset zeigt Kundennamen in der Liste.
- Nicht zugeordnetes Asset zeigt `—`.

---

## Tests / Checks

### Source-/Unit-Checks

Da es aktuell keine `AssetDetailPage.test.tsx` gibt, bevorzugt mindestens:

- kleine pure Helper-Funktion für Standortfilter extrahieren, z.B. `src/app/lib/assetAssignmentUtils.ts`
- Testdatei: `src/app/lib/assetAssignmentUtils.test.ts`

Testfälle:

```ts
import { describe, expect, it } from 'vitest';
import { filterLocationsForCustomer, shouldClearLocationForCustomer } from './assetAssignmentUtils';

describe('asset assignment utils', () => {
  it('filters locations by selected customer links', () => {
    // Kunde A sieht nur seine Standorte
  });

  it('clears selected location when customer changes to unrelated customer', () => {
    // alter Standort ist nicht mehr erlaubt
  });

  it('clears location when customer is removed', () => {
    // customerId null => locationId null
  });
});
```

Commands:

```bash
pnpm vitest run src/app/lib/assetAssignmentUtils.test.ts
pnpm build
```

### Browser-Smoke

1. App starten.
2. `/assets/new` öffnen.
3. Name eintragen.
4. Kunde auswählen.
5. Standort auswählen.
6. Speichern.
7. Asset erneut öffnen.
8. Prüfen: Kunde + Standort bleiben gesetzt.
9. Kunde wechseln.
10. Prüfen: alter Standort wird geleert, wenn nicht mehr gültig.
11. Console prüfen: keine Runtime-/API-Fehler.

---

## Akzeptanzkriterien

- [ ] Asset-Formular zeigt **Kunde** und **Standort** in Stammdaten.
- [ ] Standortauswahl hängt am gewählten Kunden.
- [ ] Kundenzuordnung wird nicht mit **Kunden-Asset-ID** verwechselt.
- [ ] Neue und bestehende Assets speichern/laden `customerId` und `locationId`.
- [ ] Wechsel des Kunden entfernt ungültige Standortauswahl.
- [ ] Bestehende Parent-/Tag-/ID-/Hersteller-Felder funktionieren unverändert.
- [ ] `pnpm build` läuft erfolgreich.
- [ ] Browser-Smoke ohne Console-Fehler.

---

## Nicht in diesem Schritt

- automatische Vererbung Kunde/Standort vom Parent-Asset
- Ansprechpartner-Overrides auf Asset-Ebene
- Massenbearbeitung mehrerer Assets
- neue DB-Migration, solange bestehende Spalten funktionieren
- Import-/OCR-Zuordnung aus Typenschildfotos
