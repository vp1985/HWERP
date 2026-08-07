---
id: rechteverwaltung-gruppen-und-berechtigungen
title: "H-W-O-S Rechteverwaltung: Gruppen und Berechtigungen"
status: eingeplant
priority: high
created: 2026-06-01
updated: 2026-06-01
---

# H-W-O-S Rechteverwaltung: Gruppen und Berechtigungen

> **For Hermes:** Erst planen und mit dem Nutzer abgleichen. Umsetzung später per TDD. H-W-O-S ist das Handwerker-Operation-System. Keine Preis-/Betragssicht aus Rollen ableiten; immer separates Recht.

**Goal:** H-W-O-S bekommt eine flexible Rechteverwaltung, in der Admins eigene Gruppen anlegen und diesen Gruppen konkrete Berechtigungen geben können.

**Architecture:** Statt harte Rollen wie „Büro“, „Gewerblich“ oder „Arbeitsvorbereitung“ direkt im Code zu verdrahten, bekommt H-W-O-S ein RBAC-Modell: Nutzer → Gruppen → Berechtigungen. Fachliche Standardgruppen werden als Presets/Seed-Daten angelegt, können aber geändert oder ergänzt werden. Preis-/Betragssicht bleibt ein eigenes, explizites Recht.

**Tech Stack:** bestehendes H-W-O-S React/Vite + Express API + PostgreSQL + serverseitige Permission-Checks.

---

## Entscheidung

**Eingeplant am 2026-06-01:** Der gestufte Ansatz ist bestätigt: Rechtekern jetzt vorbereiten, vollständige freie Gruppen-/Rechte-Admin-UI als spätere Ausbaustufe.

Ja, das kriegen wir hin.

Aber: Das ist **größer als MVP**. Sinnvoll ist deshalb ein gestuftes Vorgehen:

1. **MVP jetzt nicht blockieren:** einfache Standardgruppen und Rechte vorbereiten.
2. **Datenmodell direkt richtig anlegen:** Gruppen/Berechtigungen so modellieren, dass später freie Gruppenverwaltung möglich ist.
3. **Admin-UI später ausbauen:** Gruppen anlegen, Rechte setzen, Nutzer zuordnen.

So bauen wir nicht zweimal, aber überladen das erste Rüstlisten-MVP nicht.

## Grundprinzipien

- Möglichst wenig anzeigen: Nutzer sehen nur, was sie für ihre Aufgabe brauchen.
- Gruppen sind frei anlegbar.
- Berechtigungen sind fein genug, aber nicht unnötig kompliziert.
- Eine Person kann mehreren Gruppen angehören.
- Rechte addieren sich.
- Preis-/Betragssicht ist **immer separat**.
- UI-Ausblenden reicht nicht: API/Server muss dieselben Rechte prüfen.
- Änderungen an Gruppen/Rechten werden protokolliert.

## Kernmodell

### `users`

Bestehende oder zukünftige H-W-O-S-Nutzer.

### `permission_groups`

Freie Gruppen, z. B.:

- Büro
- Gewerblich
- Arbeitsvorbereitung
- Preisfreigabe
- Admin
- Externe Monteure
- Azubi / eingeschränkt

Felder:

- `id`
- `name`
- `description`
- `systemKey` optional für Standardgruppen
- `active`
- `createdAt`
- `updatedAt`

### `permissions`

Konkrete Rechte, z. B.:

- `inquiries.view_own`
- `inquiries.view_all`
- `inquiries.assign`
- `checklists.view_commercial`
- `checklists.view_field`
- `checklists.view_preparation`
- `checklists.edit_run`
- `checklists.edit_template`
- `packing_lists.view_field`
- `packing_lists.view_preparation`
- `packing_lists.edit_run`
- `packing_lists.edit_template`
- `assets.view`
- `assets.edit`
- `calculations.view_without_amounts`
- `amounts.view`
- `amounts.edit`
- `admin.manage_users`
- `admin.manage_permissions`

### `group_permissions`

Ordnet Gruppen Berechtigungen zu.

### `user_groups`

Ordnet Nutzer Gruppen zu.

## Standardgruppen als Startpunkt

### Büro / kaufmännisch

Typisch:

- kaufmännische Checklisten sehen
- Anfragen bearbeiten
- ggf. Büro-Aufgaben in Arbeitsvorbereitung sehen
- **keine Beträge automatisch**

