---
id: anfrage-dashboard-ki-angebotserstellung-hwerp
title: "Anfrage-Dashboard + KI-Angebotserstellung kompatibel zu HWERP"
status: in-bearbeitung
priority: high
created: 2026-05-22
updated: 2026-05-30
---

# Anfrage-Dashboard + KI-Angebotserstellung kompatibel zu HWERP

> **For Hermes:** Vor Implementierung `test-driven-development` und bei größerem Slice `subagent-driven-development` nutzen. Umsetzung taskweise, keine automatische Mail/Angebotsversendung ohne Freigabe.

**Goal:** Alle Anfragen aus Mail und später weiteren Quellen sammeln, KI-gestützt einstufen, Rückfragen/Antwortentwürfe vorbereiten, ähnliche Anfragen/Aufträge anzeigen und daraus HWERP-kompatible Kalkulationsentwürfe vorbereiten. Das Anfragemodul selbst zeigt und speichert keine Beträge, damit es von allen Benutzern verwendet werden kann — auch von gewerblichen Nutzern ohne Preiszugang.

**Architecture:** HWERP bleibt das führende System für Kunden, Assets, Materialien, Services und Kalkulationen. Neue Anfrage-Objekte werden als eigene Entities/Tables ergänzt und verweisen nur bei Bedarf auf bestehende `customers`, `locations`, `assets`, `calculations` und `calculation_line_items`. Der Agent erzeugt Entwürfe und Empfehlungen, aber keine automatische Zusage, keine automatische Preiskalkulation als finale Wahrheit und keine automatische Antwort ohne manuelle Freigabe. Preis-/Betragsdaten bleiben ausschließlich in berechtigten HWERP-Kalkulations-/Angebotsbereichen und werden im Anfragemodul nicht angezeigt.

**Tech Stack:** React/Vite + Express API + PostgreSQL + bestehende generische `/api/entities`-Struktur; Mail-Import per IMAP/Worker; KI-Auswertung worker-/agent-basiert mit auditierbaren Ergebnissen.

## Umsetzungsstand

- 2026-05-22: P1 gestartet.
- Erledigt: Domain-Typen für Anfragekarten, Nachrichten und Antwortentwürfe.
- Erledigt: Status-/Handlungsbedarf-Helper mit Tests.
- Erledigt: Backend-Entity-Mapping und PostgreSQL-Migration für `inquiries`, `inquiry_messages`, `inquiry_response_drafts`.
- Erledigt: Preisfreier Scope-Builder aus HWERP-Assets, Leistungen und Materialien.
- Erledigt: Anfrage-Detail-Foundation mit Anhängen, externen Links, Direkt-Route `/inquiries/:id` und Tests.
- Erledigt: Serverseitige Anfrage-Rechte für eigenes Board/Dispatcher-Admin-Zuweisung inkl. User-Entity-Migration und Permission-Tests.
- Erledigt: Mail-Import-Fixture mit Parser für Betreff, Absender, Reply-To, Body-Redaction, Duplikatprüfung und Anfrage-/Nachrichten-Erzeugung.
- Erledigt: Stammdaten- und Checklistenlogik für Vorlagenauswahl, Evidenzvorschläge, Rückfragen und Büro-Blocker.

---

## Produktentscheidung

- Mail ist der wichtigste Eingangskanal.
- Alle Quellen laufen in eine gemeinsame Anfrage-Inbox.
- Dashboard zeigt aktuelle Anfragen, Status, Handlungsbedarf, Antwortentwürfe und vorbereitete Kalkulationen.
- Agent stuft ein:
  - Anfrage-Typ
  - Dringlichkeit
  - Vollständigkeit
  - ob Rückfragen nötig sind
  - ob ähnliche Anfragen/Aufträge/Kalkulationen existieren
  - ob eine HWERP-Kalkulation vorbereitet werden kann
