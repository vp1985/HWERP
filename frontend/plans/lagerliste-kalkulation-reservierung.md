---
title: "Trafo-Lagerliste: Verkaufskalkulation und Reservierung"
status: geplant
priority: high
created: 2026-06-09
updated: 2026-06-09
---

# Trafo-Lagerliste: Verkaufskalkulation und Reservierung

> **For Hermes:** Vor Umsetzung `user-webapp-default-workflow`, `test-driven-development` und die Referenzen `hwerp-static-excel-inventory-import.md`, `react-vite-shared-datatable-inventory.md` sowie `hwerp-hinweistexte-positionen.md` laden. Umsetzung per TDD: erst Overlay-/Reservierungslogik testen, dann Persistenz, dann UI.

**Goal:** Eigene Lagertrafos und Fremdlager-Trafos können über den Detailbildschirm direkt für den Verkauf kalkuliert, einer neuen oder bestehenden Kalkulation hinzugefügt und für einen Kunden über einen Zeitraum reserviert werden. Zusätzlich können Fotos/Dokumente je Trafo hinterlegt werden. In der Lagerliste selbst wird nur der Status um `Reserviert` ergänzt; Kalkulations-, Kosten-, Foto-/Dokumenten-, Reservierungs- und Angebotsdetails sind über Klick auf die HT-Nummer im Detailbildschirm sichtbar.

**Architecture:** Die eigene Excel-Lagerliste und die Fremd-Lagerliste sind nur Eingangsquellen. Beim Import werden die Zeilen in die HWERP-Datenbank übernommen/aktualisiert; ab dann arbeitet die App ausschließlich gegen die DB, nicht live gegen Excel-Dateien. Alles, was angeboten werden soll, muss mindestens als DB-Lagertrafo existieren; externe Quellen wie eBlackout, TrafoRadar, Händlerangebote oder manuelle Eingaben werden zuerst in die Fremd-Lagerliste/DB übernommen. Dynamische Verkaufs-/Reservierungs-/Kalkulationsdaten werden als separate DB-Entities gespeichert, keyed by stabiler Lager-Referenz (`own:HT0001`, `external:<id>` etc.). Kalkulationszeilen erhalten optional eine Lagerreferenz, damit eigene und fremde Lagertrafos sauber mit Kalkulationen verknüpft werden können, auch wenn noch kein echtes `AssetNode` existiert.

**Tech Stack:** React 18 + TypeScript + Vite, Express `entities`-Repository, bestehende `DataTable`, bestehende `CalculationDetailPage`-LineItems, bestehende Kunden-Entity.

---

## Ist-Zustand

- Lagerliste ist unter `src/app/features/transformer-inventory/` implementiert.
- Daten liegen statisch in `data/transformerInventory.ts` und haben `position`, Hersteller, technische Daten, `soldTo`, `priceNote` usw.
- Liste nutzt bereits die zentrale `DataTable` und Preisberechtigungen.
- Kalkulationen existieren unter `/calculations` und `/calculations/new`.
- `CalculationLineItem` kann `type: 'asset_header'` und optional `assetNodeId` speichern.
- Der aktuelle Lagerstatus kennt nur `available | sold | scrapped | unchecked`; Reservierung ist noch nicht eigenständig modelliert.
- Es gibt noch keine gleichwertige **Fremd-Lagerliste** für angebotene, aber nicht eigene Trafos.

## Geklärte Entscheidungen

