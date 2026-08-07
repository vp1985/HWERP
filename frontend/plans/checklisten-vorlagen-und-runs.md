---
id: checklisten-vorlagen-und-runs
title: "Stammdaten: Checklisten-Vorlagen, Rüstlisten und Checklisten-Läufe"
status: geplant
priority: high
created: 2026-06-03
updated: 2026-06-03
---

# Stammdaten: Checklisten-Vorlagen, Rüstlisten und Checklisten-Läufe

> **For Hermes:** Plan ist freigegebenes Fachkonzept, aber noch nicht umgesetzt. Umsetzung später per TDD. H-W-O-S immer als H-W-O-S behandeln. Keine Preise/Beträge in Checklisten modellieren.

**Goal:** H-W-O-S bekommt ein zentrales Checklisten-System unter **Stammdaten**, mit wiederverwendbaren Vorlagen für Trafo-Werkstattkarten, Auftragsvorbereitung und Rüstlisten. Aus Vorlagen werden konkrete Checklisten erzeugt, die an Werkstattkarten, Aufträge, Kalkulationen, Leistungen oder andere Vorgänge gehängt werden können.

**Architecture:** Die Vorlagenverwaltung liegt unter `Stammdaten → Checklisten`. Konkrete Checklisten-Läufe werden als Snapshot aus einer Vorlage erzeugt und behalten ihren Zustand unabhängig davon, ob die Vorlage später geändert oder archiviert wird. Werkstattkarten, Rüstlisten, Auftragsvorbereitung und Kalkulation nutzen dieselbe Checklisten-Engine, bekommen aber jeweils eigene Einstiegspunkte.

**Tech Stack:** bestehendes H-W-O-S React/Vite + Express API + PostgreSQL + generische Repository-/Entity-Struktur; Umsetzung mit Vitest-Domain-Tests zuerst.

---

## 1. Klare Produktentscheidung

- Oberpunkt im Menü: **Stammdaten**.
- Neuer Unterpunkt: **Checklisten**.
- Nicht als neuer Hauptpunkt unter Arbeitsvorbereitung anlegen.
- Bestehende Bereiche bleiben erstmal wie sie sind.
- Werkstattkarten, Auftragsvorbereitung, Rüstlisten und Kalkulationen bekommen nur die Möglichkeit, passende Checklisten aus den Stammdaten zu verwenden.
- Start-Vorlagen:
  - **Trafo-Werkstattkarte**
  - **Auftragsvorbereitung**
  - **Rüstlisten**

## 2. Preis-/Betragsentscheidung

Checklisten enthalten **keine Preisfelder und keine Beträge**.

Auch eine Checkliste für Kalkulation bedeutet nur: Aufgaben, Prüfung, Vollständigkeit, Freigabehinweise oder Dokumentationspunkte. Sie zeigt keine Preise/Beträge. Falls später eine Checkliste auf Kalkulationsdaten verweist, wird nur der fachliche Status angezeigt, nicht der Betrag.

Konsequenz:

- Kein Feld `price`, `amount`, `cost`, `margin` im Checklisten-Datenmodell.
- Rechte steuern Sichtbarkeit von Checklisten oder Punkten, nicht Preisansicht.
- Preis-/Betragsrechte bleiben separat im allgemeinen Rechtekonzept, werden für Checklisten aber erstmal nicht benötigt.

## 3. Fachliches Modell

### Checklisten-Vorlage

Eine Vorlage ist wiederverwendbar und wird unter Stammdaten gepflegt.

Felder:

- Name
- Typ: `Trafo-Werkstattkarte`, `Auftragsvorbereitung`, `Rüstliste`, später erweiterbar
- Beschreibung
- Status: `aktiv` oder `archiviert`
- Sichtbarkeit/Berechtigung: z. B. Büro, Arbeitsvorbereitung, Meister, Gewerblich, Admin
- optionale automatische Anwendung nach Kontext:
  - Leistung / Service
  - Auftragsart
  - Asset-Kategorie
  - Werkstattkarte
  - Kalkulation
- Gruppen/Sektionen
- Punkte
- Sortierung
- Änderungsinfo: erstellt/geändert von, Datum

### Gruppen/Sektionen