- Bei unklaren Angaben erzeugt der Agent einen Rückfrage-Entwurf statt still zu raten.
- Vorhandene Kalkulationen/Angebote dienen als Vergleichsgrundlage und Positionsvorschlag.
- Finaler Versand und finale Kalkulation bleiben manuell freizugeben.
- Keine Beträge im Anfragemodul: keine Angebotswerte, keine Positionspreise, keine Summen.
- Das Anfragemodul muss für alle Rollen nutzbar sein, auch für gewerbliche Nutzer ohne Preiszugang.
- Gewerbliche Mitarbeitende können z. B. per VPN/VPS auf HWERP zugreifen und im Anfragemodul einen Auftrag fachlich komplett vorkonfigurieren.
- Erlaubt im Anfragemodul: Arbeiten auswählen, benötigte Leistungen, Mengen, Stunden, technische Daten, Anhänge und Hinweise erfassen.
- Nicht erlaubt im Anfragemodul: Preise, Stundensätze, Materialpreise, Positionssummen oder Angebotssummen anzeigen/eingeben.
- Das Büro sieht die Anfrage dauerhaft in HWERP, kann sie jederzeit abrufen und ergänzt Preise erst später im berechtigten Kalkulations-/Angebotsbereich.
- Kalkulations-/Preisdetails bleiben in den vorhandenen HWERP-Berechtigungsbereichen und werden aus dem Anfragemodul nur verlinkt oder als „Kalkulation vorbereitet“ angezeigt.
- Startseite des Moduls ist ein Kanban-Board: Anfragekarten stehen in Status-Spalten und zeigen Bearbeiter/Mitarbeiter, Priorität, Quelle und nächste Aktion.
- Jeder Mitarbeiter sieht standardmäßig sein eigenes Kanban-Board mit den ihm zugewiesenen Anfragen.
- Berechtigte Mitarbeiter sehen alle Boards/Anfragen und können Anfragen anderen Mitarbeitern zuweisen.
- Nicht jeder Nutzer darf zuweisen; Zuweisung und Board-übergreifende Sicht brauchen eigene Rechte/Rollen.
- Rechteverwaltung bevorzugt pragmatisch im bestehenden HWERP-Kontext starten: eigenes kleines Rollen-/Permission-Modell für V1; ein fertiges Auth-/RBAC-System erst prüfen, wenn Mehrmandanten-/SSO-/Audit-Anforderungen deutlich wachsen.
- Jede Anfrage braucht eine eigene Detailansicht, die aus Kanban/Listeneintrag geöffnet wird und den gesamten Vorgang bündelt: Kunde, Ansprechpartner, zuständige Mitarbeitende, Eingangskanal, Originalkommunikation, Bilder/Anhänge, Notizen, Links zu HWERP/Lexoffice/Angeboten und nächste Aktionen.
- Die Detailansicht darf als Modal/Sidepanel starten; zusätzlich soll sie als eigene URL/extra Fenster direkt öffnungsfähig sein.
- Anhänge/Bilder sollen dauerhaft gespeichert und in der Anfrage verlinkt werden; Ziel kann später SharePoint/OneDrive sein, V1 darf lokal starten, aber mit externer Speicher-URL vorbereitet werden.
- Für Standardangelegenheiten braucht HWERP pflegbare Stammdaten und Checklisten-Vorlagen. Je nach erkannter Anfrageart wählt die KI die passende Vorlage aus; Mitarbeiter und KI arbeiten dieselbe Checkliste ab.
- Checklisten sind nicht nur UI-Notizen, sondern regelbare Arbeitsabläufe: Pflichtfragen, benötigte technische Daten, Dokumente/Fotos, Zuständigkeiten, nächste Aktionen und Übergabekriterien ans Büro.
- Die KI darf Checklistenpunkte vorschlagen/abhaken, wenn der Nachweis aus Anfrage, Mail, Anhang oder vorhandenen HWERP-Stammdaten eindeutig ist. Unsichere Punkte bleiben offen und erzeugen Rückfragen.

## Quellen

### Phase 1

- IMAP-Mailpostfach, z. B. zentrale Anfrage-Mailadresse
- Manuelle Anlage im Dashboard

### Phase 2

- Telegram
- WhatsApp
- Webformular / Upload
- interne Notiz oder Sprach-/Bildinput später über dieselbe Struktur

## Datenmodell-Vorschlag

### `inquiries`

Zentrale Anfragekarte.

Wichtige Felder:

- `id`
- `title`
- `status`: `new | triage | waiting_for_customer | ready_for_calculation | calculation_draft | offer_draft | sent | won | lost | archived`
- `priority`: `low | normal | high | urgent`
- `source`: `email | telegram | whatsapp | web | manual`
- `source_message_id`
- `sender_name`
- `sender_email`
- `sender_phone`
- `customer_id` optional
- `location_id` optional
- `asset_id` optional
- `related_calculation_id` optional
- `summary`
- `raw_text`
- `received_at`
- `last_action_at`
- `next_action`
- `needs_attention` boolean
- `assignee_user_id` optional: aktuell zuständiger Mitarbeiter
- `assigned_by_user_id` optional
- `assigned_at` optional
- `created_by_user_id` optional

