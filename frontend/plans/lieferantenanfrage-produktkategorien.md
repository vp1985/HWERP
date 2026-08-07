---
id: lieferantenanfrage-produktkategorien
title: "Lieferantenanfrage mit systemweiten Produktkategorien"
status: geplant
priority: high
created: 2026-06-04
updated: 2026-06-04
---

# Lieferantenanfrage mit systemweiten Produktkategorien

> **For Hermes:** Vor Implementierung `test-driven-development` laden. Erst planen/prüfen, dann mit `go` umsetzen. Keine automatische Anfrage-Mail ohne Freigabe senden.

**Goal:** In HWERP soll ein Modul `Lieferantenanfrage` entstehen: Nutzer wählen ein gesuchtes Produkt bzw. eine Produktkategorie, sehen passende Lieferanten/Fertiger und können daraus eine Anfrage vorbereiten.

**Architecture:** Produktkategorien sind systemweite Stammdaten und werden vorhandenen Geschäftspartnern mit Funktion `Lieferant` als Fähigkeiten/Sortiment zugeordnet. Geschäftspartner können gleichzeitig `Kunde` und/oder `Lieferant` sein. Eine Lieferantenanfrage besteht aus Kopf, Positionen, Spezifikation/Anhängen und ausgewählten Empfängern. Einkaufspreise/Angebote gehören später in geschützte Einkaufs-/Kalkulationsbereiche und dürfen nicht automatisch an Kundenflächen durchgereicht werden.

**Tech Stack:** Bestehendes HWERP React/Vite + Express API + PostgreSQL + generische `/api/entities`-Struktur; E-Mail-Versand/Antwortimport später als Worker.

---

## Produktentscheidung

### Aktuelle Klärung 2026-06-10

- MVP-Fokus ist **Lieferantenverwaltung + Suche**, nicht die konkrete Anfrageabwicklung.
- Mitarbeiter sollen ein Produkt bzw. eine Produktkategorie suchen und sofort sehen: **Welche Lieferanten kommen grundsätzlich in Frage?**
- Lieferanten werden mit Produktkategorien und optional konkreten Produkten/Fähigkeiten verknüpft.
- Es gibt ca. 20+ Produktkategorien; konkrete Produkte können enger sein und oft nur 1, manchmal 2–3 mögliche Lieferanten haben.
- Konkrete Produkte sollen später direkt am Produkt mit Lieferanten verknüpft werden können; für jetzt reicht die Lieferantenverwaltung als Such-/Orientierungsbasis.
- Das Anfrage-Modul, Anfrageentwürfe, Empfängerauswahl und Versand bleiben bewusst **später**.

- Neues HWERP-Modul zunächst: `Lieferantenverwaltung` / `Lieferanten`.
- Navigation unter Stammdaten/Geschäftspartner als `Lieferanten`; `Lieferantenanfragen` erst später als eigenes Modul.
- Produktkategorien müssen jederzeit durch berechtigte Nutzer erweiterbar sein; neue Kategorien sollen ohne Programmieraufwand direkt in den Stammdaten angelegt, aktiviert, archiviert und Lieferanten zugeordnet werden können.
- Systemweite Produktkategorien werden in den Stammdaten gepflegt, z. B.:
  - `Stahlwannen`
  - `Aluminiumwannen`
  - `Edelstahlwannen`
  - `Folienauskleidungen`
  - `Kunststoffwannen`
  - `Druckberechnungen`
  - `Öltransformatoren`
  - `Gießharztransformatoren`
  - `Transporte`
  - `Ölwannen`
  - später weitere Bauteile/Leistungen.