Checklisten können frei konfigurierbare Gruppen haben.

Start-Gruppen für Rüstlisten:

- Werkzeug
- Messgeräte
- PSA
- Dokumente
- Material / Ersatzteile
- Fahrzeug / Transport
- Fotos / Nachweise

Weitere Gruppen je Vorlagentyp:

- Vorbereitung
- Prüfung
- Freigabe
- Büro
- Werkstatt
- Versand / Abholung
- Kalkulationsprüfung

### Checklisten-Punkt

Jeder Punkt wird einzeln erledigt. Kein pauschales Abhaken ganzer Gruppen als MVP.

Felder pro Punkt:

- Titel
- Beschreibung / Hinweis
- Gruppe
- Pflicht ja/nein
- Menge
- Einheit
- Foto erforderlich ja/nein
- Dokument/Protokoll erforderlich ja/nein
- Notizfeld erlaubt/erforderlich
- Messwertfeld erlaubt/erforderlich
- Mitarbeiterkürzel
- Unterschrift erforderlich ja/nein
- Zeit von/bis optional
- Materialverbrauch optional, aber ohne Preis/Betrag
- Status: offen, erledigt, nicht zutreffend
- Abhängigkeiten zu anderen Punkten
- Sperrgrund, wenn wegen Abhängigkeit blockiert
- Sichtbarkeit/Berechtigung optional je Punkt

### Konkreter Checklisten-Lauf

Ein Lauf ist die tatsächlich verwendete Checkliste an einem Vorgang.

Beispiele:

- Checkliste an einer Werkstattkarte
- Rüstliste an einem Auftrag
- Auftragsvorbereitungs-Checkliste an einem Auftrag
- Kalkulations-Checkliste an einer Kalkulation

Wichtig:

- Beim Erzeugen wird ein Snapshot der Vorlage gespeichert.
- Spätere Vorlagenänderungen verändern alte Läufe nicht automatisch.
- Mitarbeiter dürfen konkrete Läufe ändern, ohne die Vorlage zu ändern.
- Beim Hinzufügen eines neuen Punktes gibt es die Auswahl:
  - nur in diese konkrete Checkliste übernehmen
  - zusätzlich in die Vorlage übernehmen

## 4. Verknüpfungen

Checklisten können hängen an:

- Auftrag
- Werkstattkarte
- Trafo / Asset
- Kunde
- Anfrage
- Kalkulation
- Leistung / Service
- frei ohne Bezug

Technisch bevorzugt:

- `checklist_runs` enthält Kopfdaten.
- `checklist_run_links` verknüpft einen Lauf mit beliebig vielen Objekten.
- Unterstützte Link-Typen z. B. `order`, `workshop_card`, `asset`, `customer`, `inquiry`, `calculation`, `service`.

Eine Werkstattkarte darf mehrere Checklisten haben, z. B.:

- Trafo-Werkstattkarte
- Eingangsprüfung
- Ausgangsprüfung
- Rüstliste
- Fotodokumentation

## 5. Automatische Vorschläge

H-W-O-S soll passende Checklisten automatisch vorschlagen können.

Startlogik:

- Aus Auftrag + Leistung passende Vorlage vorschlagen.
- Aus Werkstattkarte passende `Trafo-Werkstattkarte`-Vorlage vorschlagen.
- Aus Auftragsart passende `Auftragsvorbereitung` vorschlagen.
- Aus Leistungs-/Service-Auswahl passende `Rüstliste` vorschlagen.

Später:

- Asset-Kategorie, Hersteller, Modell, Spannungsebene und Standort berücksichtigen.
- Mehrere Vorlagen kombinieren.
- Vorschlagsgrund anzeigen: „wegen Leistung X“, „wegen Asset-Typ Y“.

## 6. Abhängigkeiten und Sperren

Abhängigkeiten sind harte Gates.

Beispiel:

- `Hochspannungsprüfung` darf erst erledigt werden, wenn `Eingangsprüfung` fertig ist.
- UI zeigt: `Gesperrt: Eingangsprüfung fehlt`.
- API verhindert ebenfalls das Erledigen gesperrter Punkte.

Pflichtpunkte können den nächsten Schritt blockieren.