- Kalkulation muss für **eigene Lagertrafos** und **Fremdlager-Trafos** funktionieren.
- Alles, was angeboten werden soll, wird vorher mindestens in die Fremd-Lagerliste übernommen.
- Eigene Lagerliste und Fremd-Lagerliste werden auf **einer gemeinsamen Trafo-Lager-Seite** angezeigt, nicht als getrennte Hauptseiten.
- Fremd-Lagerliste ist bewusst dauerhaft: auch händisch angebotene Händlertrafos werden dort gepflegt, damit sie später wiedergefunden und direkt kalkuliert werden können.
- In der Tabellenansicht reicht eine Spalte **Eigentümer**. Dort steht entweder `HT-VOLTEQ` für Eigenbestand oder der jeweilige fremde Eigentümer/Händlername.
- Quelle/Herkunft wie eBlackout, TrafoRadar, Händlerangebot oder manuelle Eingabe muss nicht prominent in der Tabelle stehen; diese Details gehören in die Detailansicht bzw. ein Modal/Fenster zum Anschauen und Bearbeiten.
- Externe Quellen werden nicht direkt kalkuliert, sondern zuerst als Fremdlager-Eintrag normalisiert.
- Eigene Lagerliste und Fremd-Lagerliste sollen in der Kalkulation gleich behandelt werden; Unterschied ist vor allem der Eigentümer sowie Verfügbarkeit/Aktualität.
- Die Lagerliste bleibt in HWERP normal nutzbar und wird nach dem Import aus der DB gelesen; Excel ist kein Laufzeit-Datenspeicher.
- Wenn später eine neue Excel-Liste geliefert wird, wird sie als **DB-Update** verarbeitet: gleicher Trafo-Key (`Pos.`/`HT0001`) = bestehender Lagertrafo, nur geänderte Importfelder werden im DB-Stammdatensatz übernommen.
- HWERP-interne Overlay-Daten wie Reservierungen, Kalkulationslinks und manuelle Verlaufseinträge werden durch Excel-Updates nicht still überschrieben.

## Offene Entscheidungen

- Standardwerte sollen pflegbar sein nach kVA-Bereich, Spannungsebene, Öl/Gießharz, Export/Normal, Zustand, Baujahr, Gewicht, Entfernung und Herkunft; weitere Kriterien können später ergänzt werden.
- Standardwerte sollen primär als **Staffelpreise/-aufwände nach Leistungsbereich** gepflegt werden, z. B. `bis 160 kVA = 500 €`, `161–250 kVA = 600 €`, usw. Prozentuale Faktoren sind nur ergänzend sinnvoll, nicht als Hauptmodell.
- Zusätzlich sollen je Kostenposition feste Beträge, Stundenaufwand × Stundensatz, Prozentwerte und Pakete aus Leistungen/Material möglich bleiben, damit elektrische Prüfungen eher fix/gestaffelt und transport-/wertbezogene Positionen ggf. anders kalkuliert werden können.
- Elektrische Prüfungen und vergleichbare Leistungen werden aus dem bestehenden Service-Katalog / den Serviceleistungen übernommen; keine separate parallele Prüfungs-Stammdatenstruktur.
- Kalkulationsarten werden benötigt: **Einkaufskalkulation** und **Verkaufskalkulation** sind Pflicht. Export muss nicht als eigene Art starten, sondern kann als Verkaufskalkulation mit anderer Vorlage/Regel laufen, bei der Aufbereitung, Gewährleistung usw. weggelassen werden.
- Verkaufskalkulation Deutschland braucht Gewährleistung als kalkulierbare Position, z. B. 6 Monate oder 12 Monate. Gewährleistungskosten sollen je Regel als fester Betrag oder prozentualer Wert pflegbar sein; später ggf. umstellbar/erweiterbar.
- Einkaufskalkulation muss zwei Fragen unterstützen:
  - **Maximaler Einkaufspreis:** Bis zu welchem Preis darf der Einkauf den Trafo kaufen? Grundlage: erwarteter Verkaufspreis minus erwartete Kosten minus gewünschte Marge/Risiko.
  - **Kostenbasis nach Kauf:** Wenn der Trafo bereits gekauft oder ein Kauf nötig war, wird daraus der Mindest-/Untergrenzen-Verkaufspreis bzw. eine Verkaufspreisspanne abgeleitet.
