---
id: hwerp-arbeitsvorbereitung-funktionsumfang
title: "H-W-O-S Arbeitsvorbereitung: kompletter Funktionsumfang in HWERP"
status: geplant
priority: high
created: 2026-06-03
updated: 2026-06-03
---

# H-W-O-S Arbeitsvorbereitung: kompletter Funktionsumfang in HWERP

> **For Hermes:** Planungsentscheidung von Vale: Erst alle Funktionen direkt in H-W-O-S einplanen/umsetzen. Das spätere Zusatzmodul für die Werkstatt kommt danach als separater Einstieg/abgespeckte Oberfläche, nicht als führendes System.

**Goal:** H-W-O-S wird das führende System für Arbeitsvorbereitung, Trafo-Werkstattkarten, Rüstlisten, Checklisten-Läufe, Druck/QR und Rechte. Die Werkstatt-Zusatzlösung nutzt später dieselben Daten und Prozesse, statt eigene Logik zu bekommen.

**Architecture:** Stammdaten liefern Leistungen, Checklisten-Vorlagen, Rüstlisten-Presets und Nummernkreise. Arbeitsvorbereitung erzeugt daraus konkrete Karten/Listen/Läufe an Auftrag, Trafo/Asset, Anfrage, Kalkulation oder Leistung. Rechte und Sichtbarkeit werden serverseitig über Gruppen/Berechtigungen geprüft. Keine Preise/Beträge in Checklisten, Rüstlisten oder Werkstattkarten-Ausführung.

**Tech Stack:** bestehendes H-W-O-S React/Vite + Express API + PostgreSQL + Repository-/Entity-Struktur; spätere Umsetzung per TDD.

---

## 1. Leitentscheidung

- **Alle Funktionen zuerst in H-W-O-S.**
- Das Zusatzmodul „Werkstatt/Begleitkarten“ wird später nur ein schlanker Zugriff für Werkstatt/Mobil/Papier-QR.
- Keine doppelte Datenhaltung im Zusatzmodul.
- H-W-O-S bleibt führend für:
  - Stammdaten
  - Nummernkreise
  - Leistungen
  - Checklisten-Vorlagen
  - konkrete Checklisten-Läufe
  - Rüstlisten
  - Trafo-Werkstattkarten
  - Rechte/Sichtbarkeit
  - Druck/QR
  - Rückmeldungen aus der Werkstatt

## 2. Navigation in H-W-O-S

### Stammdaten

- Leistungen / Serviceleistungen
- Leistungspakete
- Checklisten
- Rüstlisten-Presets, falls nicht direkt als Checklisten-Typ gelöst
- Nummernkreise
- später Gruppen/Berechtigungen

### Arbeitsvorbereitung

Ist im Code bereits als Accordion/Unterpunktbereich vorhanden.

- Trafo-Werkstattkarten
- später optional: Übersicht / Dashboard
- später optional: offene Freigaben / Prüfungen
- später optional: Druck-/QR-Zentrale

**Keine eigene Rüstlisten-Navigation unter Arbeitsvorbereitung planen.** Rüstlisten liegen als Checklisten-Typ unter **Stammdaten → Checklisten** (`Rüstliste` / `packing_list`). Arbeitsvorbereitung nutzt bei Bedarf konkrete Checklisten-Läufe daraus.

## 3. Stammdaten-Funktionen

### Leistungen

- Leistung mit Nummer aus Nummernkreis `Serviceleistungen` (`SL00001`).
- Leistung kann für Werkstattkarten verfügbar sein.
- Werkstattkarten-Kategorie pro Leistung.
- Flags je Leistung:
  - Pflicht/optional
  - Foto erforderlich
  - Prüfprotokoll erforderlich
  - Messwerte erforderlich
  - Materialerfassung erlaubt
  - Sortierung
- Leistungen können später automatisch Aufgaben in Werkstattkarten erzeugen.

### Checklisten-Vorlagen