### `employees` / `users`

Mitarbeiterverwaltung für Board-Zuweisung und Rechte.

Wichtige Felder:

- `id`
- `name`
- `email`
- `active`
- `role`: `employee | dispatcher | admin`
- `can_view_all_inquiries` boolean
- `can_assign_inquiries` boolean
- optional später: Teams/Abteilungen, Vertreterregelung, SSO-Verknüpfung

V1-Rollen:

- `employee`: sieht eigenes Board und eigene Anfragen; darf Status der eigenen Anfragen pflegen.
- `dispatcher`: sieht alle Boards und darf zuweisen; keine Preisrechte allein dadurch.
- `admin`: Mitarbeiter/Rechte verwalten und alle Boards sehen.

### `inquiry_messages`

Original- und Folgekommunikation.

- Quelle, Richtung `inbound/outbound/draft`
- Betreff, Body, Anhänge
- Message-ID / Thread-ID
- Zuordnung zu `inquiry_id`

### `inquiry_attachments`

Bilder, PDFs und sonstige Dateien aus Mail, Messenger, Webformular oder manueller Anlage.

- `id`
- `inquiry_id`
- `message_id` optional
- `source`: `email | telegram | whatsapp | web | manual`
- `file_name`
- `mime_type`
- `file_size`
- `storage_provider`: `local | sharepoint | onedrive | external`
- `storage_url` oder interner Pfad
- `thumbnail_url` optional für Bilder
- `uploaded_by_user_id` optional
- `created_at`

Hinweis: V1 darf lokal speichern; Datenmodell und UI sollen aber schon externe Speicherlinks unterstützen, damit SharePoint später ohne UI-Neubau nachgerüstet werden kann.

### `inquiry_external_links`

Verweise auf externe oder HWERP-nahe Vorgänge.

- `id`
- `inquiry_id`
- `kind`: `hwerp_customer | hwerp_asset | hwerp_calculation | hwerp_offer | lexoffice_customer | lexoffice_offer | sharepoint_folder | other`
- `label`
- `url` oder `target_id`
- `created_by_user_id` optional
- `created_at`

### `inquiry_agent_reviews`

Auditierbare KI-Auswertung.

- `inquiry_id`
- `classification`
- `confidence`
- `missing_information[]`
- `suggested_questions[]`
- `risk_notes[]`
- `suggested_customer_id/location_id/asset_id`
- `suggested_calculation_basis[]`
- `created_at`

### `inquiry_response_drafts`

Antwortentwürfe.

- `inquiry_id`
- `kind`: `clarification | acknowledgement | offer_intro | rejection | follow_up`
- `subject`
- `body`
- `status`: `draft | approved | sent | discarded`
- keine automatische Versendung in MVP

### `inquiry_similarity_links`

Ähnliche Anfragen/Aufträge/Kalkulationen.

- `inquiry_id`
- `target_type`: `inquiry | calculation | customer | asset`
- `target_id`
- `score`
- `reason`

### `calculation_preparation_drafts`

Vorbereitung für HWERP-Kalkulation ohne Beträge im Anfragemodul.

- `inquiry_id`
- `basis_calculation_id` optional
- `target_customer_id`
- `target_location_id`
- `target_asset_id`
- `work_scope_suggestions` JSON: Arbeiten, Leistungen, Mengen, Stunden, technische Daten und Hinweise; ausdrücklich ohne `unitPrice`, `totalPrice`, Stundensätze oder Summen
- `status`: `draft | submitted_to_office | applied | discarded`

### `inquiry_master_data_categories`

Pflegbare Stammdaten-Gruppen für Standardfälle.

- `id`
- `name`, z. B. Trafo-Service, Reparatur, Wartung, Lieferung, Störung, Prüfung, Sonderfall
- `description`
- `active`
- `sort_order`

### `inquiry_checklist_templates`

Vorlagen, die je Anfrageart automatisch oder manuell ausgewählt werden.

- `id`
- `category_id`
- `name`
- `trigger_keywords[]` oder später regelbasierte Bedingungen
- `applies_to_sources[]`: Mail, manuell, Telegram, WhatsApp, Web
- `required_role`: wer freigeben darf, z. B. Mitarbeiter, Dispatcher, Büro
- `active`
- `version`