- Verkaufskalkulation nutzt Preisgruppen/Preislisten. MVP soll mindestens drei Preiskategorien unterstützen, z. B. Export, Wiederverkäufer und normaler Verkauf/Endkunde.
- Kalkulation soll mit **Vorlagen/Standardpaketen** arbeiten, nicht nur mit Preisgruppe + Zusatzoptionen.
- Start-Vorlagen: `Verkauf Deutschland`, `Export`, `Wiederverkäufer`, `Einkauf schnell`, `Einkauf detailliert`.
- Vermittlung/Provision ist **keine eigene Kalkulationsart**, sondern eine optionale Position innerhalb der Verkaufskalkulation.
- Kalkulation darf auch mit unvollständigen Trafodaten gestartet werden. Fehlende Werte werden markiert und können manuell ergänzt/überschrieben werden.
- Trafos aus der Lagerliste müssen einem **Angebot** hinzugefügt werden können: aus dem Detailbildschirm der HT-Nummer heraus per Aktion `Zum Angebot hinzufügen` oder aus einem Angebot heraus per `Lagertrafo hinzufügen`.
- Der Angebots-/Kalkulationsposten speichert die stabile Lagerreferenz (`own:HT0001` / `external:<id>`), einen Snapshot der Trafodaten und bleibt mit dem Lagertrafo verknüpft, damit später Status/Reservierung/Verkauf nachvollziehbar sind.
- Es darf mehrere Kalkulationen/Angebote pro Trafo geben, z. B. für verschiedene Kunden, Preisgruppen oder Zeitpunkte.
- Wenn ein Fremdtrafo gekauft wird, wird er **manuell** in den eigenen Lagerbestand übernommen; daraus wird im MVP nicht automatisch ein Asset.
- Ein Trafo wird erst dann ein **Asset**, wenn er einem Kunden zugeordnet wird – entweder in dessen Lager, eingesetzt in dessen System/Anlage oder als Miettrafo beim Kunden.
- Auch ein vermieteter Trafo geht in die Kunden-Assets, bleibt aber wirtschaftlich/vertraglich als Mietobjekt bzw. HT-VOLTEQ-Eigentum erkennbar.
- Lagertrafo ↔ Asset bleibt daher bewusst manuell: Lagertrafos sind verkaufbarer Bestand, Assets sind kunden-/standortbezogene Objekte.
- Bei Fremdtrafos wird für die Aktualität das Feld **`aktualisiert am`** genutzt; es zeigt, wann der Fremdtrafo zuletzt gepflegt/geprüft wurde.
- Gewährleistungsoptionen für den Start: `keine`, `6 Monate`, `12 Monate`, `individuell`.
- Gewährleistung kommt unabhängig von der Preisgruppe zusätzlich dazu, wenn sie angeboten wird.
- MVP soll dafür eine einfache Lösung wählen: Preisgruppe auswählen, daraus Ziel-/Listenpreis vorschlagen, danach Gewährleistung und Zusatzkosten addieren.
- Verkaufskalkulation nutzt diese Kostenbasis, um Mindestpreis, Zielpreis und Marge sichtbar zu machen.
- Preis-/Kalkulationssicht ist ein einfaches Recht: Entweder ein User darf Preise sehen oder nicht. Keine getrennten Rechte für Einkaufspreis, Selbstkosten, Marge, Verkaufspreis.
- Bearbeitungsrechte können später separat über allgemeine Modul-/Adminrechte geregelt werden, sind aber nicht Teil der Preissicht-Entscheidung.
- Statusfilter für die Lagerliste: `verfügbar`, `reserviert`, `verkauft`, `verschrottet`, `ungeprüft`, `nicht mehr verfügbar`.
- Technische Tabellenfelder bleiben getrennt wie in der Excel-/Lagerliste: **Leistung**, **Mittelspannung**, **Niederspannung** und **Schaltgruppe** werden nicht zu einer gemeinsamen `Technik`-Spalte zusammengezogen.
- In der Lagerliste wird **nur `Reserviert` im Status** ergänzt. EK, Selbstkosten, Ziel-VK, Marge, Kalkulationskunde/-datum, Reservierungsdetails und Preisnotizen gehören in den Detailbildschirm, der per Klick auf die HT-Nummer geöffnet wird.
- Trafodaten können im Detailbildschirm bearbeitet und gespeichert werden. Diese Änderungen werden als HWERP-Detail-/Override-Daten je `inventoryPosition` gespeichert; die ursprünglichen Excel-/Importwerte bleiben im Tab `Quelle / Import` nachvollziehbar.

