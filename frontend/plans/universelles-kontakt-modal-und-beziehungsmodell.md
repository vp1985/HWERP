---
title: "Universelles Kontakt-Modal und Beziehungsmodell"
status: umgesetzt
owner: Vale
created: 2026-06-11
---

# Universelles Kontakt-Modal und Beziehungsmodell

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Systemweit ein einheitliches Modal zum Anlegen/Auswählen von Firmen und Ansprechpartnern bauen, das nach dem Speichern den neuen Kontakt automatisch im aktuellen Kontext auswählt.

**Architecture:** Kontakte bleiben zentrale Stammdaten. Rollen wie Rechnungsempfänger, Betreiber, Vermittler/Provisionsempfänger oder Eigentümer sind keine festen Kontakt-Haken, sondern kontextabhängige Beziehungen in Anfrage, Standort, Asset, Auftrag oder Kalkulation. Ein wiederverwendbarer `ContactPicker`/`ContactCreateModal` ersetzt lokale Sonderlogiken im Anfrage-Dashboard und später in weiteren Modulen.

**Tech Stack:** React/Vite, TypeScript, bestehendes Repository/API, PostgreSQL, Vitest, Browser-Smoke.

---

## Verstandene Produktentscheidungen

- Jeder Kontakt kann in unterschiedlichen Fällen alles sein:
  - Rechnungsempfänger
  - Betreiber
  - Vermittler / Provisionsempfänger
  - Eigentümer
  - Ansprechpartner
  - Lieferant/Kunde, falls später relevant
- Dafür sollen keine dauerhaften Rollen-Haken wie `istBetreiber` oder `istVermittler` nötig sein.
- Entscheidend ist die Beziehung im jeweiligen Vorgang:
  - Anfrage X hat Rechnungsempfänger Firma A
  - Anfrage X hat Betreiber Firma B
  - Anfrage X hat Vermittler Firma/Person C
  - Standort Y ist Firma A/B/C zugeordnet
  - Asset Z gehört/liegt bei/ist betreut durch Kontakt oder Standort
- Wenn ein gesuchter Kontakt nicht existiert, kann aus jedem Suchfeld heraus per `+` das gleiche Universal-Modal geöffnet werden.
- Nach dem Anlegen wird der neue Datensatz direkt im aktuellen Feld ausgewählt.
- Ansprechpartner können auch ohne vorher gewählte Firma gesucht werden.
- Wird ein Ansprechpartner gewählt:
  - wenn er genau eine Hauptfirma/Standardfirma hat, wird diese automatisch mit ausgewählt.
  - wenn mehrere Firmen möglich sind, wird die Hauptfirma vorgeschlagen, aber wechselbar gemacht.
  - wenn eine Firma gewählt wird, zu der der Ansprechpartner nicht verknüpft ist, zeigt HWERP einen Warnhinweis und bietet an, die Verknüpfung zu erstellen.
- Provision ist kein Betrag im Anfragemodul, sondern ein Hinweis/Risiko:
  - Beispiel BDE Heek: Wenn ein Kunde über BDE kam, soll HWERP später darauf hinweisen, dass Provision wahrscheinlich geprüft/eingerechnet werden muss.
  - Das ist eher eine dauerhafte Beziehungs-/Hinweislogik als ein Haken am Kontakt selbst.
- Standorte sind gesondert:
  - Felder für Rechnungsempfänger/Vermittler/Betreiber wählen Firmen/Personen, aber keine Standorte.
  - Das Standort-Feld darf Standorte auswählen und perspektivisch Kontakte/Firmenrelationen am Standort anzeigen oder herstellen.
  - Eine Firma selbst ist nicht „der Standort“, sondern sie kann an einem Standort sitzen, ihn betreiben, besitzen oder dort Ansprechpartner haben.

---

## Zielbild UI

### 1. Wiederverwendbare Suchfelder

Alle relevanten Felder verwenden denselben Grundbaustein:

- `EntityAssignmentField`
  - Suche mit Autocomplete
  - zeigt Treffer aus Firmen, Ansprechpartnern oder Standorten je nach Kontext
  - hat einen `+ Neu anlegen` Button
  - kann nach Auswahl abhängige Felder setzen
  - zeigt Warnungen, wenn Beziehungen fehlen