### `inquiry_checklist_items`

Einzelne Prüfpunkte innerhalb einer Vorlage.

- `id`
- `template_id`
- `label`
- `description`
- `kind`: `required_info | document | photo | technical_data | customer_question | internal_check | office_handover`
- `required` boolean
- `ai_can_complete` boolean
- `evidence_hint`: welche Daten als Nachweis gelten
- `sort_order`

### `inquiry_checklist_runs`

Konkrete Checkliste auf einer Anfrage.

- `id`
- `inquiry_id`
- `template_id`
- `status`: `open | in_progress | blocked | completed | discarded`
- `selected_by`: `ai | user`
- `created_at`
- `completed_at`

### `inquiry_checklist_run_items`

Bearbeitungsstand je Prüfschritt.

- `id`
- `checklist_run_id`
- `template_item_id`
- `status`: `open | suggested_done | done | not_applicable | needs_clarification`
- `evidence_text`
- `evidence_source`: Mail, Anhang, Stammdaten, manuelle Eingabe, KI-Vorschlag
- `completed_by_user_id` optional
- `completed_by_ai_review_id` optional

## UI: Anfrage-Dashboard

Neue Seite: `src/app/pages/InquiryDashboardPage.tsx`
Route: `/inquiries`
Sidebar: `Anfragen`

Startseite:

- Die App-Startseite bzw. Standardansicht für das Anfragemodul ist das Kanban-Board.
- Board-Spalten folgen den Anfrage-Statuswerten, z. B. `new`, `triage`, `waiting_for_customer`, `ready_for_calculation`, `calculation_draft`, `offer_draft`, `sent`, `won`, `lost`, `archived`.
- Karten zeigen mindestens: Titel, Kunde/Absender, Quelle, Priorität, Bearbeiter, nächste Aktion, Eingangsdatum.
- Standardfilter für normale Mitarbeiter: `assignee_user_id = aktueller Nutzer`.
- Umschalter für berechtigte Nutzer: „Mein Board“ / „Alle Boards“ / Filter nach Mitarbeiter.
- Zuweisungs-Dropdown nur sichtbar/aktiv für Nutzer mit `can_assign_inquiries`.

Ansichten:

1. **Inbox**
   - neue/ungelesene Anfragen
   - Filter: Status, Priorität, Quelle, Kunde, Handlungsbedarf

2. **Handlungsbedarf**
   - Rückfrage nötig
   - fehlende Daten
   - dringende Anfrage
   - Agent unsicher

3. **Entwürfe**
   - Antwortentwürfe
   - Rückfragen
   - vorbereitete Kalkulationen

4. **Ähnliche Vorgänge**
   - ähnliche Anfragen
   - ähnliche Kalkulationen ohne Preis-/Summenanzeige
   - ähnliche Assets/Kunden

5. **Kalkulation vorbereiten**
   - fachlichen Arbeitsumfang zusammenklicken: Arbeiten, Leistungen, Mengen, Stunden, technische Daten
   - vorgeschlagene Positionen fachlich prüfen, aber ohne Beträge im Anfragemodul
   - bestehende Kalkulation als Vorlage wählen, Beträge nur im berechtigten Kalkulationsbereich anzeigen
   - Button/Status: `Ans Büro übergeben`; Büro ergänzt Preise in HWERP
   - Entwurf in HWERP-Kalkulation übernehmen

6. **Stammdaten + Checklisten**
   - Stammdaten-Gruppen und Checklisten-Vorlagen verwalten
   - Vorlage pro Anfrage automatisch vorschlagen oder manuell wechseln
   - offene/Pflichtpunkte sichtbar machen
   - KI-Vorschläge mit Nachweis anzeigen, aber manuelle Bestätigung ermöglichen
   - aus offenen Pflichtpunkten automatisch Rückfragen erzeugen

## UI: Anfrage-Detailansicht

Öffnung:

- Klick auf Kanban-Karte oder Tabellenzeile öffnet zunächst ein breites Modal/Sidepanel.
- Detailansicht muss per URL direkt erreichbar sein, z. B. `/inquiries/:id`, damit sie später in neuem Fenster/Tab geöffnet werden kann.
- Modal enthält Link/Button „In neuem Fenster öffnen“.

Pflichtbereiche:

1. **Kopfbereich**
   - Titel, Status, Priorität, nächste Aktion, Eingangsdatum
   - Quelle/Eingangskanal: E-Mail, Telegram, WhatsApp, Webformular, manuell
   - Zuständiger Mitarbeiter, Zuweisung ändern nur mit Recht

2. **Kunde & Beteiligte**
   - erkannter Absender/Ansprechpartner
   - verknüpfter HWERP-Kunde, Standort, Asset/HT-Nummer
   - beteiligte Mitarbeiter/Bearbeiter
   - offene Kundendaten als Warnhinweis/Rückfrage

3. **Kommunikation**
   - Originalnachricht und Verlauf/Thread
   - Antwort-/Rückfrageentwürfe
   - interne Notizen
   - keine automatische Versendung ohne Freigabe

4. **Bilder & Anhänge**
   - Galerie/Liste mit Vorschaubildern, Dateiname, Quelle, Zeitpunkt
   - Download/Öffnen-Link
   - Speicherziel sichtbar: lokal/SharePoint/extern
   - später: SharePoint-Ordner pro Anfrage automatisch anlegen/verlinken

5. **Fachliche Vorkonfiguration**
   - Arbeiten, Leistungen, Mengen, Stunden, technische Daten, Hinweise
   - Checkliste je Anfrageart mit Pflichtfragen/Pflichtdaten
   - fehlende Informationen und Rückfragen
   - Button „Ans Büro übergeben“
   - weiterhin keine Beträge/Preise/Summen

6. **Verknüpfungen**
   - Link zu HWERP-Kunde/Asset/Kalkulation, falls vorhanden
   - Link zu vorbereitetem HWERP-Kalkulationsentwurf
   - Link zu Lexoffice-Kunde/Angebot, falls vorhanden
   - Link zum SharePoint-/OneDrive-Ordner, falls vorhanden

7. **Historie/Audit**
   - Statuswechsel, Zuweisungen, Importzeitpunkte, Agent-Auswertungen
   - wer was geändert/übergeben/freigegeben hat

V1-Umfang: Detailansicht mit Kopf, Kunde, Mitarbeiter, Kommunikation, Anhänge, Links, Checkliste und fachlicher Vorkonfiguration. SharePoint-/Lexoffice-Integration darf zunächst als manuell gepflegter Link starten; automatische Sync-/Ordnerlogik später.

## Mail-Import

Script/Worker, nicht im Browser:

- liest IMAP-Postfach
- importiert neue Mails anhand Message-ID nur einmal
- speichert Body + Anhänge
- ordnet Thread/Folgeantworten derselben Anfrage zu
- markiert optional als gelesen oder verschiebt in `Imported`
- schreibt keine sensitiven Inhalte ins Log

Konfiguration später über Env:

- `INQUIRY_MAIL_HOST`
- `INQUIRY_MAIL_PORT`
- `INQUIRY_MAIL_SECURE`
- `INQUIRY_MAIL_USER`
- `INQUIRY_MAIL_PASSWORD`
- `INQUIRY_MAILBOX`
- `INQUIRY_MAIL_IMPORTED_FOLDER`

## Agent-Logik

Der Agent arbeitet in Stufen:

1. **Extraktion**
   - Kunde, Ansprechpartner, Objekt, Standort, Frist, Leistung, technische Daten, Anhänge

2. **Einstufung**
   - Anfrage-Typ, Dringlichkeit, Vollständigkeit, fachlicher Aufwand in Stunden/Mengen, aber keine Kosten-/Preisbewertung

3. **Checklisten-Auswahl**
   - passende Stammdaten-Kategorie und Checklisten-Vorlage anhand Anfrage-Typ, Begriffen, Quelle und vorhandenen HWERP-Daten vorschlagen
   - Pflichtpunkte anhand Mail/Text/Anhängen/Stammdaten mit Nachweis befüllen
   - unsichere oder fehlende Punkte als `needs_clarification` offen lassen

4. **Matching**
   - ähnliche Anfragen über Text, Kunde, Assetdaten, Betreff, Begriffe
   - ähnliche Kalkulationen über Kunde, Asset, Positionsbeschreibungen, Services/Materialien

5. **Rückfrage-Entwurf**
   - wenn Angaben fehlen, konkrete kurze Fragen vorbereiten

6. **Kalkulationsvorbereitung**
   - passende alte Kalkulation/Positionen vorschlagen
   - neue HWERP-Kalkulation als Draft vorbereiten
   - Positionen als Vorschlag markieren, nicht final übernehmen

