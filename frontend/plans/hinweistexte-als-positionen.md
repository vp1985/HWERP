---
title: "Hinweistexte als eigene Positionen in Kalkulationen und Leistungspaketen"
status: geplant
priority: high
created: 2026-06-03
updated: 2026-06-03
---

# Hinweistexte als eigene Positionen

> **For Hermes:** Vor Umsetzung `test-driven-development` laden. Erst Helper-/Typ-Tests, dann UI. Nicht mit Preislogik vermischen.

**Goal:** Überall, wo in HWERP Serviceleistungen oder Material hinzugefügt werden können, kann zusätzlich ein freier Hinweistext eingefügt werden.

**Architecture:** Hinweistext wird als eigene positionsartige Zeile behandelt, nicht als Notiz an Service/Material. In Kalkulationen nutzt er `CalculationLineItem.type = 'info'`; in Leistungspaketen bekommt Paketposition ebenfalls `type = 'info'`. Hinweiszeilen haben keine Menge/Einheit/Preiswirkung, bleiben aber sortierbar, nummern-/druckfähig und beim Expandieren von Paketen erhalten.

**Tech Stack:** React/Vite + bestehendes Repository/Entity-Modell; PostgreSQL-Migration nur falls Backend/DB-Feld für Leistungspaketpositionen oder Kalkulationspositionen erweitert werden muss.

---

## Fachliche Entscheidung

- Begriff in der UI: **Hinweistext**.
- Funktion: fachliche Textzeile innerhalb einer Positionsliste.
- Gilt für:
  - Kalkulationen
  - spätere Angebote/Aufträge, sofern sie dieselben Positionslisten nutzen
  - Anfrage-Scope-Builder, wenn dort Material/Leistungen auswählbar sind
  - Leistungspakete
- Hinweistext ist kein Material, keine Leistung und keine Preisposition.
- Hinweistext kann frei platziert, verschoben, bearbeitet und gelöscht werden.
- Beispieltexte:
  - `Kunde stellt Zugang zum Trafo sicher.`
  - `Arbeiten nur nach Freischaltung und Erdung.`
  - `Fotos vom Typenschild vor Ort nachreichen.`

---

## Datenmodell

### Kalkulation: `CalculationLineItem`

Ist-Stand in `src/app/lib/types.ts`:

```ts
type: 'material' | 'service' | 'asset_header' | 'info'
```

Für Kalkulation ist `info` bereits vorgesehen. Zielzustand:

```ts
{
  type: 'info',
  description: string,
  quantity: 0,
  unit: '',
  unitPrice: 0,
  totalPrice: 0,
  materialId: null,
  serviceId: null,
  assetHeaderId: string | null
}
```

### Leistungspakete: Paketposition erweitern

Die geplante Paketposition darf nicht nur `service | material`, sondern auch `info` sein:

```ts
export type ServicePackageItemType = 'service' | 'material' | 'info';

export interface ServicePackageItem {
  id: string;
  packageId: string;
  type: ServicePackageItemType;
  serviceId: string | null;
  materialId: string | null;
  descriptionSnapshot: string;
  quantity: number;          // bei info: 0
  unitSnapshot: string;      // bei info: ''
  unitPriceSnapshot: number; // bei info: 0
  sortOrder: number;
}
```

DB-Constraint:

- `type = 'service'` → `service_id` gesetzt, `material_id` null
- `type = 'material'` → `material_id` gesetzt, `service_id` null
- `type = 'info'` → beide IDs null, Preisfelder 0

---

## UI-Anforderungen

### Gemeinsames Muster

In jeder Positionsliste mit `Serviceleistung hinzufügen` und `Material hinzufügen` zusätzlich:

- Button: `Hinweistext hinzufügen`
- Dialog oder Inline-Zeile mit Textarea
- Speichern erzeugt eine `info`-Position an derselben Einfügestelle wie Material/Leistung
- Hinweiszeile zeigt nur Text + Aktionen, keine Preis-/Mengenfelder
- Hinweiszeilen zählen nicht in Summen hinein
- Hinweiszeilen bleiben sortierbar und löschbar