Kontext-Beispiele:

- Rechnungsempfänger:
  - erlaubte Typen: Firma/Kunde
  - kein Standort
  - optional danach Ansprechpartner
- Betreiber:
  - erlaubte Typen: Firma/Kunde
  - kein Standort
- Vermittler:
  - erlaubte Typen: Firma, Ansprechpartner, Firma+Ansprechpartner
  - kein Standort
- Ansprechpartner:
  - erlaubte Typen: Ansprechpartner
  - Firma kann automatisch/optional mitgezogen werden
- Standort:
  - erlaubte Typen: Standort
  - plus zugehörige Firmen/Ansprechpartner als Kontext/Relation, aber Standort bleibt eigene Entität

### 2. Universelles Kontakt-Modal

Ein Modal für:

- neue Firma anlegen
- neue Person/Ansprechpartner anlegen
- Firma + Ansprechpartner anlegen
- optional Kontakt direkt mit vorhandener Firma verknüpfen
- optional Hauptfirma/Standardfirma für Ansprechpartner setzen

Das Modal bekommt einen Kontext:

```ts
type ContactCreateContext =
  | 'invoiceRecipient'
  | 'operator'
  | 'mediator'
  | 'contactPerson'
  | 'siteRelation'
  | 'generic';
```

Der Kontext bestimmt nur Vorauswahl/Labels/Rückgabe, nicht die Stammdaten-Rolle des Kontakts.

### 3. Rückgabe nach Speichern

Nach erfolgreichem Speichern liefert das Modal ein Ergebnis zurück:

```ts
interface ContactCreateResult {
  customerId?: string;
  contactPersonId?: string;
  customerContactPersonId?: string;
  suggestedRelationWarning?: string;
}
```

Der aufrufende Screen entscheidet dann:

- Rechnungsempfänger-Feld setzt `customerId`
- Ansprechpartner-Feld setzt `customerContactPersonId` oder `contactPersonId`
- Vermittler-Feld setzt `responsibleCustomerId`/`responsibleContactPersonId`
- Betreiber-Feld setzt `siteCustomerId`

---

## Datenmodell-Richtung

### Bestehend nutzen

- `customers`: Firmen/Kunden/Lieferanten/Beteiligte
- `contact_persons`: Personen/Ansprechpartner
- `customer_contact_persons`: Person-Firma-Verknüpfung
- `locations`: Standorte
- `location_customers`: Firma-Standort-Verknüpfung
- `assets`: Assets mit `customerId`/`locationId`

### Ergänzungen prüfen

#### Hauptfirma für Ansprechpartner

Option A: Spalte auf `contact_persons`

```ts
primaryCustomerId?: string | null;
```

Vorteil: einfach für Autowahl.

Option B: Attribut auf Relation `customer_contact_persons`

```ts
isPrimary?: boolean;
```

Vorteil: sauberer, wenn Person mehrere Firmen hat und eine davon Hauptbezug ist.

Empfehlung MVP: `customer_contact_persons.is_primary`.

#### Provision-/Vermittler-Hinweise

Nicht als Kontaktrolle speichern, sondern als Beziehung/Hinweis:

```ts
interface CustomerReferralRule {
  id: string;
  referredCustomerId: string;      // z.B. Kunde, für den wir arbeiten
  mediatorCustomerId?: string;     // z.B. BDE Heek
  mediatorContactPersonId?: string;
  active: boolean;
  note: string | null;             // "Provision prüfen"
}
```

MVP-Alternative: erst als einfacher Hinweis auf `customer_contact_persons` oder `customers.notes`, aber mittelfristig besser eigene Relation.

#### Unternehmenshierarchie / Eigentümerwechsel

Später eigenes Modell:

```ts
interface CustomerRelation {
  id: string;
  parentCustomerId: string;
  childCustomerId: string;
  relationType: 'owns' | 'belongs_to' | 'merged_into' | 'managed_by' | 'other';
  validFrom?: string | null;
  validTo?: string | null;
}
```

Damit können Firmenübernahmen, Unterordnungen und vererbte Assets später abgebildet werden.

---

## MVP-Abgrenzung

### In Phase 1 bauen