## HWERP-Kompatibilität

- Kalkulationsentwurf nutzt bestehende `calculations` und `calculation_line_items`.
- Neue Anfrage darf optional eine Kalkulation referenzieren.
- Bestehende `customers`, `locations`, `assets`, `materials`, `services` bleiben führend.
- Kein separates Angebots-/Kalkulationssystem außerhalb von HWERP.
- Keine Preis-/Betragsfelder in Anfrage-Entities, Anfrage-Dashboard oder Agent-Review-Ausgabe.
- Gewerbliche Nutzer ohne Preiszugang dürfen das Anfragemodul vollständig nutzen; sie sehen nur Status, fachliche Inhalte, Arbeiten, Mengen, Stunden, Rückfragen und freigegebene Texte, aber keine Beträge.
- Das Anfragemodul ist ein eigenständiger Vorbereitungsbereich: fachliche Auftragserfassung vor Preis-/Angebotskalkulation.
- Übergabe ans Büro/HWERP überführt den fachlichen Umfang in den berechtigten Kalkulationsbereich, wo Preise ergänzt werden.
- Wenn später echte Angebote/Angebotsnummern kommen, werden sie als Status/Export auf HWERP-Kalkulationen aufgebaut und nicht als Beträge im Anfragemodul dupliziert.

## MVP-Phasen

### P1: Anfrage-Inbox + manuelle Mail-Importbasis

- DB-Tabellen/Migration für `inquiries`, `inquiry_messages`, `inquiry_response_drafts`
- `assignee_user_id`/Zuweisungsfelder in `inquiries`
- einfache Mitarbeiter-/Rollenbasis: `employee`, `dispatcher`, `admin`
- Entity-Mapping in `server/routes/entities.ts`
- `InquiryDashboardPage.tsx` als Kanban-Startseite mit „Mein Board“
- manuelle Anlage und Demo-Mail-Import aus Datei/Fixture
- Status/Handlungsbedarf sichtbar
- Zuweisen nur für berechtigte Nutzer sichtbar

### P2: echter IMAP-Import

- Worker-Script für IMAP
- Duplikatschutz über Message-ID
- Attachments speichern
- Bilder/Anhänge in `inquiry_attachments` erfassen und in der Detailansicht anzeigen
- Thread-Zuordnung
- Import-Status und Fehler sichtbar machen

### P2b: Mitarbeiterverwaltung + Rechteverwaltung härten

- Mitarbeiterliste verwalten: aktiv/inaktiv, Name, E-Mail, Rolle
- Rechte zentral prüfen: eigenes Board vs. alle Boards, Zuweisen erlaubt/nicht erlaubt
- Server-seitige Permission-Checks ergänzen, nicht nur UI ausblenden
- Entscheidung festhalten: eigenes V1-RBAC behalten oder fertiges System integrieren

### P2c: Stammdaten + Checklisten-Vorlagen

- Stammdaten-Gruppen für Standardangelegenheiten anlegen/pflegen
- Checklisten-Vorlagen mit Pflichtpunkten, benötigten Daten, Dokumenten/Fotos und Übergabekriterien verwalten
- Checklisten pro Anfrage automatisch vorschlagen und manuell wechselbar machen
- KI darf Punkte nur mit Nachweis vorschlagen/abhaken; unsichere Punkte bleiben offen
- offene Pflichtpunkte erzeugen Rückfragen und blockieren „Ans Büro übergeben“, wenn sie zwingend sind

### P3: Agent-Auswertung

- Agent-Review speichern
- fehlende Angaben erkennen
- Priorität/Typ vorschlagen
- Antwortentwurf erzeugen
- Dashboard-Badge `Handlungsbedarf`

### P4: Ähnliche Anfragen/Aufträge

- deterministisches Matching zuerst:
  - Kunde/E-Mail
  - Asset/HT-Nummer/Seriennummer
  - Betreff/Keywords
  - vorhandene Kalkulationstitel/Positionen
- später optional Embeddings/Vektorsuche

### P5: HWERP-Kalkulation vorbereiten

- passende bestehende Kalkulation als fachliche Vorlage wählen
- `calculation_preparation_drafts` ohne Betragsfelder erzeugen
- Button: `Ans Büro übergeben` / `Kalkulationsentwurf in HWERP anlegen`
- erzeugte Kalkulation bleibt Status `DRAFT`; Preise werden erst im berechtigten HWERP-Kalkulationsbereich ergänzt