- Kategorien können hierarchisch/verschlagwortet sein, damit „Ölwanne aus Stahl“ zu `Stahlwannen` bzw. `Ölwannen > Stahl` findet.
- Es wird keine separate Lieferanten-Stammdatenwelt aufgebaut: vorhandene Geschäftspartner werden genutzt.
- Geschäftspartner können die Funktion `Kunde`, `Lieferant` oder beides haben.
- Nur Geschäftspartner mit Funktion `Lieferant` können als Empfänger einer Lieferantenanfrage vorgeschlagen werden.
- Lieferanten-Geschäftspartner können mehrere Produktkategorien/Fähigkeiten zugewiesen bekommen, z. B. `Öltransformatoren` und `Gießharztransformatoren`.
- Je Kategorie/Fähigkeit braucht es eine eigene Priorisierung/Reihenfolge der Lieferanten, weil die beste Lieferantenauswahl kategorieabhängig ist.
- Beispiel Priorisierung: Bei `Öltransformatoren` steht `TEK` normalerweise auf Priorität 1 und `SGB` auf Priorität 2; bei `Gießharztransformatoren` erhält `SGB` die höhere Priorität.
- Beispiel: `TROWAtech` kann `Ölwannen aus Aluminium` / `Aluminiumwannen` herstellen. Für `Ölwanne aus Stahl` wird TROWAtech nur angezeigt, wenn zusätzlich eine Stahlwannen-Fähigkeit gepflegt ist.
- Beispiel: `Elbag` macht `Ölauffangwannen aus Edelstahl` und wird der Kategorie `Edelstahlwannen` bzw. `Ölwannen > Edelstahl` zugeordnet.
- Beispiel: `HT-VOLTEQ` macht `Wannen aus Folienauskleidung` und wird der Kategorie `Folienauskleidungen` bzw. `Ölwannen > Folienauskleidung` zugeordnet.
- Beispiel: `Plas-tec` liefert `Ölauffangwannen aus Kunststoff` und wird der Kategorie `Kunststoffwannen` bzw. `Ölwannen > Kunststoff` zugeordnet. Referenz: `http://plas-tec.org/behaelter_auffang.html`.
- Beispiel: `Druckberechnungen` werden als Dienstleistungs-/Ingenieurkategorie gepflegt, z. B. für Störlichtbogen-Druckberechnung, Druckentlastungsflächen, Druckentlastungsquerschnitte, MS-Schaltanlagen und Anlagengebäude.
- Beispiel: `Transporte` wird nicht als eine starre Einzelkategorie behandelt, sondern über kombinierbare Chips/Fähigkeiten gefiltert, z. B. `Spediteur`, `Palettenware`, `Kran bis 5 t`, `Kran bis 2,5 t`, `Fixtermine`, `keine Fixtermine`/`Flexibel`.
- Für eine Transportanfrage kann der Nutzer mehrere Chips auswählen, z. B. `Spediteur` + `5t Kran` + `Flexibel`; angezeigt werden nur Geschäftspartner mit passender Lieferantenfunktion und allen erforderlichen Fähigkeiten.
- Klick auf Produkt/Kategorie in der Lieferantenanfrage zeigt alle passenden Lieferanten mit Ansprechpartner, Fähigkeit, Notizen und optional Qualitäts-/Lieferzeitangaben.
- Anfrage kann an einen oder mehrere Lieferanten vorbereitet werden.
- Automatischer Versand nur später und nur nach manueller Freigabe.

## Datenmodell-Vorschlag

### `supplier_product_categories`

Systemweite Kategorien für Produkte/Bauteile/Herstellfähigkeiten.

- `id`
- `name`, z. B. `Stahlwannen`, `Aluminiumwannen`, `Edelstahlwannen`, `Kunststoffwannen`, `Folienauskleidungen`, `Druckberechnungen`
- `parent_id` optional für Hierarchie, z. B. `Ölwannen` > `Stahlwannen`
- `aliases[]`, z. B. `Ölwanne Stahl`, `Stahl-Ölwanne`, `Auffangwanne Stahl`, `Ölauffangwanne Edelstahl`, `Ölauffangwanne Kunststoff`, `Kunststoff-Auffangbehälter`, `Folienauskleidung Wanne`, `Störlichtbogen-Druckberechnung`, `Druckentlastungsfläche`, `Druckentlastungsquerschnitt`
- `description`
- `active`
- `sort_order`
- `created_by_user_id`, `created_at`, `updated_at`
- `archived_at` optional statt Löschen, damit alte Anfragen stabil bleiben
- optional später: `spec_template_json` für benötigte Maße/Material/Normen