- Wiederverwendbares Kontakt-Anlage-Modal.
- Wiederverwendbares Such-/Zuordnungsfeld mit `+` Button.
- Anfrage-Dashboard nutzt diese Komponenten für:
  - Rechnungsempfänger
  - Ansprechpartner Rechnungsempfänger
  - Betreiber
  - Vermittler
- Nach Anlage wird der neue Kontakt direkt ausgewählt.
- Ansprechpartner-Suche funktioniert auch ohne vorher ausgewählte Firma.
- Bei Ansprechpartner-Auswahl wird die Hauptfirma automatisch gesetzt, wenn eindeutig.
- Warnung, wenn Ansprechpartner und gewählte Firma nicht verknüpft sind; Aktion `Verknüpfung erstellen` anbieten.

### Später bauen

- Standort-Beziehungseditor.
- Asset-Beziehungs-/Vererbungsmodell.
- Firmenhierarchien und Eigentümerwechsel.
- Provisionsregeln aus Vermittlerbeziehungen.
- Systemweite Nutzung in Kalkulation, Assets, Standorte, Arbeitsvorbereitung.

---

## Implementierungsplan

### Task 1: Contract-Tests für universelles Modal planen/anlegen

**Objective:** Bestehende Anfrage-Dashboard-Sonderlogik absichern und gewünschtes Universalverhalten testbar machen.

**Files:**
- Modify: `src/app/pages/InquiryDashboardPage.test.ts`
- Create: `src/app/components/contact-assignment/ContactCreateModal.test.tsx` oder Source-Contract-Test, falls kein DOM-Test-Setup vorhanden
- Create: `src/app/lib/contactAssignmentUtils.test.ts`

**Akzeptanz:**

- Anfrage-Dashboard enthält keine separaten Spezial-Create-Blöcke mehr für `Neue Firma`, `Neue Person`, `Firma + Ansprechpartner` direkt im Vermittlerblock.
- Stattdessen wird ein gemeinsames `ContactCreateModal` verwendet.
- Alle Felder haben einen `+` Button.
- Ansprechpartner-Suche ist nicht mehr zwingend von vorheriger Firmenwahl abhängig; ohne Firma zeigt sie alle Personen.

### Task 2: Domain-Helper für Kontakt-/Firmenauswahl bauen

**Objective:** Automatische Hauptfirma, fehlende Verknüpfungen und Warnungen rein fachlich testen.

**Files:**
- Create: `src/app/lib/contactAssignmentUtils.ts`
- Test: `src/app/lib/contactAssignmentUtils.test.ts`

**Helper-Ideen:**

```ts
resolvePrimaryCustomerForContact(contactPersonId, customerContactPersons): string | null
isContactLinkedToCustomer(contactPersonId, customerId, customerContactPersons): boolean
buildMissingLinkWarning(contactPersonId, customerId): string | null
```

**Akzeptanz:**

- Eine Person mit genau einer Firmenverknüpfung wählt diese automatisch.
- Eine Person mit `isPrimary` wählt diese bevorzugt.
- Eine Person mit mehreren Firmen ohne Hauptfirma erzeugt keinen stillen Auto-Set, sondern Auswahlbedarf.
- Gewählte Firma ohne Person-Verknüpfung erzeugt Warnung.

### Task 3: Datenmodell für Hauptfirma minimal erweitern

**Objective:** Ansprechpartner können eine Hauptfirma bekommen.

**Files:**
- Modify: `src/app/lib/types.ts`
- Modify: `server/routes/entities.ts`, falls Spaltenmapping explizit nötig ist
- Create: `migrations/022_contact_primary_company.sql`
- Test: `server/routes/entities.test.ts`

**Empfehlung:**

```sql
ALTER TABLE customer_contact_persons
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
```

Optional später Unique-Constraint pro `contact_person_id`, aber MVP kann erst UI-seitig verhindern, dass mehrere Hauptfirmen gesetzt werden.

### Task 4: `ContactCreateModal` als echte wiederverwendbare Komponente bauen

**Objective:** Ein Modal für Firma, Person und Firma+Person.

**Files:**
- Create: `src/app/components/contact-assignment/ContactCreateModal.tsx`
- Test: `src/app/components/contact-assignment/ContactCreateModal.test.tsx` oder Source-Contract

**Props:**