### P6: Externe Links + Dokumentenspeicher

- manuelle Links zu HWERP-Kunde/Asset/Kalkulation und Lexoffice-Kunde/Angebot pflegen
- SharePoint-/OneDrive-Ordnerlink je Anfrage speichern
- Bilder/Anhänge aus Mail/Messenger/Webformular in der Detailansicht bündeln
- später automatische Anlage/Sync von Anfrageordnern und Anhängen prüfen
- Detailansicht zeigt alle Links gebündelt ohne Preisdetails

## TDD-Aufgaben für Umsetzung

### Task 1: Domain-Typen und Statuslogik

**Files:**
- Modify: `src/app/lib/types.ts`
- Create: `src/app/lib/inquiryUtils.ts`
- Test: `src/app/lib/inquiryUtils.test.ts`

Tests:

- neue Anfrage mit fehlender Rückmeldung setzt `needsAttention=true`
- Status `waiting_for_customer` setzt nächste Aktion korrekt
- Quelle `email` wird als primärer Kanal angezeigt

### Task 2: DB-Migration + Entity-Mapping

**Files:**
- Create: `migrations/004_inquiry_dashboard.sql`
- Modify: `server/routes/entities.ts`

Tests/Checks:

- Tabellen existieren
- `/api/entities/inquiries` liefert Daten
- Upsert funktioniert

### Task 3: Dashboard-Seite

**Files:**
- Create: `src/app/pages/InquiryDashboardPage.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/Sidebar.tsx`

Checks:

- `/inquiries` erreichbar
- Startansicht ist Kanban mit Status-Spalten
- Normale Nutzer sehen nur zugewiesene Karten („Mein Board“)
- Berechtigte Nutzer können „Alle Boards“ und Mitarbeiterfilter nutzen
- Inbox zeigt Status, Quelle, Priorität, Bearbeiter, nächste Aktion
- Entwürfe und ähnliche Vorgänge sind sichtbar, wenn vorhanden

### Task 3a: Anfrage-Detailansicht

**Files:**
- Create/Modify: `src/app/pages/InquiryDetailPage.tsx` oder Detail-Komponente neben `InquiryDashboardPage.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/app/pages/InquiryDetailPage.test.ts`

Checks:

- Klick auf Anfrage öffnet Detail-Modal/Sidepanel
- `/inquiries/:id` ist direkt erreichbar
- Detail zeigt Kunde, zuständige Mitarbeiter, Eingangskanal, Kommunikation, Anhänge, Checkliste, HWERP-/Lexoffice-/SharePoint-Links und fachliche Vorkonfiguration
- Detail zeigt keine Beträge, Preise oder Summen

### Task 3b: Rechte + Zuweisung serverseitig absichern

**Files:**
- Create/Modify: Mitarbeiter-/User-Entity bzw. vorhandenes Auth-Modul
- Modify: `server/routes/entities.ts` oder dedizierte Inquiry-Route
- Test: Permission-/Assignment-Tests

Tests:

- [x] Nutzer ohne `can_assign_inquiries` kann `assignee_user_id` nicht ändern
- [x] Nutzer ohne `can_view_all_inquiries` bekommt nur eigene Anfragen
- [x] `dispatcher`/`admin` darf Anfragen anderen Mitarbeitern zuweisen
- [x] UI-Ausblendung ist nicht die einzige Absicherung

### Task 4: Mail-Import-Fixture ✅

**Status:** umgesetzt und getestet.

**Files:**
- Create: `server/inquiry/mailParser.ts`
- Create: `server/inquiry/mailParser.test.ts`

Tests:

- Betreff, Absender, Reply-To, Body normalisieren
- Duplikat-Message-ID erkennen
- Anfrage aus Mail erzeugen

### Task 5: Stammdaten- und Checklistenlogik ✅

**Status:** umgesetzt und getestet.

**Files:**
- Create: `server/inquiry/checklistTemplates.ts`
- Test: `server/inquiry/checklistTemplates.test.ts`
- Modify: `src/app/lib/types.ts`

Tests:

- Anfrage-Typ wählt passende Checklisten-Vorlage über Keywords/Kategorie
- Pflichtpunkt mit eindeutiger Text-/Anhang-Evidenz wird als `suggested_done` markiert
- unsicherer Pflichtpunkt bleibt `needs_clarification` und erzeugt Rückfragebedarf
- Checklisten-Vorschläge enthalten keine Preis-/Betragsfelder