### `supplier_capability_tags`

Feingranulare, kombinierbare Chips innerhalb oder quer zu Produktkategorien. Besonders wichtig für Transporte und andere Dienstleister.

- `id`
- `name`, z. B. `Spediteur`, `Palettenware`, `Kran bis 5 t`, `Kran bis 2,5 t`, `Fixtermine`, `Flexibel`
- `category_id` optional, z. B. Oberkategorie `Transporte`
- `kind`: `service_type | equipment | capacity | scheduling | material | other`
- `aliases[]`, z. B. `5t Kran`, `Kran 5 Tonnen`, `keine Fixtermine`
- `active`
- `sort_order`

### Geschäftspartner-Stammdaten: bestehende `customers` als gemeinsame Tabelle

Aktueller Stand der DB: Es gibt bereits `customers` für Firmen/Organisationen und `contact_persons` für Ansprechpartner. Für Lieferanten wird **keine zweite Firmendublette** angelegt. Die bestehende Organisation bleibt ein Datensatz und bekommt bei Bedarf zusätzlich die Lieferantenrolle.

Zielbild fachlich: `customers` wird als Geschäftspartner-Tabelle genutzt, auch wenn der technische Tabellenname zunächst `customers` bleibt.

- `id`
- bestehende Firmenfelder wie Name, Adresse, Kontaktname, E-Mail, Telefon, Notizen
- `customer_number` existiert bereits und bleibt für Kundenbezug erhalten
- neu: `supplier_number` optional; wird erst vergeben, wenn der Geschäftspartner auch Lieferant ist
- Rollen/Funktionen am Geschäftspartner: `customer`, `supplier`; beide gleichzeitig möglich
- Anzeige in UI: `Kunde`, `Lieferant`, `Kunde + Lieferant`
- Lexware/Lexoffice-Import: vorhandene Kunden-/Lieferantennummern werden in dieselbe Organisation importiert, nicht als separate Datensätze, soweit die Identität eindeutig ist
- optional externe IDs: `lexoffice_contact_id`, `lexoffice_customer_number`, `lexoffice_vendor_number`, damit spätere Reimporte/Abgleiche keine Dubletten erzeugen

Beispiel: Ein bestehender Kunde erhält die Rolle `Lieferant`; HWERP ergänzt nur `supplier_number` und Lieferantenfähigkeiten. Kundennummer, Anlagen, Anfragen und Historie bleiben am selben Datensatz.

### `supplier_capabilities` / `customer_supplier_categories`

Zuordnung Geschäftspartner mit Funktion `Lieferant` ↔ Produktkategorie.

- `id`
- `customer_id`
- `category_id`
- `capability_label`, z. B. `Ölwannen aus Aluminium herstellen`
- `materials[]`, z. B. `Aluminium`, `Stahl`, `Edelstahl`, `Kunststoff`
- `manufacturing_type`: `fertigung | handel | service | reparatur | sonstiges`
- optional `service_tags[]`, z. B. `Störlichtbogen`, `NS`, `MS`, `HS`, `Schaltanlage`, `Anlagengebäude`, `FEM`, `Druckentlastung`
- optional `capability_tag_ids[]`, z. B. bei Transporten `Spediteur`, `Kran bis 5 t`, `Flexibel`
- optional `fit_level`: `sehr_passend | sehr_hoch | hoch | passend | moeglich`
- `priority_rank` pro Kategorie/Fähigkeit, z. B. `1` = bevorzugter Standardlieferant für diese Kategorie, `2` = zweite Wahl; darf je Geschäftspartner und Kategorie unterschiedlich sein.
- `min_quantity` optional
- `typical_lead_time_days` optional
- `certifications[]` optional
- `notes`
- `active`

