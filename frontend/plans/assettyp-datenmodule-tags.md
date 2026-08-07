# Assettyp, Datenmodule/Ausstattung und Tags sauber trennen Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Status:** geplant
**Priorität:** hoch
**Erstellt:** 2026-06-04
**Aktualisiert:** 2026-06-04

**Goal:** HWERP trennt künftig eindeutig zwischen Assettyp/Kategorie, fachlichen Datenmodulen bzw. Ausstattung und normalen Tags/Labels.

**Architecture:** `asset_type_id` bleibt die Hauptkategorie des Assets und aktiviert automatisch ein oder mehrere Basis-Datenmodule. Zusätzliche Ausstattung wird als eigene Asset-Modul-Zuordnung gespeichert und kann weitere Fachfelder/Tabs aktivieren. Normale Tags bleiben reine Filter/Labels und schalten keine Fach-Tabs mehr frei.

**Tech Stack:** React/Vite/TypeScript, Express API, PostgreSQL-Migrationen, Vitest, bestehende HWERP Repository/API-Struktur.

---

## Fachentscheidung

### 1. Assettyp / Kategorie

Der Assettyp beantwortet: **Was ist das Asset hauptsächlich?**

Beispiele:

- `Trafostation`
- `Transformator`
- `Transformator` (Standard: 2-Wickler)
- `Transformator – 3-Wickler` (nur als Abweichung/Sonderfall markieren)
- `Leistungsschalter`
- `Schaltanlage (MS)`
- `NSHV`

Der Assettyp setzt automatisch mindestens ein Basis-Datenmodul:

- Assettyp `Trafostation` → Modul `Station`
- Assettyp `Transformator...` → Modul `Trafo`
- Assettyp `Leistungsschalter` → Modul `Leistungsschalter`
- Assettyp `Schaltanlage` → Modul `Schaltanlage`
- Assettyp `NSHV` → Modul `NSHV`

### 1a. Trafo-Varianten: 2W ist Standard, 3W explizit

Wichtig: `2W` wird nicht als zusätzlicher Tag/Marker geführt, weil Standardtrafos normalerweise 2-Wickler sind.

Nur Abweichungen mit fachlicher Relevanz werden explizit markiert:

- `3W / Dreiwickler`
  - braucht zusätzliche Felder, z. B. mehrere Niederspannungen.
  - ist später wichtig für Lager-/Markt-/Suchabgleich: ein 3W-Trafo darf nicht wie ein Standard-2W-Trafo behandelt werden.

### 1b. Trafo-Eigenschaften: Bauart und Ausführung

`Öl`, `Gießharz`, `Hermetik` und `Ausdehner` sind **keine normalen Tags** und auch nicht der Haupt-Assettyp.

Sie werden als strukturierte Trafo-Eigenschaften/Fachdaten im Modul `Trafo` abgefragt, damit sie später sauber gesucht, gefiltert und sortiert werden können.

Empfohlene Felder im Trafo-Modul:

- `trafoKind` / `Bauart`
  - Werte: `Öltransformator`, `Gießharztransformator`, optional später weitere Bauarten.
- `windingCount` / `Wicklungen`
  - Standard: `2W`
  - auswählbar/markiert: `3W`, weil mehrere Niederspannungen nötig sind.
- `oilSystem` / `Ölsystem` nur wenn `Bauart = Öltransformator`
  - Werte: `Hermetisch`, `Ausdehner`, optional `sonstige/offen`.
- bei `3W`: zusätzliche Spannungsfelder, z. B. `NS1`, `NS2`, ggf. `NS3`.

Damit gilt:

- Assettyp `Transformator` → Modul `Trafo`
- Im Trafo-Modul werden Bauart/Ausführung erfasst.
- Suche/Marktabgleich filtert nach diesen strukturierten Feldern, nicht nach Tags.

Faustregel: Standard nicht extra markieren; such- und fachrelevante Eigenschaften als echte Felder pflegen.

### 2. Datenmodule / Ausstattung

Datenmodule beantworten: **Welche fachlichen Zusatzdaten braucht dieses Asset?**

Sie ersetzen die heutige tag-gesteuerte Tab-Logik.

Beispiele für eine kleine Trafostation als ein Asset:

- Assettyp: `Trafostation`
- automatisch: `Station`
- zusätzlich auswählbare Ausstattung/Datenmodule:
  - `Trafo`
  - `Schaltanlage`
  - `NSHV`
  - `Sicherungen`

Diese Module können Tabs oder kompaktere Zusatzfeldgruppen freischalten. Nicht jedes Modul muss ein eigener großer Tab sein.

### 3. Normale Tags / Labels

Tags beantworten: **Wie will ich suchen, filtern oder markieren?**

Beispiele:

- `kritisch`
- `Altanlage`
- `20kV`
- `Reserve`
- `geprüft 2026`
- `Kunde-priorisiert`

Tags erzeugen künftig **keine** Fach-Tabs mehr.

### 4. Parent-/Child-Asset-Regel

**Kleine Station:**

- ein Asset `Trafostation`
- Ausstattung/Datenmodule am selben Asset
- Vorteil: gesamte Station auf einen Blick

**Große Anlage / Industrieanlage:**

- Parent-Asset `Trafostation` oder `Anlage`
- Child-Assets:
  - `Trafo 1`
  - `Leistungsschalter 1`
  - `Schaltanlage 1`
  - `NSHV 1`
- Vorteil: eigene Lebensakten, Seriennummern, Wartungen, Historie je Komponente

### 5. Spätere Idee: Datenmodul in Child-Asset umwandeln

Nicht im ersten Umsetzungsschritt bauen, aber vormerken:

- Button/Action: `Als eigenes Child-Asset auslagern`
- Beispiel: Modul `Trafo` in einer kleinen Station wird später doch ein eigenes Asset.
- Migration kopiert relevante Felder in neues Child-Asset und entfernt/archiviert das Modul am Parent.

---

## Aktueller Ist-Zustand im Code

Relevante Dateien:

- `src/app/config/assetTabRules.ts`
  - Tabs werden aktuell über Tags berechnet.
  - Regeln: `Trafo`, `Schaltanlage`, `Leistungsschalter`.
- `src/app/pages/AssetDetailPage.tsx`
  - nutzt `getActiveTabsForAsset(tagIds, tags)`.
  - `TagPicker` im Asset-Formular steuert damit aktuell die Zusatz-Tabs.
- `src/app/lib/types.ts`
  - `AssetNode.assetTypeId?: string | null` existiert bereits.
  - Kommentar sagt aktuell noch, Klassifizierung laufe über Tags; das muss geändert werden.
- `migrations/001_initial_schema.sql`
  - `assets.asset_type_id` existiert bereits.
  - `asset_types` existiert bereits.
  - `asset_tags` existiert bereits.
- `server/routes/assetTypes.ts`
  - Assettyp-API + Seedroute existiert.
  - Seed muss fachlich erweitert werden.
- `src/app/lib/assetTypeStorage.ts`
  - ältere/localStorage-Fassade mit Seedtypen existiert.

---

## Ziel-Datenmodell

### Bestehende Tabellen weiterverwenden

- `assets.asset_type_id`
- `asset_types`
- `asset_tags`
- `tags`

### Neue Tabellen

#### `asset_modules`

Katalog fachlicher Datenmodule/Ausstattung.

Felder:

- `id UUID PRIMARY KEY`
- `code TEXT UNIQUE NOT NULL`
- `label TEXT NOT NULL`
- `short TEXT`
- `description TEXT`
- `render_mode TEXT NOT NULL DEFAULT 'tab'`
  - Werte: `tab`, `section`, `field_group`
- `sort_order INTEGER`
- `is_active BOOLEAN DEFAULT TRUE`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Beispiele:

- `station` / `Station`
- `trafo` / `Trafo`
- `trafo_3w` / `Dreiwickler-Zusatzdaten`
- `schaltanlage` / `Schaltanlage`
- `leistungsschalter` / `Leistungsschalter`
- `nshv` / `NSHV`
- `sicherungen` / `Sicherungen`

#### `asset_type_default_modules`

Mapping: Welcher Assettyp aktiviert welche Module automatisch?

Felder:

- `id UUID PRIMARY KEY`
- `asset_type_id UUID REFERENCES asset_types(id)`
- `asset_module_id UUID REFERENCES asset_modules(id)`
- `is_required BOOLEAN NOT NULL DEFAULT TRUE`
- `sort_order INTEGER`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Beispiele:

- `Trafostation` → `Station`
- `Transformator` → `Trafo`
- `Transformator – 3-Wickler` → `Trafo`, zusätzlich 3W-Feldgruppe/Modul für mehrere Niederspannungen
- `Leistungsschalter` → `Leistungsschalter`

#### `asset_module_assignments`

Konkrete Zusatzmodule/Ausstattung an einem Asset.

Felder:

- `id UUID PRIMARY KEY`
- `asset_id UUID REFERENCES assets(id) ON DELETE CASCADE`
- `asset_module_id UUID REFERENCES asset_modules(id)`
- `source TEXT NOT NULL`
  - `asset_type_default`
  - `manual`
- `sort_order INTEGER`
- `created_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`

Wichtig:

- Default-Module aus Assettyp müssen nicht zwingend als Zeilen gespeichert werden, wenn sie deterministisch aus `asset_type_default_modules` berechnet werden.
- Für MVP empfohlen: aktive Module im Helper berechnen aus:
  1. Default-Module des Assettyps
  2. manuelle `asset_module_assignments`
- Optional später: Default-Module materialisieren, wenn Auditing/Overrides nötig wird.

---

## UI-Zielbild

Im Asset-Formular unter `Stammdaten`:

1. `Assettyp / Kategorie`
   - Pflicht oder zumindest empfohlen.
   - steht oberhalb von Ausstattung und Tags.
   - Auswahl aus `asset_types`.

2. `Ausstattung / Datenmodule`
   - Multi-Auswahl aus `asset_modules`.
   - zeigt automatisch aktivierte Module als `durch Assettyp gesetzt`.
   - manuelle Module können hinzugefügt/entfernt werden.
   - Required Default-Module dürfen nicht entfernt werden, solange der Assettyp gesetzt ist.

3. `Tags / Labels`
   - reine Markierungen/Filter.
   - Tooltip: `Tags erzeugen keine Fach-Tabs.`

Tabs/Feldgruppen:

- `getActiveTabsForAsset` wird ersetzt durch z. B. `getActiveModulesForAsset` + `getTabsForActiveModules`.
- Tabs kommen aus Assettyp-Defaultmodulen + manuellen Modulen.
- Tags werden aus der Tab-Berechnung entfernt.

---

## Umsetzung in Phasen

## Phase 1: Begriffe und reine Helper stabilisieren

### Task 1: Tests für Assettyp-Defaultmodule schreiben

**Objective:** Absichern, dass ein Assettyp automatisch Basis-Module aktiviert.

**Files:**

- Create: `src/app/lib/assetModuleRules.test.ts`
- Create: `src/app/lib/assetModuleRules.ts`

**Testfälle:**

- `Trafostation` liefert `Station`.
- `Transformator` liefert `Trafo`; 2W wird dabei als Standard angenommen und nicht extra markiert.
- `Transformator – 3-Wickler` liefert `Trafo` + 3W-Feldgruppe/Modul für mehrere Niederspannungen.
- Trafo-Eigenschaften wie `Öl`, `Gießharz`, `Hermetik`, `Ausdehner` werden als strukturierte Trafo-Fachdaten validiert und sind such-/filterbar.
- manuelle Module werden zusätzlich angezeigt.
- doppelte Module werden dedupliziert.

**Run:**

```bash
pnpm exec vitest run src/app/lib/assetModuleRules.test.ts
```

Expected zuerst: FAIL, danach PASS.

### Task 2: Typen für AssetModule ergänzen

**Objective:** Frontend-Typen für Module, Default-Mappings und Assignments ergänzen.

**Files:**

- Modify: `src/app/lib/types.ts`

**Neue Interfaces:**

- `AssetModule`
- `AssetTypeDefaultModule`
- `AssetModuleAssignment`

**Wichtig:** Kommentar bei `AssetNode.tagIds` ändern:

- Alt: Tags klassifizieren Assets / steuern Tabs.
- Neu: Assettyp + Datenmodule steuern Fachstruktur; Tags sind Labels/Filter.

### Task 3: Tab-Konfiguration von Tags auf Module umstellen

**Objective:** Die fachliche Tab-Regel darf nicht mehr auf Tags basieren.