---

## Zielverhalten

### 1. Verkauf kalkulieren aus dem Detailbildschirm

Klick auf die HT-Nummer öffnet den Detailbildschirm. Dort gibt es die Aktion **Kalkulieren**.

Flow:
1. Klick auf `HT0001` öffnet Details; dort öffnet `Kalkulieren` das Modal.
2. Auswahl:
   - Kunde: Pflichtfeld.
   - Kalkulation: bestehende offene Kalkulation des Kunden oder `Neue Kalkulation anlegen`.
   - Verkaufspreis: vorbelegt aus `priceNote`, wenn eindeutig parsebar; sonst leer.
   - Optionale Notiz.
3. Bestätigen:
   - Neue Kalkulation wird bei Bedarf angelegt.
   - Der Trafo wird als `asset_header`-Position in die Kalkulation eingefügt.
   - Die Position erhält `inventoryPosition: 'HT0001'` und eine beschreibende Snapshot-Bezeichnung.
   - Ein Overlay-Eintrag dokumentiert `calculatedAt`, `customerId`, `calculationId`, `inventoryPosition`.
4. Danach zeigt der Detailbildschirm z. B. `Kalkuliert: 09.06.2026 · Kunde Mustermann · K-000123`; die Lagerliste bleibt kompakt und zeigt nur den passenden Status.

### 2. Bestehender Kalkulation hinzufügen

- Das Modal erlaubt `Bestehende Kalkulation wählen`.
- Nur Kalkulationen des gewählten Kunden werden prominent angezeigt; optional `Alle Kalkulationen anzeigen` für Sonderfälle.
- Beim Hinzufügen zu einer vorhandenen Kalkulation wird keine neue Kalkulationsnummer erzeugt.
- Die neue Position wird am Ende eingefügt; spätere Verfeinerung per Drag/Sort in der Kalkulation bleibt möglich.

### 3. Reservieren aus dem Detailbildschirm

Im Detailbildschirm gibt es die Aktion **Reservieren**.

Flow:
1. Klick auf die HT-Nummer öffnet Details; dort öffnet `Reservieren` das Modal.
2. Auswahl:
   - Kunde: Pflichtfeld.
   - Zeitraum: `reservedFrom` und `reservedUntil`, Pflichtfelder.
   - Optionaler Bezug auf Kalkulation.
   - Optionaler Hinweis.
3. Validierung:
   - `reservedUntil >= reservedFrom`.
   - Keine Überschneidung mit aktiver Reservierung derselben `inventoryPosition`.
   - Verkauft/Verschrottet kann nicht reserviert werden.
4. Liste zeigt nur den aktiven Status `Reserviert`; Kunde/Zeitraum stehen im Detailbildschirm.
5. Abgelaufene Reservierungen blockieren nicht mehr, bleiben aber im Verlauf sichtbar.

### 4. Statuslogik

Erweiterung der abgeleiteten Anzeige:

- `scrapped`: Schrott/Verschrottet bleibt höchste Priorität.
- `sold`: bestehende `soldTo`/verkauft-Logik bleibt.
- `reserved`: aktive, nicht abgelaufene Reservierung aus Overlay.
- `available`: Listing-/Verfügbarkeitsflag und keine aktive Reservierung.
- `unchecked`: sonst.

Wichtig: Reservierung ist nicht dasselbe wie Verkauf. Bisherige Summenkarte `Verkauft/Reserviert` wird getrennt in `Verkauft` und `Reserviert`.

---

## Datenmodell

### Neue Entity: `TransformerInventoryCalculationLink`

In `src/app/lib/types.ts`:

```ts
export interface TransformerInventoryCalculationLink extends BaseEntity {
  inventoryPosition: string;
  customerId: string;
  calculationId: string;
  calculatedAt: string;
  note: string | null;
}
```

### Neue Entity: `TransformerInventoryReservation`