### `supplier_inquiries`

Kopf der Lieferantenanfrage.

- `id`
- `title`
- `status`: `draft | ready_to_send | sent | waiting_for_supplier | offers_received | decided | archived`
- `requested_by_user_id`
- `linked_customer_inquiry_id` optional
- `linked_project_id` optional
- `due_date` optional
- `internal_notes`
- `created_at`
- `updated_at`

### `supplier_inquiry_items`

Gesuchte Produkte/Positionen.

- `id`
- `supplier_inquiry_id`
- `category_id`
- `title`, z. B. `Ölwanne aus Stahl`
- `quantity`
- `unit`
- `specification_json`, z. B. Maße, Material, Stärke, Oberfläche, Zeichnungsnummer
- `description`
- `attachment_ids[]` optional

### `supplier_inquiry_recipients`

Ausgewählte Lieferanten je Anfrage.

- `id`
- `supplier_inquiry_id`
- `supplier_customer_id` / `customer_id` als Verweis auf den Geschäftspartner-Datensatz
- optional `contact_person_id` als konkreter Ansprechpartner beim Lieferanten
- `contact_email` als verwendete Versandadresse/Snapshot
- `status`: `selected | draft_ready | sent | replied | declined | no_response`
- `sent_at` optional
- `replied_at` optional
- `supplier_reference` optional
- `notes`

### `supplier_offers` später

Lieferantenantworten/Angebote. Einkaufskonditionen brauchen eigene Rechte.

- `id`
- `supplier_inquiry_id`
- `supplier_customer_id` / `customer_id` als Verweis auf den liefernden Geschäftspartner
- optional `contact_person_id`
- `status`: `received | shortlisted | accepted | rejected | expired`
- `delivery_time_text`
- `valid_until` optional
- `commercial_terms` nur für berechtigte Nutzer sichtbar
- `attachments`
- `notes`

## UI-Vorschlag

### Stammdaten: Produktkategorien

- Liste/Suche der systemweiten Kategorien.
- Kategorie anlegen/bearbeiten/archivieren.
- Synonyme/Aliase pflegen.
- Button `Kategorie hinzufügen` ist dauerhaft verfügbar.
- Neue Kategorien sind sofort in Lieferantenfähigkeiten und Lieferantenanfragen auswählbar.
- Kategorien werden archiviert statt hart gelöscht, wenn sie bereits in Anfragen/Fähigkeiten verwendet wurden.
- Optional Hierarchie: Oberkategorie `Ölwannen`, Unterkategorien `Stahlwannen`, `Aluminiumwannen`, `Edelstahlwannen`, `Kunststoffwannen`, `Folienauskleidungen`; zusätzlich Dienstleistungskategorien wie `Druckberechnungen`.
- Für Kategorien wie `Transporte` gibt es zusätzlich frei pflegbare Chips/Fähigkeiten, die kombiniert werden können.

### Stammdaten: Lieferantenfähigkeiten