```ts
interface ContactCreateModalProps {
  open: boolean;
  context: ContactCreateContext;
  initialCustomerId?: string;
  initialContactPersonId?: string;
  onClose: () => void;
  onCreated: (result: ContactCreateResult) => void;
}
```

**Akzeptanz:**

- Kontext setzt nur Titel/Default-Tab, keine starre Rolle.
- Speichert über bestehendes Repository.
- Dispatcht neue `customers`, `contactPersons`, `customerContactPersons` in den AppStore.
- Ruft `onCreated` mit IDs auf.

### Task 5: `EntityAssignmentField` / `ContactAssignmentField` bauen

**Objective:** Systemweit gleiche Suche + Plus-Verhalten nutzbar machen.

**Files:**
- Create: `src/app/components/contact-assignment/ContactAssignmentField.tsx`
- Test: Source-/Helper-Tests

**Akzeptanz:**

- Unterstützt unterschiedliche erlaubte Typen.
- Zeigt `+ Neu anlegen` bei keinem passenden Treffer oder als festen Button.
- Kann nach Auswahl zusätzliche Vorschläge zurückgeben, z.B. `suggestedCustomerId`.
- Kann Warnungen anzeigen und Aktion `Verknüpfung erstellen` anbieten.

### Task 6: Anfrage-Dashboard auf neue Komponenten umbauen

**Objective:** Lokale Sonderlogik im Anfrage-Dashboard entfernen.

**Files:**
- Modify: `src/app/pages/InquiryDashboardPage.tsx`
- Modify: `src/app/pages/InquiryDashboardPage.test.ts`

**Akzeptanz:**

- Rechnungsempfänger: Firma suchen oder neu anlegen.
- Ansprechpartner: Person suchen, auch ohne Firma.
- Wenn Ansprechpartner eine Hauptfirma hat und Rechnungsempfänger leer ist, Rechnungsempfänger automatisch setzen.
- Wenn Rechnungsempfänger gesetzt ist, aber Ansprechpartner nicht verknüpft ist: Warnung + `Verknüpfung erstellen`.
- Betreiber: Firma suchen oder neu anlegen.
- Vermittler: Firma/Person/Firma+Person suchen oder neu anlegen.
- Nach Neu-Anlage ist der Datensatz sofort ausgewählt.

### Task 7: Provision-Hinweis nur als Hinweis vorbereiten

**Objective:** Keine Preislogik, aber spätere Provisionsprüfung vorbereiten.

**Files:**
- Create/Modify später nach Datenmodell-Entscheidung

**MVP:**

- Noch keine Beträge.
- Bei Auswahl eines bekannten Vermittlers kann ein Hinweis erscheinen: `Provision prüfen`.
- Regeln werden später als eigene Relation gepflegt.

### Task 8: Verifikation

**Commands:**

```bash
pnpm exec vitest run src/app/lib/contactAssignmentUtils.test.ts src/app/pages/InquiryDashboardPage.test.ts server/routes/entities.test.ts
pnpm exec vitest run
pnpm build
docker restart hwerp-api hwerp-web
```

**Browser-Smoke:**

- `/inquiries` öffnen.
- Neue Anfrage öffnen.
- Rechnungsempfänger per Suche wählen.
- Ansprechpartner ohne Firmenwahl suchen und wählen.
- Neue Firma aus Rechnungsempfänger-Feld anlegen, danach automatisch ausgewählt.
- Neue Person aus Ansprechpartner-Feld anlegen, danach automatisch ausgewählt.
- Nicht verknüpfte Person/Firma wählen → Warnung + Verknüpfungsaktion sichtbar.
- Konsole ohne JS-Fehler.

---

## Entschiedene fachliche Grundlage

- Die `Hauptfirma` eines Ansprechpartners wird als Eigenschaft der Verknüpfung gespeichert:
  - `customer_contact_persons.is_primary`
- Wenn ein Ansprechpartner genau eine Firmenverknüpfung hat, kann diese automatisch genutzt werden.
- Wenn mehrere Firmen verknüpft sind, wird `is_primary = true` bevorzugt.
- Wenn mehrere Firmen vorhanden sind, aber keine Hauptfirma markiert ist, fragt/warnt die UI statt still eine Firma zu setzen.

---

## Nicht programmiert

Dieses Dokument ist Planung. Es wurde noch keine Implementierung gestartet.