**Files:**

- Replace or deprecate: `src/app/config/assetTabRules.ts`
- Create optional: `src/app/config/assetModuleTabRules.ts`

**Regeln:**

- `station` → `Stationsdaten`
- `trafo` → `Trafo-Daten`, inkl. Felder für Bauart/Ausführung: Öl, Gießharz, Hermetik, Ausdehner
- `trafo_3w` → Feldgruppe im Trafo-Tab für mehrere Niederspannungen
- `schaltanlage` → `Schaltanlage-Daten`
- `leistungsschalter` → `Leistungsschalter-Daten`
- `nshv` → `NSHV-Daten`
- `sicherungen` → eher Abschnitt/Feldgruppe, nicht zwingend eigener Tab

---

## Phase 2: Datenbank/API

### Task 4: Migration für Modul-Katalog und Mappings erstellen

**Objective:** Persistentes Datenmodell für Ausstattung/Datenmodule schaffen.

**Files:**

- Create: `migrations/00X_asset_modules.sql`

**Inhalt:**

- Tabelle `asset_modules`
- Tabelle `asset_type_default_modules`
- Tabelle `asset_module_assignments`
- Indizes/Unique Constraints:
  - `asset_modules.code UNIQUE`
  - `asset_type_default_modules(asset_type_id, asset_module_id) UNIQUE`
  - `asset_module_assignments(asset_id, asset_module_id) UNIQUE`

### Task 5: Seeds für Assettypen erweitern

**Objective:** Trafotypen sauber genug abbilden, ohne später wieder umzubauen.

**Files:**

- Modify: `server/routes/assetTypes.ts`
- Modify: `src/app/lib/assetTypeStorage.ts` falls weiterhin relevant.

**Seed-Vorschlag Assettypen:**

- `trafostation`
- `trafo` / `Transformator` als Standard-2W-Trafo
- `trafo_3w` / `Transformator – 3-Wickler` als expliziter Sonderfall
- `leistungsschalter`
- `schaltanlage_ms`
- `nshv`

**Entscheidung:** `2W` wird nicht als eigener Typ/Tag/Marker geführt, weil es der Standardfall ist. `3W` wird explizit geführt, weil dafür mehrere Niederspannungen und später andere Markt-/Suchlogik nötig sind. `Öl`, `Hermetik`, `Gießharz` und `Ausdehner` sind strukturierte Trafo-Fachdaten im Modul `Trafo`, damit sie such-, filter- und sortierbar sind. Nur wenn daraus später eigene umfangreiche Zusatzlogik entsteht, kann daraus ein separates Untermodul werden.

### Task 6: Seeds für Datenmodule und Default-Mappings ergänzen

**Objective:** App funktioniert direkt nach Seed mit sinnvollen Modulen.

**Files:**

- Create or modify: API seed route, z. B. `server/routes/assetModules.ts`

**Seed Module:**

- `station`
- `trafo`
- `trafo_3w` / `Dreiwickler-Zusatzdaten`
- `schaltanlage`
- `leistungsschalter`
- `nshv`
- `sicherungen`

**Default-Mappings:**

- `trafostation` → `station`
- `trafo` → `trafo`
- `trafo_3w` → `trafo`, zusätzlich `trafo_3w`-Feldgruppe/Modul für mehrere Niederspannungen
- `leistungsschalter` → `leistungsschalter`
- `schaltanlage_ms` → `schaltanlage`
- `nshv` → `nshv`

### Task 7: Repository Entity Types erweitern

**Objective:** Frontend-Repository kann Module/Mappings laden und speichern.

**Files:**

- Modify: `src/app/lib/repository.ts`
- Modify: server entity routing/mapping if needed: `server/routes/entities.ts`

**Neue Entity Types:**

- `assetModules`
- `assetTypeDefaultModules`
- `assetModuleAssignments`

---

## Phase 3: Asset-Formular UI

### Task 8: Assettyp-Control im Asset-Formular einbauen

**Objective:** Assettyp wird direkt am Asset ausgewählt und separat von Tags gespeichert.

**Files:**

- Modify: `src/app/pages/AssetDetailPage.tsx`

**Akzeptanz:**