- Geschäftspartner/Kunde öffnen; wenn Funktion `Lieferant` aktiv ist, Abschnitt `Kann liefern/herstellen` anzeigen.
- Kategorien hinzufügen.
- Pro Kategorie Material, Fähigkeit, Notiz, Lieferzeit, Zertifikate pflegen.
- Pro Kategorie/Fähigkeit eine Priorität/Reihenfolge pflegen, z. B. per Zahl, Drag-and-drop oder `Priorität hoch/mittel/niedrig`; gleiche Lieferanten dürfen je Kategorie unterschiedliche Prioritäten haben.
- Ein Geschäftspartner darf gleichzeitig Kunde und Lieferant sein; die Lieferantenkategorien beeinflussen nur Lieferantenanfragen, nicht die Kundenfunktion.
- Ein Lieferanten-Geschäftspartner kann beliebig viele Produktkategorien erhalten, z. B. `Öltransformatoren` und `Gießharztransformatoren`.
- Pro Kategorie können mehrere Chips/Fähigkeiten gepflegt werden, z. B. bei Transporten `Spediteur`, `Palettenware`, `Kran bis 5 t`, `Kran bis 2,5 t`, `Fixtermine` oder `Flexibel`.
- Beispiel: `TEK` wird bei `Öltransformatoren` als Priorität 1 gepflegt, `SGB` als Priorität 2; bei `Gießharztransformatoren` wird `SGB` höher priorisiert als TEK.
- Beispiel-Eintrag bei TROWAtech: Kategorie `Aluminiumwannen`, Label `Ölwannen aus Aluminium herstellen`.
- Beispiel-Eintrag bei Elbag: Kategorie `Edelstahlwannen`, Label `Ölauffangwannen aus Edelstahl`.
- Beispiel-Eintrag bei HT-VOLTEQ: Kategorie `Folienauskleidungen`, Label `Wannen aus Folienauskleidung`.
- Beispiel-Eintrag bei Plas-tec: Kategorie `Kunststoffwannen`, Label `Ölauffangwannen aus Kunststoff`, Referenzlink `http://plas-tec.org/behaelter_auffang.html`.
- Beispiel-Einträge für `Druckberechnungen`:
  - `THETA Ingenieurbüro GmbH, Dresden`: Passung `Sehr hoch`; spezialisiert auf Druckberechnung beim Störlichtbogen, Berechnung in NS/MS/HS, Anlagengebäude und Druckentlastungsflächen.
  - `netzstudien.de`: Passung `Hoch`; Druckberechnung bei Störlichtbögen mit spezialisierten Simulationsprogrammen, u. a. für Mittelspannungsschaltanlagen.
  - `plancom GmbH`: Passung `Hoch`; Druckentwicklung in MS-Schaltanlagen und Gebäuden für Bestandsgebäude und Neuanlagen, leitet notwendige Druckentlastungsflächen ab.
  - `Spahr GmbH`: Passung `Hoch`; quasistationäre Überdruckberechnungen in Schaltfeldern und Schaltanlagenräumen.
  - `Enarcgee – Energy-and-Arcing-Engineering Werth`: Passung `Sehr passend`; nennt Pigler-Standardverfahren/erweitertes Standardverfahren für Störlichtbogen-Druckberechnungen und Druckentlastungsquerschnitte.
  - `switchgear-development.de / Konstruktion T. Eisenschmidt`: Passung `Passend`; Druckberechnungen inkl. Druckwerte, zeitliche Verläufe und optional FEM-Berechnung beanspruchter Bauteile.
  - `bt-plan GmbH`: Passung `Möglich`; laut Screenshot Referenzen zu statischen Berechnungen zum Druckanstieg im Störlichtbogenfall und Nutzung von Spezialsoftware; Details im Screenshot unten teilweise abgeschnitten.

### Modul: Lieferantenanfrage

1. `Neue Lieferantenanfrage` starten.
2. Produkt/Kategorie suchen: Eingabe `Ölwanne aus Stahl` schlägt `Stahlwannen` vor.
3. Position mit Menge, Maßen, Material, Beschreibung und Anhängen erfassen.
4. Rechts/unterhalb: passende Lieferanten anzeigen.
5. Lieferanten auswählen.
6. Anfrageentwurf erzeugen.
7. Versand/Export erst nach manueller Freigabe.

Transport-Beispiel:

1. Kategorie/Chip `Spediteur` auswählen.
2. Fähigkeit `5t Kran` auswählen.
3. Termin-Chip auswählen, z. B. `Flexibel` oder `Fixtermin`.
4. Ergebnisliste zeigt nur Spediteure, die alle ausgewählten Chips erfüllen.