```ts
export type TransformerInventoryReservationStatus = 'active' | 'released' | 'cancelled';

export interface TransformerInventoryReservation extends BaseEntity {
  inventoryPosition: string;
  customerId: string;
  calculationId: string | null;
  reservedFrom: string; // ISO date YYYY-MM-DD
  reservedUntil: string; // ISO date YYYY-MM-DD
  status: TransformerInventoryReservationStatus;
  note: string | null;
  createdByUserId: string | null;
}
```

### Neue Entity: `TransformerInventoryDetailOverride`

```ts
export interface TransformerInventoryDetailOverride extends BaseEntity {
  inventoryPosition: string;
  fields: Partial<Pick<TransformerInventoryItem,
    | 'manufacturer'
    | 'powerKva'
    | 'primaryVoltageKv'
    | 'secondaryVoltageV'
    | 'vectorGroup'
    | 'serialNumber'
    | 'constructionYear'
    | 'constructionType'
    | 'weightKg'
    | 'origin'
    | 'connectionType'
    | 'note'
  >>;
  updatedAt: string;
  updatedByUserId: string | null;
}
```

Regel: Die Liste zeigt effektive Werte aus `DB-Importstammdaten + HWERP-Override`. Der Detailbildschirm zeigt zusätzlich, welche Werte aus dem letzten Excel-Import in der DB stehen und welche in HWERP überschrieben wurden.

### Neue Entity: `TransformerInventoryAttachment`

```ts
export type TransformerInventoryAttachmentType = 'photo' | 'document';

export interface TransformerInventoryAttachment extends BaseEntity {
  inventoryPosition: string;
  type: TransformerInventoryAttachmentType;
  fileName: string;
  mimeType: string;
  storageKey: string; // Datei-/Object-Storage-Pfad, nicht Excel
  caption: string | null;
  uploadedAt: string;
  uploadedByUserId: string | null;
}
```

Regel: Foto-/Datei-Metadaten liegen in der DB; die eigentliche Datei liegt im HWERP-Upload-/Dateispeicher oder später Object Storage. Verknüpfung erfolgt über `inventoryPosition`.

### Erweiterung: `CalculationLineItem`

```ts
inventoryPosition?: string | null;
```

Grund: Lagerlisten-Positionen sind aktuell statisch und nicht zwingend `AssetNode`. Wenn später alle Lagertrafos echte Assets werden, kann zusätzlich `assetNodeId` gesetzt werden, ohne alte Kalkulationsverknüpfungen zu verlieren.

### Persistenz

- `server/routes/entities.ts`: neue Entity-Keys ergänzen.
- `server/routes/reset.ts`: neue Entities beim Reset berücksichtigen.
- Dokumentarische Migration ergänzen, z. B. `migrations/014_transformer_inventory_sales_reservations.sql`.
- Upload-Route/Dateispeicher für `TransformerInventoryAttachment.storageKey` ergänzen, falls noch keine generische Dateiablage wiederverwendbar ist.

---

## Umsetzungsschritte

### Task 0: Excel-Update-Import als Merge-Regel absichern

**Objective:** Neue Excel-Listen aktualisieren bestehende DB-Lagertrafos über stabile Keys und erzeugen keine Dubletten. Nach dem Import arbeitet HWERP nur noch mit den DB-Datensätzen.

**Files:**
- Modify/Create: `src/app/features/transformer-inventory/importMerge.ts`
- Modify: `src/app/features/transformer-inventory/transformerInventory.test.ts`
- Modify: bestehendes Import-/Generator-Skript, falls vorhanden

**RED Tests:**
- Gleiche `position`/`HT0001` bleibt derselbe Lagertrafo.
- Nur geänderte Excel-Felder werden im Stammdatensatz ersetzt.
- Nicht mehr gelieferte, aber vorhandene HWERP-Overlay-Daten bleiben erhalten.
- Neue HT-Nummer wird ergänzt.
- Kein doppelter Eintrag für gleiche HT-Nummer.

**Regel:** Excel ist Importquelle für Lager-Stammdatenfelder, aber kein aktiver App-Speicher. HWERP liest/schreibt Lager, Reservierungen, Kalkulationslinks und manuelle Änderungen nach dem Import ausschließlich in der DB.

