---
id: arbeitsvorbereitung-trafo-werkstattkarten
title: "Arbeitsvorbereitung: Trafo-Werkstattkarten"
status: geplant
priority: high
created: 2026-06-03
updated: 2026-06-03
---

# Arbeitsvorbereitung: Trafo-Werkstattkarten

> **For Hermes:** Nichts implementieren ohne Freigabe. Erst mit Nutzer abgleichen, danach TDD-Umsetzung in HWERP.

**Goal:** HWERP bekommt den Oberpunkt **Arbeitsvorbereitung**. Darunter startet als erstes eigenständiges Modul **Trafo-Werkstattkarten**: Auftragskarte, Checkliste, Zeitnachweis, Foto-/Prüfprotokoll-Doku und Druckkarte für Trafos in der Werkstatt.

**Architecture:** Das Modul ist zuerst vollständig in H-W-O-S geplant und umgesetzt. Das spätere Werkstatt-/Begleitkarten-Zusatzmodul wird nur ein schlanker Zugriff auf dieselben H-W-O-S-Daten und Prozesse. H-W-O-S kann Karten anlegen, Daten ziehen und später Daten zurückübernehmen. Konflikte werden nicht automatisch überschrieben, sondern per Auswahl gelöst.

**Tech Stack:** bestehendes HWERP React/Vite + Repository/API-Struktur; später PWA-/Tablet-taugliche UI, QR-Code und PDF/Druckansicht.

---

## Namens- und Navigationsentscheidung

- Oberpunkt im HWERP: **Arbeitsvorbereitung**.
- Erstes Untermodul: **Trafo-Werkstattkarten**.
- Nicht als Oberpunkt verwenden: „Trafo-Begleitkarten“.
- Später unter Arbeitsvorbereitung zusätzlich möglich:
  - Leistungsschalter-Werkstattkarten
  - Leistungsschalter-vor-Ort-Karten
  - weitere vorbereitende Auftrags-/Werkstattkartenprozesse
- **Rüstlisten bleiben unter Stammdaten → Checklisten** als Vorlagentyp und werden in Arbeitsvorbereitung nur als konkrete Checklisten-Läufe verwendet.

## Zweck der Trafo-Werkstattkarte

Eine Werkstattkarte beschreibt, was mit einem eingehenden Trafo in der Werkstatt passieren soll:

- welcher Auftrag und welcher Trafo betroffen sind
- welche Arbeiten/Leistungen auszuführen sind
- welche Arbeiten durch Bedingungen gesperrt/freigegeben sind
- wer welche Leistung erledigt hat
- von wann bis wann gearbeitet wurde
- welche Fotos/Protokolle/Anhänge hochgeladen wurden
- welche optionalen Notizen, Messwerte und Materialverbräuche erfasst wurden
- ob die Leistung unterschrieben wurde
- wie viel Gesamtzeit auf der Karte angefallen ist

## Entstehung und Suche

### Karte entsteht aus

- **Auftrag + Trafo**.
- Standort ist für spätere andere Kartentypen relevant, bei Trafo-Werkstattkarten aber nicht führend.

### Externes Modul / eigenständige Ansicht

- Suche reicht zunächst über:
  - Seriennummer
  - interne Trafo-Nr.
  - HT-Nr.

### In HWERP integrierte Suche

- breiter suchen über:
  - Seriennummer
  - interne Trafo-/HT-Nr.
  - Hersteller
  - Kunde/Eigentümer
  - Standort

## Automatisch gezogene Trafo-Daten

Aus HWERP sollen, wenn vorhanden, übernommen werden:

- Hersteller
- Seriennummer
- interne Trafo-Nr. / HT-Nr.
- Eigentümer/Kunde
- Standort, falls vorhanden
- Leistung/kVA
- Spannung MS/NS
- Baujahr
- Bauart: Öl / Gießharz / sonstige
- Status/Zustand
- zugehöriger Auftrag

Wenn Daten in Werkstattkarte und HWERP abweichen, fragt das System:

> „Seriennummer wurde geändert. Welche Version übernehmen?“

Keine stille Überschreibung.

## Leistungsvorlagen

Startliste, frei pflegbar:

- Eingangsprüfung
- Sichtprüfung
- elektrische Prüfung
- Hochspannungsprüfung
- Ausgangsprüfung
- Reinigung
- Ölprobe
- Fotodokumentation

Vorlagen müssen später bearbeitbar sein:

- Name
- Kategorie
- Pflicht/optional
- Foto-/Anhangpflicht
- Prüfprotokollpflicht
- Material optional ja/nein
- Messwerte optional/pflicht je Prüfleistung
- Bedingungen/Abhängigkeiten
- Reihenfolge
- Rollen-/Gruppenzuweisung

## Bedingungen und Sperren

- Arbeitsvorbereitung kann Bedingungen definieren.
- Beispiel: Hochspannungsprüfung darf erst nach erledigter Eingangsprüfung starten.
- Gesperrte Folgearbeiten sind **hart gesperrt**, nicht nur gewarnt.
- UI zeigt kurz den Grund, z. B. „Gesperrt: Eingangsprüfung fehlt“.

## Rollen und Ansichten

### Büro / Arbeitsvorbereitung

Desktop-/Tablet-orientiert:

- Karte aus Auftrag + Trafo anlegen
- Trafo suchen und übernehmen
- Leistungen auswählen
- Bedingungen setzen
- Pflichtfelder setzen
- Mitarbeiter zuweisen
- Druck leer oder mit aktuellem Stand erzeugen
- QR-Code erzeugen
- Status verwalten