## Matching-Logik

Deterministisch für V1:

- Exakte Kategorie-Zuordnung gewinnt.
- Alias-/Synonymtreffer zählen als Kategorie-Treffer.
- Materialfilter einschränken: `Stahl` zeigt nur Fähigkeiten mit Stahl oder ohne expliziten Materialausschluss.
- Dienstleistungsfilter berücksichtigen `service_tags`: Suche nach `Druckberechnung Störlichtbogen MS-Schaltanlage` bevorzugt Lieferanten mit Tags `Störlichtbogen`, `MS`, `Schaltanlage`, `Druckentlastung`.
- Chip-Matching ist UND-basiert: Bei `Spediteur` + `Kran bis 5 t` + `Flexibel` muss ein Geschäftspartner alle drei Chips besitzen; optional können ähnliche Treffer mit fehlender Fähigkeit separat als `Teiltreffer` angezeigt werden.
- Innerhalb passender Lieferanten wird nach gepflegter Kategorie-Priorität sortiert: niedrigere `priority_rank` zuerst; fehlende Priorität steht hinter priorisierten Lieferanten, kann aber weiterhin angezeigt werden.
- Priorität ist kategoriegebunden, nicht global am Geschäftspartner: `SGB` kann bei `Gießharztransformatoren` vor `TEK` stehen, aber bei `Öltransformatoren` hinter `TEK`.
- Inaktive Kategorien/Lieferanten/Fähigkeiten werden nicht vorgeschlagen.
- Treffer zeigen Begründung: `passt wegen Kategorie Stahlwannen`, `passt wegen Alias Ölwanne Stahl`, `passt wegen Material Aluminium`, `passt wegen Material Edelstahl`, `passt wegen Material Kunststoff`, `passt wegen Ausführung Folienauskleidung`.

Später optional:

- Volltextsuche über Lieferantennotizen.
- KI-Vorschlag für unbekannte Kategorien, aber nur als Vorschlag zur Stammdatenpflege.
- Bewertung nach Lieferzeit, bisherigen Antworten, Qualität, Entfernung.

## MVP-Phasen

### P1: Stammdaten + Matching

- `supplier_product_categories` anlegen.
- vorhandene Geschäftspartner um Funktion `Lieferant`/`Kunde` nutzbar machen, falls noch nicht vorhanden.
- `supplier_capabilities` bzw. `customer_supplier_categories` als Zuordnung Geschäftspartner ↔ Produktkategorie anlegen.
- `supplier_capability_tags` für kombinierbare Chips wie Transportfähigkeiten anlegen.
- Kategoriebezogene Lieferantenpriorität in der Zuordnung speichern und im Matching berücksichtigen.
- Matching-Helper mit Tests: Kategorie, Alias, Material, Aktivstatus.
- UI für Produktkategorien und Lieferantenfähigkeiten inkl. jederzeitiger Kategorie-Neuanlage.

### P2: Konkrete Produkte verknüpfen

- Konkrete Produkte/Artikel mit möglichen Lieferanten verknüpfen.
- Produkt kann 1 bis wenige bevorzugte/zulässige Lieferanten haben.
- Suche soll sowohl über Produktkategorie als auch über konkrete Produkt-/Fähigkeitsbezeichnung passende Lieferanten zeigen.
- Diese Produktverknüpfung bleibt zunächst Stammdaten-/Suchfunktion, keine Anfrageabwicklung.

### P3: Anfrage anlegen — später

- `supplier_inquiries`, `supplier_inquiry_items`, `supplier_inquiry_recipients`.
- Seite `Lieferantenanfragen` mit Liste und Detail.
- Position erfassen und passende Lieferanten anzeigen.
- Empfänger auswählen und Anfrageentwurf erzeugen.

### P4: Versand/Antworten — später

- E-Mail-Entwurf/Export pro Lieferant.
- Versand nur nach Freigabe.
- Antwortstatus manuell pflegen; später Mail-Import.
- Anhänge/Zeichnungen sauber bündeln.