### Task 1: Overlay-Types und Tests für Status-Merge

**Objective:** Die Lagerliste kann statische Trafo-Daten mit Kalkulations-/Reservierungs-Overlays zusammenführen.

**Files:**
- Modify: `src/app/features/transformer-inventory/types.ts`
- Create: `src/app/features/transformer-inventory/overlayUtils.ts`
- Modify: `src/app/features/transformer-inventory/transformerInventory.test.ts`
- Modify: `src/app/lib/types.ts`

**RED Tests:**
- Aktive Reservierung macht einen verfügbaren Trafo zu `reserved`.
- Verkauf/Verschrottung schlägt Reservierung.
- Abgelaufene oder `cancelled` Reservierung blockiert nicht.
- `getLatestCalculationLink(position, links)` liefert den neuesten Link.

**Run:**

```bash
pnpm exec vitest run src/app/features/transformer-inventory/transformerInventory.test.ts
```

Erwartung vor Implementierung: FAIL wegen fehlender Overlay-Helfer/status `reserved`.

### Task 2: Persistente Entities im Repository anmelden

**Objective:** Kalkulationslinks, Reservierungen, Detail-Overrides und Foto-/Dateianhänge können über das bestehende Repository geladen/gespeichert werden.

**Files:**
- Modify: `src/app/lib/types.ts`
- Modify: `src/app/context/AppStoreContext.tsx`
- Modify: `src/app/lib/repository.ts`
- Modify: `server/routes/entities.ts`
- Modify: `server/routes/reset.ts`
- Modify/Create: Upload-/Attachment-Route für Trafo-Fotos
- Create: `migrations/014_transformer_inventory_sales_reservations.sql`
- Test: `server/routes/entities.test.ts` oder passende Repository-Tests

**Tests:**
- Entity-Key `transformerInventoryCalculationLinks` roundtrip.
- Entity-Key `transformerInventoryReservations` roundtrip.
- Entity-Key `transformerInventoryDetailOverrides` roundtrip.
- Entity-Key `transformerInventoryAttachments` roundtrip.
- Foto-Upload speichert Datei + DB-Metadaten mit `inventoryPosition`.
- Optional `calculationLineItems.inventoryPosition` roundtrip.

### Task 2a: Editierbare Detaildaten als Override-Merge

**Objective:** Im Detailbildschirm geänderte Trafodaten werden gespeichert, ohne die importierten Excel-Rohdaten zu überschreiben.

**Files:**
- Create/Modify: `src/app/features/transformer-inventory/detailOverrides.ts`
- Modify: `src/app/features/transformer-inventory/overlayUtils.ts`
- Test: `src/app/features/transformer-inventory/transformerInventory.test.ts`

**RED Tests:**
- `mergeInventoryDetailOverride(importItem, override)` nutzt Override-Felder vor Import-Feldern.
- Leere Override-Felder überschreiben Importwerte nicht versehentlich.
- Original-Importwerte bleiben für `Quelle / Import` abrufbar.
- Excel-Refresh ersetzt Importwerte, lässt manuelle Overrides aber bestehen.

### Task 3: Kalkulationszeile aus Lagertrafo bauen

**Objective:** Ein Lagerlisten-Trafo wird deterministisch als `asset_header`-LineItem für Verkauf erzeugt.

**Files:**
- Create: `src/app/features/transformer-inventory/calculationBridge.ts`
- Test: `src/app/features/transformer-inventory/calculationBridge.test.ts`
- Modify: `src/app/lib/types.ts`

**RED Tests:**
- `buildInventorySaleLineItem(item, price)` setzt:
  - `type: 'asset_header'`
  - `inventoryPosition`
  - `description` mit HT-Nr., kVA, Spannung, Hersteller, Seriennummer
  - `quantity: 1`, `unit: 'Stk'`, `unitPrice`, `totalPrice`
  - `assetNodeId: null`, wenn kein Asset bekannt ist.
- Preis kann `0` sein, wenn aus Preisnotiz nicht parsebar.

### Task 4: Detail-Flow „Kalkulieren“