Preisrechte nur, wenn zusätzlich gesetzt:

- `amounts.view`
- `amounts.edit`

### Gewerblich / Monteur / Techniker

Typisch:

- gewerbliche Rüstlisten sehen
- technische Checklisten sehen
- Nachweise/Fotos/Serviceberichte bearbeiten
- keine Beträge

### Arbeitsvorbereitung

Kann von Büro oder Gewerblich gemacht werden.

Typisch:

- Vorbereitungs-Checklisten sehen
- Vorbereitungs-Rüstlisten sehen
- Unterlagen, Zugang, Messgeräte, Termine, Materialbedarf vorbereiten
- keine Beträge

### Preisfreigabe / Kalkulation

Separat:

- Beträge sehen
- Beträge bearbeiten
- Kalkulation freigeben

### Admin

- Nutzer verwalten
- Gruppen verwalten
- Rechte verwalten

## Auswirkungen auf Rüstlisten und Checklisten

Jeder Punkt bekommt optional eine Sichtbarkeits-/Zuständigkeitskategorie:

- kaufmännisch
- gewerblich
- Arbeitsvorbereitung

Zusätzlich kann jeder Punkt spezielle Berechtigungen verlangen, z. B.:

- `amounts.view`
- `packing_lists.edit_template`
- `checklists.edit_template`

Beispiel:

- Punkt: „Messgerät mit gültiger Prüffrist einpacken“
  - Kategorie: Arbeitsvorbereitung oder gewerblich
  - kein Preisrecht nötig

- Punkt: „Materialposition kaufmännisch prüfen“
  - Kategorie: kaufmännisch
  - Preisrecht nur, wenn Beträge angezeigt werden

## MVP-Schnitt

Für das Rüstlisten-MVP nicht die komplette Admin-UI bauen.

Stattdessen:

1. Permission-Datenmodell vorbereiten.
2. Standardgruppen als Seed-Daten anlegen.
3. Server-Helper `hasPermission(user, permission)` bauen.
4. Rüstlisten-/Checklistenpunkte nach Kategorie und Berechtigung filtern.
5. Preis-/Betragsrechte strikt getrennt halten.

## Spätere Ausbaustufe

Admin-UI:

- Gruppen anlegen
- Gruppen umbenennen/deaktivieren
- Berechtigungen per Checkbox setzen
- Nutzer Gruppen zuordnen
- Rechte-Vorschau: „Was sieht dieser Nutzer?“
- Audit: wer hat welche Rechte geändert?

## Umsetzung in Phasen

### Phase 1: Rechtekern vorbereiten

- Tabellen/Entities für Gruppen, Berechtigungen, Gruppenzuordnung.
- Permission-Helper serverseitig.
- Seed-Gruppen: Büro, Gewerblich, Arbeitsvorbereitung, Preisfreigabe, Admin.
- Tests: Rechte addieren sich über Gruppen; Preisrecht ist separat.

### Phase 2: Rüstlisten/Checklisten anbinden

- Punkte bekommen Kategorie und optional benötigte Berechtigung.
- API filtert Punkte nach Nutzerrechten.
- UI zeigt nur erlaubte Bereiche.
- Tests: Arbeitsvorbereitung sieht keine Beträge; Gewerblich sieht keine kaufmännischen Punkte.

### Phase 3: Admin-UI minimal

- Nutzer Gruppen zuordnen.
- Gruppenrechte ansehen.
- Noch keine komplett freie Rechte-Matrix nötig.

### Phase 4: Vollständige Gruppenverwaltung

- Gruppen frei anlegen.
- Rechte frei setzen.
- Audit-Log.
- Vorschau/Simulation pro Nutzer.

## Akzeptanzkriterien

- Nutzer können mehreren Gruppen angehören.
- Gruppen bestehen aus konkreten Berechtigungen.
- Rechte addieren sich nachvollziehbar.
- Preis-/Betragssicht ist nur mit explizitem Recht möglich.
- Arbeitsvorbereitung kann ohne Preiszugriff funktionieren.
- Rüstlisten und Checklisten nutzen dieselbe Rechtebasis.
- MVP bleibt klein genug: erst Rechtekern, freie Admin-Verwaltung später.