### P5: Lieferantenangebote + Entscheidung — später

- Eingehende Angebote erfassen.
- Einkaufskonditionen nur mit Berechtigung sichtbar.
- Vergleich/Entscheidung dokumentieren.
- Optional Übergabe an Projekt/Kalkulation/Einkauf.

## TDD-Aufgaben für Umsetzung

### Task 1: Kategorien- und Capability-Typen

**Files:**
- Modify: `src/app/lib/types.ts`
- Create: `server/suppliers/supplierMatching.ts`
- Test: `server/suppliers/supplierMatching.test.ts`

Tests:

- Kategorie `Stahlwannen` matcht Eingabe `Ölwanne aus Stahl` über Alias/Material.
- TROWAtech mit nur `Aluminiumwannen` matcht nicht für `Stahlwannen`.
- Elbag matcht für `Ölauffangwanne aus Edelstahl`.
- HT-VOLTEQ matcht für `Wanne mit Folienauskleidung`.
- Plas-tec matcht für `Ölauffangwanne aus Kunststoff`.
- `Druckberechnung Störlichtbogen Mittelspannung` matcht THETA, netzstudien.de, plancom, Enarcgee und weitere passende Ingenieurbüros mit nachvollziehbarer Begründung.
- `Spediteur` + `Kran bis 5 t` + `Flexibel` matcht nur Transportkontakte, die alle drei Chips besitzen.
- `Spediteur` + `Kran bis 5 t` + `Fixtermin` matcht nur Transportkontakte, die Fixtermine fahren können.
- Bei `Öltransformatoren` sortiert die gepflegte Priorität `TEK` vor `SGB`.
- Bei `Gießharztransformatoren` sortiert die gepflegte Priorität `SGB` vor `TEK`.
- Inaktive Lieferanten/Fähigkeiten werden nicht vorgeschlagen.

### Task 2: DB-Migration + Entity-Mapping

**Files:**
- Create: `migrations/XXX_supplier_inquiries.sql`
- Modify: `server/routes/entities.ts`

Checks:

- Tabellen für Kategorien, Geschäftspartner-Funktionen/Fähigkeiten, Anfragen, Positionen und Empfänger existieren.
- Lieferantenfähigkeit referenziert vorhandene Geschäftspartner per `customer_id`; keine Lieferanten-Dubletten.
- Lieferantenfähigkeit speichert eine optionale Kategorie-Priorität, ohne eine globale Lieferantenrangfolge zu erzwingen.
- Generische Entity-Routen funktionieren für die neuen Collections.

### Task 3: Stammdaten-UI