- Vorlage anlegen/bearbeiten/archivieren.
- Typen zum Start:
  - Trafo-Werkstattkarte
  - Auftragsvorbereitung
  - Rüstliste
  - Kalkulations-/Freigabe-Checkliste später
- Gruppen/Sektionen frei pflegen.
- Punkte frei pflegen:
  - Pflicht/optional
  - Menge/Einheit
  - Foto erforderlich
  - Dokument/Prüfprotokoll erforderlich
  - Notiz optional/pflicht
  - Messwert optional/pflicht
  - Zeit von/bis
  - Mitarbeiterkürzel
  - Unterschrift
  - Materialverbrauch ohne Preis
  - Abhängigkeiten/Sperren
  - Sichtbarkeit je Gruppe/Recht
- Archivierte Vorlagen bleiben für alte Läufe sichtbar, aber nicht neu auswählbar.

### Rüstlisten-Presets

- Presets je Auftragsart, Leistung, Asset-Kategorie, Asset-Typ, Hersteller/Modell später.
- Gruppen:
  - Werkzeug
  - Messgeräte
  - PSA
  - Dokumente
  - Material / Ersatzteile
  - Fahrzeug / Transport
  - Fotos / Nachweise
- Keine Preise/Beträge.
- Manuelle Ergänzung kann nur aktuelle Rüstliste betreffen oder zusätzlich ins Preset übernommen werden.

### Nummernkreise

- Werkstattkarten erhalten Nummer aus zentralem Nummernkreis, z. B. `WK-00001-26`.
- Checklisten-/Rüstlisten-Nummern optional später, falls im Betrieb benötigt.
- Vorschau und nächste Nummer bleiben zentral in Admin/Stammdaten.

## 4. Arbeitsvorbereitung-Dashboard

Ziel: Ein Einstieg für Büro, Arbeitsvorbereitung und Meister.

Funktionen:

- offene Aufträge mit Vorbereitungsbedarf anzeigen
- offene Trafo-Werkstattkarten anzeigen
- offene Rüstlisten anzeigen
- gesperrte Vorgänge anzeigen
- fehlende Pflichtfotos/Prüfprotokolle anzeigen
- fällige Prüf-/Freigabeschritte anzeigen
- Filter nach Status, Kunde, Auftrag, Mitarbeiter, Fälligkeit
- Schnellaktionen:
  - Werkstattkarte anlegen
  - Rüstliste erzeugen
  - Checkliste starten
  - Druck/QR öffnen

## 5. Trafo-Werkstattkarten in H-W-O-S

### Erstellung

- Karte aus **Auftrag + Trafo/Asset** anlegen.
- Suche nach:
  - Seriennummer
  - HT-/interner Trafo-Nr.
  - Hersteller
  - Kunde/Eigentümer
  - Standort
- Datenübernahme aus H-W-O-S:
  - Hersteller
  - Seriennummer
  - HT-/interne Nummer
  - Kunde/Eigentümer
  - Standort
  - kVA
  - Spannung MS/NS
  - Baujahr
  - Bauart Öl/Gießharz
  - Status/Zustand
  - Auftrag
- Konflikte nie still überschreiben; Auswahl anzeigen: H-W-O-S-Wert oder Kartenwert übernehmen.

### Aufgaben / Leistungen

- Aufgaben entstehen aus aktiven Leistungen, die für Werkstattkarten freigegeben sind, und/oder aus Checklisten-Vorlage.
- Startaufgaben:
  - Eingangsprüfung
  - Sichtprüfung
  - elektrische Prüfung
  - Hochspannungsprüfung
  - Ausgangsprüfung
  - Reinigung
  - Ölprobe
  - Fotodokumentation
- Reihenfolge und Pflichtfelder sind konfigurierbar.
- Abhängigkeiten sind harte Sperren, z. B. `Gesperrt: Eingangsprüfung fehlt`.

### Ausführung je Leistung