- Feld `Assettyp / Kategorie` erscheint vor Ausstattung/Tags.
- Auswahl speichert `assetTypeId`.
- Bestehende Assets laden den Wert wieder.

### Task 9: Ausstattung/Datenmodule-Control einbauen

**Objective:** Manuelle Zusatzmodule am Asset pflegen.

**Files:**

- Modify: `src/app/pages/AssetDetailPage.tsx`
- Create optional component: `src/app/components/AssetModulePicker.tsx`

**Akzeptanz:**

- Defaultmodule aus Assettyp werden sichtbar markiert.
- Manuelle Zusatzmodule können hinzugefügt werden.
- Required Defaultmodule können nicht entfernt werden.
- Normale Tags bleiben darunter separat.

### Task 10: Dynamische Tabs aus Modulen berechnen

**Objective:** Tabs/Feldgruppen hängen von aktiven Modulen ab, nicht von Tags.

**Files:**

- Modify: `src/app/pages/AssetDetailPage.tsx`
- Modify/Create: `src/app/config/assetModuleTabRules.ts`
- Test: `src/app/lib/assetModuleRules.test.ts`

**Akzeptanz:**

- Assettyp `Trafo` zeigt automatisch `Trafo-Daten`.
- Assettyp `Trafostation` zeigt automatisch `Stationsdaten`.
- Trafostation + manuelles Modul `Trafo` zeigt `Stationsdaten` + `Trafo-Daten`.
- Tags ändern keine Tabs.

### Task 11: Labels/Tooltips im UI schärfen

**Objective:** Anwender verstehen die drei Ebenen sofort.

**Files:**

- Modify: `src/app/pages/AssetDetailPage.tsx`

**UI-Texte:**

- Assettyp Tooltip: `Hauptkategorie des Assets. Setzt automatisch passende Basisdaten.`
- Ausstattung Tooltip: `Enthaltene Technik/Zusatzmodule. Kann weitere Felder oder Tabs aktivieren.`
- Tags Tooltip: `Freie Labels für Suche und Filter. Tags erzeugen keine Fach-Tabs.`

---

## Phase 4: Stammdaten-Verwaltung

### Task 12: Assetmodule-Stammdaten anlegen

**Objective:** Neue Basismodule können später ohne Codeänderung gepflegt werden.

**Files:**

- Create: `src/app/pages/AssetModulesPage.tsx`
- Modify: Sidebar/Routing für Stammdaten-Unterpunkt
- API: `server/routes/assetModules.ts` oder generische entities route

**Felder:**

- Code
- Label
- Kurzbezeichnung
- Beschreibung
- Render-Modus: Tab / Abschnitt / Feldgruppe
- aktiv/inaktiv
- Sortierung

### Task 13: Defaultmodule pro Assettyp verwalten

**Objective:** Im Assettyp-Stammdatenbereich kann gepflegt werden, welche Module automatisch aktiv sind.

**Files:**

- Modify: `src/app/pages/AssetTypesPage.tsx`

**Akzeptanz:**

- Bei Assettyp `Trafostation` kann `Station` als Defaultmodul gewählt werden.
- Bei Assettyp `Transformator` ist `Trafo` das Defaultmodul; 2W bleibt unmarkierter Standard.
- Bei Assettyp `Transformator – 3-Wickler` kann zusätzlich das 3W-Modul/Feldgruppe für mehrere Niederspannungen gesetzt werden.
- Trafo-Eigenschaften wie Öl/Gießharz/Hermetik/Ausdehner werden im Trafo-Modul als Felder gepflegt und nicht als Defaultmodule gemappt.
- Mappings werden persistiert.

---

## Phase 5: Migration weg von tag-gesteuerten Tabs

### Task 14: Bestehende Tab-Tags in Module migrieren

**Objective:** Bestehende Assets verlieren keine sichtbaren Fachbereiche.

**Migration-Idee:**

- Wenn Asset Tag `Trafo`/`Tx` hat → Modulassignment `trafo` hinzufügen.
- Wenn Asset Tag `Leistungsschalter`/`LS` hat → Modulassignment `leistungsschalter` hinzufügen.
- Wenn Asset Tag `Schaltanlage` hat → Modulassignment `schaltanlage` hinzufügen.
- Tags bleiben als normale Labels erhalten oder werden optional später bereinigt.