**Files:**
- Create: `src/app/pages/SupplierProductCategoriesPage.tsx`
- Create/Modify: Geschäftspartner-/Kunden-Stammdaten-Komponente für Funktionen `Kunde`/`Lieferant` und Lieferantenfähigkeiten
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/Sidebar.tsx`

Checks:

- Produktkategorien sind systemweit pflegbar.
- Kategorien können jederzeit über `Kategorie hinzufügen` neu angelegt werden.
- Neue Kategorien sind direkt in Lieferantenfähigkeiten und Lieferantenanfragen nutzbar.
- Bereits verwendete Kategorien werden archiviert statt gelöscht.
- Geschäftspartner können Funktion `Kunde`, `Lieferant` oder beides haben.
- Geschäftspartner mit Funktion `Lieferant` kann mehrere Kategorien/Fähigkeiten erhalten, z. B. `Öltransformatoren` und `Gießharztransformatoren`.
- Transportkontakte können mehrere Chips/Fähigkeiten erhalten, z. B. `Spediteur`, `Palettenware`, `Kran bis 5 t`, `Kran bis 2,5 t`, `Fixtermine`, `Flexibel`.
- Je Lieferantenfähigkeit kann eine Kategorie-Priorität gepflegt werden; die Sortierung darf je Kategorie verschieden sein.
- TROWAtech kann als Aluminium-Ölwannen-Fertiger gepflegt werden.
- Elbag kann als Edelstahl-Ölauffangwannen-Lieferant gepflegt werden.
- HT-VOLTEQ kann als Lieferant für Wannen mit Folienauskleidung gepflegt werden.
- Plas-tec kann als Kunststoff-Ölauffangwannen-Lieferant mit Referenzlink gepflegt werden.
- Druckberechnungs-Anbieter können als Dienstleistungsfähigkeiten mit Passung, Tags und Notizen gepflegt werden.

### Task 4: Lieferantenanfrage-UI

**Files:**
- Create: `src/app/pages/SupplierInquiriesPage.tsx`
- Create: `src/app/pages/SupplierInquiryDetailPage.tsx`
- Test: UI-/Source-Contract-Test

Checks:

- Neue Lieferantenanfrage kann angelegt werden.
- Produkt/Kategorie-Auswahl zeigt passende Lieferanten.
- Empfänger können ausgewählt und als Entwurf gespeichert werden.

## Akzeptanzkriterien

- Nutzer können systemweite Produktkategorien wie `Stahlwannen` pflegen.
- Nutzer mit Stammdatenrecht können jederzeit weitere Produkt-/Dienstleistungskategorien hinzufügen, ohne Codeänderung oder Deployment.
- Neue Kategorien stehen sofort für Matching, Lieferantenfähigkeiten und neue Lieferantenanfragen bereit.
- Nutzer können vorhandenen Geschäftspartnern die Funktion `Lieferant` und/oder `Kunde` geben.
- Nutzer können Lieferanten-Geschäftspartnern mehrere Produktkategorien/Fähigkeiten zuordnen.
- Bei Suche `Ölwanne aus Stahl` werden Lieferanten mit passender Stahlwannen-Fähigkeit angezeigt.
- Passende Lieferanten werden innerhalb der jeweiligen Kategorie nach gepflegter Priorität sortiert; kategorieabhängige Reihenfolgen wie `Öltransformatoren: TEK vor SGB` und `Gießharztransformatoren: SGB vor TEK` sind möglich.
- TROWAtech kann als Lieferant für `Ölwannen aus Aluminium` gepflegt werden.
- TROWAtech erscheint für Stahlwannen nur, wenn diese Fähigkeit zusätzlich hinterlegt ist.
- Elbag kann als Lieferant für `Ölauffangwannen aus Edelstahl` gepflegt werden und erscheint bei Edelstahlwannen.
- HT-VOLTEQ kann als Lieferant für `Wannen aus Folienauskleidung` gepflegt werden und erscheint bei Folienauskleidungen.
- Plas-tec kann als Lieferant für `Ölauffangwannen aus Kunststoff` gepflegt werden und erscheint bei Kunststoffwannen.
- Transporte sind über kombinierbare Chips filterbar; mehrere ausgewählte Chips müssen gemeinsam erfüllt sein.
- Beispiel `Spediteur` + `5t Kran` + `Flexibel` zeigt nur Geschäftspartner, die Spedition, Kran bis 5 t und flexible Termine unterstützen.
- Druckberechnungen sind als systemweite Kategorie pflegbar; die genannten Anbieter können mit Passung und Begründung hinterlegt werden.
- Lieferantenanfragen können mit Positionen, Spezifikation, Anhängen und ausgewählten Empfängern gespeichert werden.
- Versand erfolgt nicht automatisch ohne Freigabe.
- Einkaufskonditionen/Lieferantenangebote sind später berechtigungsgetrennt.

## Nicht im MVP

- Automatische Bestellfreigabe.
- Automatische Lieferantenauswahl ohne menschliche Prüfung.
- KI als alleinige Stammdatenquelle.
- Vollautomatischer Preisvergleich ohne Rechteprüfung.