Beispiele:

- Auftrag darf nicht auf `vorbereitet`, wenn Pflichtpunkte der Auftragsvorbereitung offen sind.
- Werkstattkarte darf nicht auf `fertig`, wenn Pflichtpunkte offen sind.
- Rüstliste darf nicht abgeschlossen werden, wenn Pflichtpunkte offen sind.

## 7. Statusmodell

### Vorlagenstatus

Für Vorlagen reicht im MVP:

- `aktiv`
- `archiviert`

Archivierte Vorlagen:

- bleiben für alte Läufe sichtbar
- können nicht mehr neu ausgewählt werden
- können später reaktiviert werden, wenn gewünscht

### Laufstatus

Für konkrete Checklisten-Läufe:

- `offen`
- `in Arbeit`
- `fertig`
- `geprüft` optional
- `archiviert`

Der Laufstatus wird teilweise automatisch aus den Punkten berechnet:

- alle Pflichtpunkte offen → offen
- mindestens ein Punkt erledigt → in Arbeit
- alle Pflichtpunkte erledigt oder nicht zutreffend → fertig möglich

## 8. Prüfung / Freigabe

Eine zusätzliche Prüfung ist **nicht immer nötig**.

Sie wird nur verwendet, wenn die Vorlage oder der Zielprozess es verlangt.

Beispiele, wann Prüfung sinnvoll ist:

- Werkstattkarte vor `fertig` oder `geprüft`
- Auftragsvorbereitung vor Einsatz/Freigabe
- Kalkulations-Checkliste vor Angebotsfreigabe
- Rüstliste vor Ausdruck/Materialbereitstellung, wenn der Betrieb das will

MVP-Regel:

- Vorlage bekommt Option `Prüfung erforderlich`.
- Wenn nein: erledigte Pflichtpunkte reichen.
- Wenn ja: nach erledigten Pflichtpunkten muss Büro/Arbeitsvorbereitung/Meister prüfen.

## 9. Rechte und Sichtbarkeit

Vorlagen erstellen/bearbeiten dürfen:

- Admin
- Büro
- Arbeitsvorbereitung
- Meister

Konkrete Checklisten ausfüllen dürfen:

- alle berechtigten Nutzer

Sichtbarkeit:

- Checklisten können nur für bestimmte Gruppen sichtbar sein.
- Beispiel: Büro-Checkliste ist nur für Büro sichtbar.
- Nutzer können mehreren Gruppen angehören.
- Rechte werden serverseitig geprüft, UI-Ausblenden ist nur Komfort.

Startgruppen:

- Admin
- Büro
- Arbeitsvorbereitung
- Meister
- Gewerblich / Monteur

Startrechte:

- `checklists.templates.view`
- `checklists.templates.edit`
- `checklists.runs.view`
- `checklists.runs.edit`
- `checklists.runs.verify`
- `checklists.admin`

## 10. Papier, Druck und QR

Am Anfang werden Checklisten auf Papier genutzt, daher Druck ist MVP-relevant.

Druckvarianten:

1. **Leer zum Ausfüllen**
   - Kopfdaten
   - Gruppen und Punkte
   - Felder für Haken, Notiz, Zeit, Kürzel, Unterschrift

2. **Aktueller Stand**
   - erledigte Punkte
   - offene Punkte
   - nicht zutreffend
   - Notizen
   - Anhänge-/Fotohinweise
   - Prüffreigabe, falls vorhanden

QR-Code:

- Jede konkrete Checkliste bekommt einen QR-Code.
- QR führt zur digitalen Liste.
- QR ist auf beiden Druckvarianten sichtbar.

## 11. Mobile Ansicht

Monteur-/Werkstattansicht ist reduziert:

- nur eigene/verfügbare Checklisten
- kompakte Punktliste
- abhaken / nicht zutreffend
- Foto hochladen, falls nötig
- Notiz
- Zeit von/bis, wenn Punkt das verlangt
- Unterschrift, wenn Punkt das verlangt
- gesperrte Punkte sichtbar, aber deaktiviert

## 12. Datenmodell-Vorschlag

Neue Tabellen:

### `checklist_templates`