### Kalkulation

Datei voraussichtlich:

- `src/app/pages/CalculationDetailPage.tsx`

Umsetzung:

- Funktion `addInfoToCalculation(text: string)` ergänzen.
- Einfügepunkt `insertAfterId` genauso nutzen wie bei Service/Material.
- In Positionszeile für `type === 'info'` Textarea/Inline-Text anzeigen.
- `updateLineItem` darf bei `info` keine Preisneuberechnung aus Menge/Einzelpreis erzwingen oder bleibt mit 0 stabil.

### Leistungspakete

Für die geplante/zu bauende Seite:

- Paketpositionen erhalten `Hinweistext hinzufügen` neben `Leistung hinzufügen` und `Material hinzufügen`.
- `computePackageValue` ignoriert `info` bzw. zählt 0.
- Beim Einfügen eines Leistungspakets in eine Kalkulation wird jede `info`-Paketposition zu einer `CalculationLineItem` mit `type: 'info'` expandiert.

### Anfrage-Scope-Builder

Wenn der vorhandene Scope-Builder Material/Leistung auswählt:

- `Hinweistext hinzufügen` ebenfalls anbieten.
- Im Anfragemodul bleibt es preisfrei; Hinweistext wird Teil des fachlichen Umfangs.

---

## Akzeptanzkriterien

- In der Kalkulation kann ich neben Material und Serviceleistung einen Hinweistext einfügen.
- Der Hinweistext bleibt an der gewählten Position und kann verschoben werden.
- Der Hinweistext verändert keine Summen.
- Der Hinweistext kann einem Asset-/Headerblock untergeordnet werden, wenn er dort eingefügt wird.
- Leistungspakete können Hinweistext-Positionen enthalten.
- Beim Übernehmen eines Leistungspakets in eine Kalkulation bleiben Hinweistext-Positionen erhalten.
- Druck/Export zeigt Hinweistexte als Textzeilen, ohne Menge/Preis.

---

## Umsetzungsschritte

### 1. Tests für Kalkulations-Hinweise

- Test für Factory/Helper `buildInfoCalculationLineItem`.
- Test: `totalPrice` bleibt 0.
- Test: `assignPositionNumbers` lässt `info` ohne Positionsnummer oder nach bestehender Regel stabil.
- Test: Einfügen nach Header übernimmt `assetHeaderId` korrekt.

### 2. UI in Kalkulation ergänzen

- Button/Action `Hinweistext hinzufügen` bei den vorhandenen Add-Aktionen ergänzen.
- Dialog/Inline-Editor bauen.
- `addInfoToCalculation` implementieren.
- Anzeige der `info`-Zeile preisfrei darstellen.

### 3. Leistungspaket-Plan/Typen erweitern

- `ServicePackageItem.type` um `info` erweitern.
- Paketwert-Helper testet, dass `info` 0 beiträgt.
- Paket-UI bekommt denselben Button.

### 4. Paket-Expansion testen

- Test: Paket mit Service + Material + Hinweis wird in drei Kalkulationspositionen expandiert.
- Hinweis wird als `type: 'info'` übernommen.
- Reihenfolge bleibt erhalten.

### 5. Verifikation

Ausführen:

```bash
pnpm test
pnpm build
```

Browser-Smoke:

- `/calculations/new`: Material, Serviceleistung und Hinweistext einfügen.
- Hinweistext verschieben und speichern.
- Summe prüfen: unverändert durch Hinweistext.
- Leistungspaket mit Hinweistext anlegen, falls Modul bereits umgesetzt ist.

---

## Empfohlene MVP-Reihenfolge

1. Kalkulation: Hinweistext als bestehende `info`-LineItem-Zeile aktivieren.
2. Leistungspaket-Datenmodell direkt mit `info` planen/umsetzen.
3. Paket → Kalkulation Expansion inklusive Hinweistext.
4. Danach Export/Druck hübsch nachziehen.