### Gewerblicher Mitarbeiter

Smartphone-/Tablet-orientiert:

- sieht zunächst nur zugewiesene Werkstattkarten
- sieht nur notwendige Felder
- erledigt Leistungen kompakt
- gibt je Leistung Zeit von/bis ein
- gibt Mitarbeiterkürzel ein/auswählen
- lädt Pflicht-/optionale Fotos hoch
- lädt bei Prüfleistungen Prüfprotokoll-Foto/PDF hoch
- unterschreibt pro Leistung

## Erfassung pro Leistung

Pflicht:

- erledigt ja/nein
- Zeitaufwand über **von/bis**
- ausführender Mitarbeiter / Mitarbeiterkürzel
- Unterschrift pro Leistung
- Pflichtfoto/Prüfprotokoll, wenn Vorlage das verlangt

Optional:

- Fotos
- Notiz
- Messwerte
- Materialverbrauch

Gesamtzeit wird aus den Einzelzeiten der Leistungen automatisch pro Werkstattkarte summiert. Mehrere Mitarbeiter pro Karte sind möglich.

## Fotos und Anhänge

- Fotos können allgemein zur Karte oder gezielt pro Leistung erfasst werden.
- Arbeitsvorbereitung kann je Leistung festlegen, ob Fotos Pflicht sind.
- Prüfleistungen können ein Prüfprotokoll-Foto oder PDF als Pflichtanhang verlangen.
- Später: Galerie/Anhangübersicht je Karte und je Leistung.

## Druck und QR-Code

Druckvarianten:

1. **Leere Arbeitskarte**
   - Auftrag/Trafo-Kopfdaten
   - ausgewählte Leistungen
   - leere Felder für Zeit, Kürzel, Unterschrift, Hinweise

2. **Aktueller digitaler Stand**
   - alle bereits erfassten Leistungen
   - Zeiten
   - Mitarbeiter
   - Status
   - Anhänge/Fotohinweise
   - Unterschriftenstatus

Jede gedruckte Karte bekommt einen QR-Code zur digitalen Karte.

## Statusmodell

- Entwurf
- vorbereitet
- in Arbeit
- fertig
- geprüft
- archiviert

## Rücksync zu HWERP

HWERP soll später alle eingegebenen Daten ziehen können:

- ausgewählte Leistungen
- erledigte Leistungen
- Zeiten
- Fotos/Anhänge
- Prüfprotokolle
- Messwerte
- Materialverbrauch
- Unterschriften
- Status
- Konfliktentscheidungen

## MVP-Schnitt

Phase 1:

- Navigation **Arbeitsvorbereitung** mit Unterpunkt **Trafo-Werkstattkarten**.
- Kartennummer wird beim Anlegen aus dem zentralen Admin-Nummernkreis **Werkstattkarten** gezogen (`workshop-cards`, z.B. `WK-00001-26`) und danach die nächste laufende Nummer erhöht.
- Kartenliste Büroansicht.
- Karte aus Auftrag + Trafo-Dummy/Bestand anlegen.
- Leistungsvorlagen auswählen.
- Mitarbeiter zuweisen.
- Mitarbeiteransicht: nur zugewiesene Karten.
- Leistung erledigen mit von/bis, Kürzel, Unterschrift.
- Pflichtfoto/Prüfprotokoll-Regel pro Leistung.
- Gesamtzeit automatisch berechnen.
- Druckansicht leer + aktueller Stand.
- QR-Code-Platzhalter.

Phase 2:

- echte HWERP-Trafo-Suche und Connector.
- Konfliktlösung beim Datenabgleich.
- Vorlagenverwaltung inkl. Bedingungen.
- Foto-/PDF-Upload dauerhaft.

Phase 3:

- mobile Werkstattansicht innerhalb H-W-O-S.
- Druck/QR so bauen, dass Werkstatt damit direkt arbeiten kann.
- externe Modulansicht erst danach als schlanker Zusatz-Einstieg, unabhängig vom vollen H-W-O-S-Menü, aber mit denselben H-W-O-S-Daten.
- weitere Arbeitsvorbereitungsarten unter demselben Oberpunkt.

## Akzeptanzkriterien

- Nutzer findet im HWERP den Oberpunkt **Arbeitsvorbereitung**.
- Darunter ist **Trafo-Werkstattkarten** als erstes Modul erreichbar.
- Büro kann eine Karte aus Auftrag + Trafo vorbereiten.
- Gewerblicher Mitarbeiter sieht nur zugewiesene Karten.
- Je Leistung können von/bis-Zeit, Kürzel und Unterschrift erfasst werden.
- Gesamtzeit wird korrekt aus Einzelzeiten summiert.
- Gesperrte Leistungen sind nicht ausführbar, solange Bedingungen fehlen.
- Prüfleistung mit Protokollpflicht kann nicht abgeschlossen werden, solange Anhang fehlt.
- Druck leer und Druck mit aktuellem Stand sind unterscheidbar.
- QR-Code ist auf der Druckkarte vorgesehen.

## Noch zu entscheiden vor Umsetzung

- Welche Mitarbeiterkürzel als Seed-Daten starten.
- Welche erste Trafo-Datenquelle im aktuellen HWERP-Code tatsächlich genutzt wird: Assets, Trafo-Lager oder eigener Connector-Endpunkt.
- Ob die externe Modulansicht direkt im selben Build oder als später separater Einstieg umgesetzt wird.