- `id`
- `name`
- `description`
- `template_type`
- `status` (`active`, `archived`)
- `visibility_group_keys`
- `verification_required`
- `auto_apply_rules` JSONB
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### `checklist_template_groups`

- `id`
- `template_id`
- `title`
- `sort_order`
- `visibility_group_keys`

### `checklist_template_items`

- `id`
- `template_id`
- `group_id`
- `title`
- `description`
- `sort_order`
- `required`
- `quantity`
- `unit`
- `photo_required`
- `document_required`
- `note_mode` (`none`, `optional`, `required`)
- `measurement_mode` (`none`, `optional`, `required`)
- `employee_code_required`
- `signature_required`
- `time_required`
- `material_entry_enabled`
- `visibility_group_keys`
- `depends_on_item_ids`

### `checklist_runs`

- `id`
- `template_id`
- `template_snapshot` JSONB
- `title`
- `run_type`
- `status`
- `verification_required`
- `verified_by`
- `verified_at`
- `qr_code_token`
- `created_by`
- `created_at`
- `updated_at`

### `checklist_run_links`

- `id`
- `run_id`
- `target_type`
- `target_id`

### `checklist_run_items`

- `id`
- `run_id`
- `template_item_id`
- `group_title_snapshot`
- `title`
- `description`
- `sort_order`
- `required`
- `status` (`open`, `done`, `not_applicable`, `blocked`)
- `quantity`
- `unit`
- `note`
- `measurement_value`
- `employee_code`
- `signature_name`
- `started_at`
- `finished_at`
- `completed_at`
- `completed_by`
- `blocked_reason`

Anhänge/Fotos können später an vorhandene Attachment-Strukturen oder eine eigene Tabelle `checklist_run_attachments` angebunden werden.

## 13. Umsetzung in Phasen

### Phase 1: Datenmodell und Domain-Logik

Ziel: Checklisten können als Vorlage und Lauf sauber modelliert werden.

Zu prüfen/ändern:

- `migrations/010_checklists.sql`
- `src/app/lib/repository.ts`
- `src/app/context/AppStoreContext.tsx`
- neue Domain-Module unter `src/app/features/checklists/domain/`

Tests zuerst:

- Vorlage kann archiviert werden und bleibt für alte Läufe erhalten.
- Lauf wird als Snapshot erzeugt.
- Abhängigkeiten blockieren Punkte hart.
- Pflichtpunkte bestimmen, ob ein Lauf fertig sein darf.
- Keine Preis-/Betragsfelder im Checklistenmodell.

### Phase 2: Stammdaten-UI

Ziel: Vorlagen unter Stammdaten pflegen.

Zu prüfen/ändern:

- `src/app/components/Sidebar.tsx`
- `src/app/routes.tsx`
- `src/app/features/checklists/pages/ChecklistTemplatesPage.tsx`
- `src/app/features/checklists/pages/ChecklistTemplateEditorPage.tsx`

Funktionen:

- Liste aktiver/archivierter Vorlagen
- neue Vorlage erstellen
- Vorlage bearbeiten
- Gruppen verwalten
- Punkte verwalten
- Sichtbarkeit setzen
- Pflicht/Fotos/Dokumente/Abhängigkeiten setzen
- Vorlage archivieren

### Phase 3: Konkrete Checklisten-Läufe

Ziel: Aus Vorlagen konkrete Checklisten erzeugen und bearbeiten.

Zu prüfen/ändern:

- `src/app/features/checklists/pages/ChecklistRunPage.tsx`
- `src/app/features/checklists/domain/createChecklistRun.ts`
- Integrationspunkte in Werkstattkarten, Aufträge/Kalkulationen später schrittweise

Funktionen:

- Vorlage auswählen und Lauf erzeugen
- Lauf an Zielobjekt hängen
- Punkte einzeln erledigen
- `nicht zutreffend` setzen
- Pflicht-/Abhängigkeitsregeln erzwingen
- manuelle Punkte hinzufügen
- Punkt optional in Vorlage übernehmen

### Phase 4: Rüstlisten und automatische Vorschläge

Ziel: Rüstlisten als Checklisten-Typ nutzbar machen.

Funktionen:

- Rüstlisten-Vorlagen pflegen
- Gruppen Werkzeug, Messgeräte, PSA, Dokumente, Material/Ersatzteile, Fahrzeug/Transport, Fotos/Nachweise
- automatische Vorschläge aus Auftrag + Leistung
- später Asset-/Typ-bezogene Regeln

### Phase 5: Druck und QR

Ziel: Papiernutzung sauber unterstützen.

Funktionen:

- Druck leer
- Druck aktueller Stand
- QR-Code pro Lauf
- kompakte Druckansicht mit Kopfdaten, Gruppen, Punkten, Notiz-/Unterschriftsfeldern

### Phase 6: Rechte und Prüfung

Ziel: Sichtbarkeit und Freigabe sauber absichern.

Funktionen:

- Gruppen-/Rechtefilter serverseitig
- Büro-only Checklisten
- alle berechtigten Nutzer dürfen Läufe ausfüllen
- nur Admin/Büro/Arbeitsvorbereitung/Meister dürfen Vorlagen bearbeiten
- optionale Prüfung/Freigabe je Vorlage

## 14. Seed-Vorlagen für MVP

### Trafo-Werkstattkarte

Gruppen:

- Eingangsprüfung
- Sichtprüfung
- Elektrische Prüfung
- Hochspannungsprüfung
- Ausgangsprüfung
- Reinigung
- Ölprobe
- Fotodokumentation

### Auftragsvorbereitung

Gruppen:

- Kundendaten / Auftrag
- Technische Daten
- Unterlagen
- Termin / Zugang
- Material / Vorbereitung
- Freigabe

### Rüstliste

Gruppen:

- Werkzeug
- Messgeräte
- PSA
- Dokumente
- Material / Ersatzteile
- Fahrzeug / Transport
- Fotos / Nachweise

## 15. Akzeptanzkriterien

- Unter `Stammdaten` gibt es `Checklisten`.
- Admin, Büro, Arbeitsvorbereitung und Meister können Vorlagen pflegen.
- Eine Vorlage kann aktiv oder archiviert sein.
- Archivierte Vorlagen sind nicht mehr neu auswählbar, alte Läufe bleiben erhalten.
- Vorlagen haben Gruppen und einzeln abhakbare Punkte.
- Punkte können Pflicht, Foto-pflichtig, Dokument-pflichtig, messwertpflichtig, unterschriftspflichtig oder zeitpflichtig sein.
- Punkte können `nicht zutreffend` gesetzt werden.
- Abhängigkeiten sperren Folgepunkte hart.
- Konkrete Checklisten können an Werkstattkarte, Auftrag, Trafo/Asset, Kunde, Anfrage, Kalkulation, Leistung oder frei hängen.
- Eine Werkstattkarte kann mehrere Checklisten haben.
- Rüstlisten werden als Checklisten-Typ aus Vorlagen erzeugt.
- H-W-O-S kann aus Auftrag/Leistung passende Rüstlisten vorschlagen.
- Konkrete Checklisten können geändert werden, ohne die Vorlage zu ändern.
- Neue Punkte können optional in die Vorlage übernommen werden.
- Es gibt keine Preis-/Betragsfelder in Checklisten.
- Büro-only Checklisten sind nur für berechtigte Gruppen sichtbar.
- Alle berechtigten Nutzer können konkrete Checklisten ausfüllen.
- Druck leer und Druck aktueller Stand sind möglich.
- Jede konkrete Checkliste hat einen QR-Code zur digitalen Ansicht.

## 16. Offene Punkte vor Umsetzung

Diese Punkte müssen nicht vor dem Plan entschieden werden, aber vor dem Coding:

- Soll der Menüpunkt exakt `Checklisten` oder `Checklisten-Vorlagen` heißen?
- Welche Nutzer-/Gruppenstruktur existiert im aktuellen H-W-O-S-Code bereits wirklich?
- Welche Zielobjekte werden in Phase 1 direkt angebunden: nur Werkstattkarten oder auch Auftrag/Kalkulation?
- Welche Felder sollen auf dem Papierdruck in welcher Reihenfolge erscheinen?
- Soll `geprüft` im MVP aktiv genutzt werden oder erst später?