**Wichtig:** Nicht automatisch normale Labels löschen.

### Task 15: Alte Tag-Tab-Regeln deaktivieren

**Objective:** Tags lösen keine Tabs mehr aus.

**Files:**

- Modify: `src/app/config/assetTabRules.ts` oder entfernen, wenn ersetzt.
- Modify Tests.

**Akzeptanz:**

- Tag `kritisch` erzeugt keinen Tab.
- Tag `Trafo` erzeugt nach Migration nicht mehr direkt den Tab; das Modul `trafo` tut es.

---

## Phase 6: Spätere Erweiterung vormerken

### Task 16: Modul zu Child-Asset auslagern planen, nicht bauen

**Objective:** Idee sichtbar im Plan halten, aber MVP nicht überladen.

**Future Feature:**

Button am Modul:

- `Als eigenes Child-Asset auslagern`

Ablauf später:

1. neues Child-Asset unter Parent erstellen
2. Assettyp aus Modul ableiten, z. B. Modul `Trafo` → Assettyp `Transformator`
3. relevante Modulfelder kopieren
4. Parent-Modul entweder entfernen oder als Verweis markieren
5. Historie/Audit schreiben

**Nicht Teil von MVP 1.**

---

## Teststrategie

### Focused Tests

```bash
pnpm exec vitest run src/app/lib/assetModuleRules.test.ts
```

### Full Tests

```bash
pnpm exec vitest run
```

### Build

```bash
pnpm build
```

### Browser-Smoke

1. `/assets/new` öffnen.
2. Assettyp `Trafostation` wählen.
3. Prüfen: Tab `Stationsdaten` erscheint automatisch.
4. Ausstattung `Trafo` hinzufügen.
5. Prüfen: Tab/Feldgruppe `Trafo-Daten` erscheint.
6. Tag `kritisch` hinzufügen.
7. Prüfen: kein neuer Fach-Tab erscheint.
8. Speichern.
9. Asset neu öffnen.
10. Prüfen: Assettyp, Ausstattung und Tags sind getrennt erhalten.
11. Optional großes Beispiel:
    - Parent `Trafostation`
    - Child `Trafo 1` mit Assettyp `Transformator`; falls es ein 3W-Trafo ist, explizit `Transformator – 3-Wickler` bzw. 3W-Modul/Feldgruppe
    - Child `Leistungsschalter 1`

---

## Akzeptanzkriterien

- Assettyp ist sichtbar und separat von Tags speicherbar.
- Assettyp aktiviert passende Basis-Datenmodule automatisch.
- Ausstattung/Datenmodule können zusätzlich manuell ergänzt werden.
- Tags sind nur noch Labels/Filter und schalten keine Fach-Tabs frei.
- Kleine Trafostation kann als ein Asset mit mehreren Modulen gepflegt werden.
- Große Anlage kann weiterhin über Parent-/Child-Assets gepflegt werden.
- Neue Basismodule können über Stammdaten ergänzt werden, ohne Tab-Logik im Assetformular hart zu verdrahten.
- Idee `Modul später zu Child-Asset machen` ist dokumentiert, aber nicht Teil des ersten MVP.

---

## Nicht-Ziele für den ersten Schritt

- Kein vollständiger Feldkatalog für alle Trafo-/Schaltanlagen-/NSHV-Sonderfälle.
- Kein automatisches Aufsplitten bestehender Assets in Child-Assets.
- Keine Preis-/Kalkulationslogik.
- Keine KI-Automatik für Modulauswahl.
- Keine vollständige Historienmigration je Modul.

---

## Offene Detailentscheidungen vor Umsetzung

1. Soll `Ausstattung` oder `Datenmodule` der sichtbare UI-Begriff sein?
   - Empfehlung: Im Assetformular `Ausstattung / Datenmodule`.
2. Welche Trafo-Eigenschaften müssen im MVP filterbar sein?
   - Empfehlung: `Bauart` mit Öl/Gießharz, `Ölsystem` mit Hermetisch/Ausdehner, `Wicklungen` mit Standard 2W und explizit 3W.
3. Sollen alte tab-auslösende Tags nach Migration sichtbar bleiben?
   - Empfehlung: ja, erst einmal erhalten; später bereinigen.