### Task 6: Agent-Review-Datenstruktur

**Files:**
- Create: `server/inquiry/agentReview.ts`
- Test: `server/inquiry/agentReview.test.ts`

Tests:

- fehlende Frist/Standortdaten erzeugen Rückfrage-Vorschläge
- dringende Wörter setzen Priorität hoch
- unsichere Erkennung erzeugt `needsAttention`
- Agent-Review referenziert vorgeschlagene Checklistenpunkte mit Evidenz

### Task 7: Ähnlichkeitsvorschläge

**Files:**
- Create: `server/inquiry/similarity.ts`
- Test: `server/inquiry/similarity.test.ts`

Tests:

- gleicher Kunde erhöht Score
- ähnliche Asset-/Seriennummer erhöht Score
- ähnliche Kalkulationspositionen werden begründet angezeigt

### Task 8: Kalkulationsvorbereitung

**Files:**
- Create: `server/inquiry/calculationPreparation.ts`
- Test: `server/inquiry/calculationPreparation.test.ts`

Tests:

- vorhandene Kalkulation wird als fachliche Vorlage vorgeschlagen
- Positions-/Arbeitsvorschläge enthalten Mengen und Stunden, aber keine `unitPrice`/`totalPrice`/Summen
- Button erzeugt neue `Calculation` nur als `DRAFT`

## Akzeptanzkriterien

- Neue Mail-Anfragen erscheinen im Dashboard.
- Startseite zeigt ein Kanban-Board mit Anfragekarten nach Status.
- Karten zeigen Status, Quelle, Priorität, Bearbeiter/Mitarbeiter, nächste Aktion und Entwürfe.
- Klick auf eine Anfrage öffnet eine Detailansicht mit Kunde, Mitarbeitern, Eingangskanal, Kommunikation, Bildern/Anhängen, Notizen, Links und fachlicher Vorkonfiguration.
- Die Detailansicht ist als Modal/Sidepanel und direkt per URL/extra Fenster nutzbar.
- Bilder/Anhänge sind dauerhaft referenziert und später SharePoint-/OneDrive-kompatibel speicherbar.
- Links zu HWERP, Lexoffice und vorhandenen Angebots-/Kalkulationsentwürfen können an der Anfrage gepflegt werden.
- Normale Mitarbeiter sehen standardmäßig nur ihr eigenes Board.
- Berechtigte Nutzer sehen alle Boards und können Anfragen zuweisen.
- Nutzer ohne Zuweisungsrecht können keine Bearbeiter ändern; das muss serverseitig abgesichert sein.
- Dashboard und Anfrage-Entities enthalten keine Beträge, Positionspreise oder Summen.
- Gewerbliche Nutzer ohne Preiszugang können das Anfragemodul nutzen, ohne Preisdetails zu sehen.
- Gewerbliche Nutzer können fachlichen Umfang, Arbeiten, Mengen und Stunden vorerfassen.
- Büro kann die Anfrage permanent in HWERP sehen und Preise später im berechtigten Kalkulationsbereich ergänzen.
- Stammdaten-Gruppen und Checklisten-Vorlagen können gepflegt werden.
- Je Anfrage wird eine passende Checkliste automatisch vorgeschlagen oder manuell ausgewählt.
- Mitarbeiter und KI arbeiten dieselbe Checkliste; KI-Erledigungen brauchen sichtbare Evidenz.
- Offene Pflichtpunkte erzeugen Rückfragen oder blockieren die Büro-Übergabe.
- Agent markiert Handlungsbedarf und erzeugt Rückfrageentwürfe.
- Ähnliche Anfragen/Kalkulationen werden mit Grund angezeigt.
- Eine HWERP-Kalkulation kann vorbereitet, aber nicht automatisch final versendet werden.
- Keine Antwort wird ohne Freigabe verschickt.
- Bestehende HWERP-Kalkulationsstruktur bleibt führend.

## Nicht im MVP

- Vollautomatischer Angebotsversand
- rechtlich verbindliche Preiszusage durch KI
- automatische Annahme/Ablehnung von Anfragen
- finale Angebots-PDF-Logik, falls noch kein Angebotsmodul existiert
- Embedding-Infrastruktur als Pflicht für Phase 1