- erledigt / offen / nicht zutreffend
- Zeit von/bis
- Mitarbeiterkürzel
- Unterschrift je Leistung
- Foto hochladen, wenn erforderlich
- Prüfprotokoll-Foto/PDF, wenn erforderlich
- Notiz
- Messwerte
- Materialverbrauch ohne Preis
- Gesamtzeit wird aus Einzelzeiten summiert
- mehrere Mitarbeiter pro Karte möglich

### Status

- Entwurf
- vorbereitet
- in Arbeit
- fertig
- geprüft
- archiviert

Statuswechsel blockieren, wenn Pflichtpunkte, Fotos, Protokolle, Signaturen oder Abhängigkeiten fehlen.

## 6. Checklisten-Läufe in H-W-O-S

Konkrete Läufe können an mehrere Zielobjekte hängen:

- Auftrag
- Werkstattkarte
- Trafo / Asset
- Kunde
- Anfrage
- Kalkulation
- Leistung / Service
- frei ohne Bezug

Funktionen:

- Lauf aus Vorlage erzeugen
- Snapshot der Vorlage speichern
- Punkte einzeln erledigen
- `nicht zutreffend` setzen
- Pflicht-/Abhängigkeitsregeln erzwingen
- manuellen Punkt hinzufügen
- Entscheidung: nur aktueller Lauf oder zusätzlich Vorlage/Preset aktualisieren
- optional Prüfung/Freigabe, wenn Vorlage das verlangt
- QR-Code pro Lauf
- Druck leer und aktueller Stand

## 7. Rüstlisten in H-W-O-S

Funktionen:

- Rüstliste aus Auftrag/Leistung erzeugen
- passende Presets vorschlagen
- Vorschlagsgrund anzeigen, z. B. `wegen Leistung Ölprobe`
- später Asset-/Typ-/Hersteller-Regeln kombinieren
- manuelle Punkte immer in aktuelle Rüstliste übernehmen
- optional zusätzlich ins Preset übernehmen
- Pflicht-/Optional-Punkte
- Mengen/Einheiten/Stunden/Prüffrist-Hinweise
- keine Preise/Beträge
- Druck/QR wie bei Checklisten

## 8. Auftragsvorbereitung

Funktionen:

- Checkliste aus Auftrag erzeugen
- Gruppen:
  - Kundendaten / Auftrag
  - Technische Daten
  - Unterlagen
  - Termin / Zugang
  - Material / Vorbereitung
  - Freigabe
- blockiert optional Status `vorbereitet`, wenn Pflichtpunkte offen sind
- kann Rüstliste und Werkstattkarte auslösen
- kann aus Anfrage-/Stationsbegehungsdaten vorausgefüllt werden

## 9. Druck, Papier und QR

Für Werkstattkarten, Rüstlisten und Checklisten:

- Druck **leer zum manuellen Ausfüllen**
- Druck **aktueller digitaler Stand**
- QR-Code zurück zum digitalen Objekt
- Kopfdaten, Gruppen, Punkte, Haken, Notizen, Zeit, Kürzel, Unterschrift
- Fotopflicht-/Protokollhinweise sichtbar
- später PDF-Export/Ablage optional

## 10. Mobile/Werkstatt-Ansicht innerhalb H-W-O-S

Noch kein separates Zusatzmodul nötig.

Funktionen im H-W-O-S-MVP:

- mobile kompakte Ansicht für gewerbliche Nutzer
- nur zugewiesene Karten/Listen
- nur notwendige Felder
- große Abhak-/Upload-/Unterschrift-Aktionen
- gesperrte Punkte sichtbar, aber deaktiviert
- QR öffnet direkt den passenden Lauf/die passende Karte

Das spätere Zusatzmodul nutzt genau diese Daten und kann daraus eine noch schlankere Werkstattoberfläche machen.

## 11. Rechte und Sichtbarkeit

Grundmodell:

- Nutzer → Gruppen → Berechtigungen
- Standardgruppen als Seed:
  - Admin
  - Büro
  - Arbeitsvorbereitung
  - Meister
  - Gewerblich / Monteur
  - Preisfreigabe
- Personen können mehreren Gruppen angehören.
- Rechte addieren sich.
- Preis-/Betragssicht ist immer separates Recht.

Relevante Rechte:

- `work_preparation.view`
- `work_preparation.edit`
- `workshop_cards.view`
- `workshop_cards.edit`
- `workshop_cards.execute`
- `workshop_cards.verify`
- `checklists.templates.view`
- `checklists.templates.edit`
- `checklists.runs.view`
- `checklists.runs.edit`
- `checklists.runs.verify`
- `packing_lists.view`
- `packing_lists.edit`
- `amounts.view`

Serverseitige Prüfung ist Pflicht; UI-Ausblenden ist nur Komfort.

## 12. Umsetzung in Phasen

### Phase 1: H-W-O-S Kern zusammenführen

- vorhandene Werkstattkarten-Funktionen sauber auf H-W-O-S-Datenmodell prüfen
- Checklisten-Engine als gemeinsames Fundament fertigstellen
- Stammdaten → Checklisten anbinden
- Arbeitsvorbereitung → Trafo-Werkstattkarten als H-W-O-S-Modul stabilisieren
- Nummernkreis Werkstattkarten nutzen

### Phase 2: Konkrete Läufe und Integrationen

- Checklisten-Läufe an Werkstattkarte/Auftrag/Trafo hängen
- Rüstliste aus Auftrag/Leistung erzeugen
- Auftragsvorbereitungs-Checkliste erzeugen
- Statussperren für Pflichtpunkte/Abhängigkeiten/Fotos/Protokolle

### Phase 3: Druck/QR/Mobil

- Druck leer
- Druck aktueller Stand
- QR-Code zu digitaler Karte/Liste
- mobile Werkstattansicht in H-W-O-S

### Phase 4: Rechte und Freigabe

- Gruppen/Berechtigungsmodell aktivieren
- Sichtbarkeit je Vorlage/Punkt/Lauf
- Prüfung/Freigabe je Vorlage
- Preis-/Betragsrecht separat absichern

### Phase 5: Zusatzmodul Werkstatt später

- erst nach funktionierendem H-W-O-S-Kern
- nutzt H-W-O-S API/Daten
- keine eigene Vorlage-/Rüstlisten-/Nummernkreislogik
- Fokus: sehr einfache Werkstatt-/QR-/Mobiloberfläche

## 13. Akzeptanzkriterien

- Alle Arbeitsvorbereitungsfunktionen sind in H-W-O-S geplant, nicht nur im Zusatzmodul.
- Stammdaten enthalten Checklisten-Vorlagen und ggf. Rüstlisten-Presets.
- Arbeitsvorbereitung enthält Trafo-Werkstattkarten; Rüstlisten bleiben als Checklisten-Typ unter Stammdaten → Checklisten und werden als konkrete Läufe genutzt.
- Werkstattkarten entstehen aus Auftrag + Trafo/Asset.
- Werkstattkarten nutzen Leistungen und/oder Checklisten-Vorlagen.
- Pro Leistung sind Zeit, Kürzel, Unterschrift, Foto-/Protokollpflicht, Notiz, Messwert und Materialverbrauch möglich.
- Checklisten-Läufe sind Snapshots und können an mehrere Objekte hängen.
- Rüstlisten werden aus H-W-O-S-Auftrag/Leistung/Asset-Kontext vorgeschlagen.
- Druck leer, Druck aktueller Stand und QR sind eingeplant.
- Mobile Werkstattansicht ist innerhalb H-W-O-S eingeplant.
- Rechte/Sichtbarkeit sind eingeplant; Preise/Beträge bleiben separat und tauchen in Checklisten/Rüstlisten nicht auf.
- Zusatzmodul Werkstatt ist ausdrücklich spätere Phase und nicht führend.