**Objective:** Nutzer kann über Klick auf die HT-Nummer im Detailbildschirm eine neue oder bestehende Kalkulation befüllen.

**Files:**
- Modify: `src/app/features/transformer-inventory/pages/TransformerInventoryPage.tsx`
- Modify: `src/app/features/transformer-inventory/tableConfig.tsx`
- Optional Create: `src/app/features/transformer-inventory/components/InventoryCalculationDialog.tsx`
- Tests: `src/app/features/transformer-inventory/transformerInventory.test.ts` source-/contract-level; wenn DOM-Harness verfügbar, Component-Test ergänzen.

**UI Contract:**
- Keine neue DataTable-Aktionsspalte für `Kalkulieren`.
- HT-Nummer/`position` ist klickbar und öffnet den Detailbildschirm.
- Detailbildschirm zeigt `Kalkulieren` als Aktion und öffnet dort das Modal.
- Modal zeigt Kunde, Kalkulation, Verkaufspreis, Notiz.
- Bei Erfolg:
  - Calculation wird angelegt oder aktualisiert.
  - LineItem wird gespeichert.
  - `TransformerInventoryCalculationLink` wird gespeichert.
  - Detailbildschirm aktualisiert Metadaten ohne Reload; Liste bleibt kompakt.

### Task 5: Detail-Flow „Reservieren“

**Objective:** Nutzer kann über den Detailbildschirm einen Trafo für einen Kunden und Zeitraum reservieren.

**Files:**
- Modify/Create: `src/app/features/transformer-inventory/components/InventoryReservationDialog.tsx`
- Modify: `src/app/features/transformer-inventory/pages/TransformerInventoryPage.tsx`
- Modify: `src/app/features/transformer-inventory/overlayUtils.ts`
- Tests: `src/app/features/transformer-inventory/transformerInventory.test.ts`

**RED Tests:**
- `validateReservationRange` lehnt Ende vor Start ab.
- `findReservationConflict` erkennt Überschneidungen je `inventoryPosition`.
- Nicht überlappende Reservierung ist erlaubt.
- Verkauft/Verschrottet kann nicht reserviert werden.

### Task 6: Anzeige-Spalten und Filter erweitern

**Objective:** Liste bleibt nahe an der Excel-/Lagerlisten-Tabelle und zeigt nur `Reserviert` als zusätzlichen Status; Details laufen über Klick auf die HT-Nummer.

**Files:**
- Modify: `src/app/features/transformer-inventory/tableConfig.tsx`
- Modify: `src/app/features/transformer-inventory/pages/TransformerInventoryPage.tsx`
- Modify: `src/app/features/transformer-inventory/utils.ts` oder `overlayUtils.ts`
- Test: `src/app/features/transformer-inventory/transformerInventory.test.ts`

**Spalten:**
- Bestehende technische Lagerlisten-Spalten bleiben getrennt: `Leistung`, `Mittelspannung`, `Niederspannung`, `Schaltgruppe` usw.; keine zusammengefasste `Technik`-Spalte.
- `Status`: enthält `Reserviert` als eigenen Chip.
- Keine eigenen Listenspalten für `Kalkuliert`, `Reservierung`, `Preisnotiz`, EK/Selbstkosten oder Aktionen.
- Klick auf `Pos.`/HT-Nummer öffnet den Detailbildschirm mit Kalkulieren, Reservieren, Selbstkosten, Verlauf und Angebotsbezug.

**Filter:**
- Statusfilter erweitert um `reserved`.
- Suche findet Kundenname, Kalkulationsnummer und Reservierungsnotiz.

### Task 7: Browser-/API-Smoke

**Objective:** Realer Flow ist im Browser nutzbar und persistiert.

**Commands:**

```bash
pnpm exec vitest run src/app/features/transformer-inventory/transformerInventory.test.ts
pnpm exec vitest run src/app/features/transformer-inventory/calculationBridge.test.ts
pnpm exec vitest run
pnpm build
```

**Browser-Smoke:**
1. Dev-/Preview-Server starten.
2. `/transformer-inventory` öffnen.
3. Nach bekannter HT-Nr. suchen.
4. Auf HT-Nummer klicken und Detailbildschirm öffnen.
5. Im Detailbildschirm `Kalkulieren` öffnen, Kunde wählen, neue Kalkulation erzeugen.
6. Kalkulation öffnen: Trafo-Position ist enthalten.
7. Zurück zum Detailbildschirm, `Reservieren` öffnen.
8. Kunde + Zeitraum setzen.
9. Prüfen: Lagerliste zeigt nur Statuschip `Reserviert`; Kunde/Zeitraum sind im Detailbildschirm sichtbar.
10. Console auf Fehler prüfen.
11. Falls Smoke-Testdaten angelegt wurden: wieder löschen oder klar als Testdatensatz markieren.

---

## Mockups

- HTML-Mockup: `plans/lagerliste-kalkulation-reservierung-mockups.html`
- Enthalten:
  - gemeinsame Trafo-Lagerliste im bestehenden DataTable-Stil;
  - getrennte technische Spalten wie in der Tabelle: Leistung, Mittelspannung, Niederspannung, Schaltgruppe;
  - KPI-Karten und Status-/Detailfilter;
  - keine breiten Kalkulations-/Preis-/Reservierungsdetails in der Liste außer Status `Reserviert`;
  - HT-Nummer als Einstieg in den Detailbildschirm;
  - Detail-/Verlaufsmodal mit Tabs für Übersicht, Fotos/Dokumente, Selbstkosten, Kalkulationen, Reservierungen, Quelle/Import und Änderungsverlauf.
  - editierbare Trafodaten im Detailbildschirm mit `Speichern`; Originalwerte bleiben im Tab `Quelle / Import` sichtbar.

## Akzeptanzkriterien

- Aus jeder nicht verkauften/nicht verschrotteten Lagerzeile kann eine Verkaufskalkulation gestartet werden.
- Ein Trafo kann einer bestehenden oder neuen Kalkulation hinzugefügt werden.
- Detailbildschirm zeigt pro Trafo die letzte Kalkulation mit Datum, Kunde und Kalkulationsnummer.
- Detailbildschirm erlaubt das Ändern und Speichern von Trafodaten; Excel-/Importdaten werden dabei nicht zerstört.
- Detailbildschirm erlaubt Foto-Uploads je Trafo; Fotos bleiben über die HT-Position mit dem DB-Lagertrafo verknüpft.
- Ein Trafo kann für Kunde + Zeitraum reserviert werden; die Lagerliste zeigt dafür nur den Status `Reserviert`, Details stehen im Detailbildschirm.
- Überschneidende aktive Reservierungen werden verhindert.
- Reservierung ist ein eigener Status und wird nicht als Verkauf gezählt.
- Statische Importdaten werden nicht überschrieben; dynamische Daten liegen in Overlay-Entities.
- Neue Excel-Listen werden als Update/Merge über die stabile HT-Nummer verarbeitet; geänderte Felder werden übernommen, Dubletten werden verhindert.
- HWERP-interne Reservierungen/Kalkulationslinks bleiben bei Excel-Updates erhalten, außer eine spätere explizite Reconcile-Funktion wird beauftragt.
- Preisnotizen bleiben weiterhin berechtigungsgesteuert/maskiert.

---

## Risiken / offene Entscheidungen

- **Statische Lagerliste vs. echte Assets:** MVP nutzt `inventoryPosition` als stabile Referenz. Später kann ein Migrationsschritt Lagertrafos in echte `AssetNode`s überführen.
- **Kunde Pflicht beim Kalkulieren:** Für die gewünschte Anzeige „für wen“ ist Kunde im MVP Pflicht.
- **Reservierungszeitraum:** MVP nutzt Tagesgenauigkeit (`YYYY-MM-DD`), keine Uhrzeiten.
- **Konfliktregel:** MVP blockiert jede Überschneidung für dieselbe HT-Position strikt. Override nur später mit Rechteprüfung.
- **Preis aus `priceNote`:** Nur automatisch übernehmen, wenn eindeutig parsebar; sonst manuelle Eingabe.
