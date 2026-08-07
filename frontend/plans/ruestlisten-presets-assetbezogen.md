---
id: ruestlisten-presets-assetbezogen
title: "Rüstlisten-Presets in HWERP"
status: geplant
priority: high
created: 2026-06-01
updated: 2026-06-01
---

# Rüstlisten-Presets in HWERP

> **For Hermes:** Erst planen und mit dem Nutzer abgleichen. Umsetzung später per TDD. HWERP immer als H-W-O-S behandeln.

**Goal:** HWERP erzeugt aus Auftrag, Leistung, Kategorie und verknüpften Assets passende Rüstlisten, damit benötigte Werkzeuge, Messgeräte, PSA, Material und Unterlagen vor Einsatz klar vorbereitet werden können.

**Architecture:** Rüstlisten gehören zunächst direkt in HWERP, nicht primär ins Anfragemodul. Das Anfragemodul liefert nur Kontextdaten in HWERP. HWERP wählt daraus passende Rüstlisten-Vorlagen und kombiniert sie mit asset- oder typbezogenen Regeln.

**Tech Stack:** bestehendes HWERP React/Vite + Express API + PostgreSQL + generische Entity-Struktur.

---

## Leitentscheidung

- HWERP ist das führende System für Rüstlisten.
- Rüstlisten werden aus HWERP heraus erstellt, auch wenn Daten aus Anfragemodul, Stationsbegehung oder manueller HWERP-Erfassung stammen.
- Das Anfragemodul darf Daten liefern, aber die Rüstlistenlogik liegt in HWERP.
- Rüstlisten sind keine Preise/Kalkulationen: Mengen, Stunden, Werkzeuge, Geräte, Unterlagen und Material sind erlaubt; Beträge nicht.
- Sichtbarkeit folgt dem Prinzip: möglichst wenig Informationen anzeigen, wenn sie für die Aufgabe nicht nötig sind.
- Die flexible Rechteverwaltung ist separat geplant in `rechteverwaltung-gruppen-und-berechtigungen.md`; Rüstlisten nutzen später diesen Rechtekern.

## Rollen- und Sichtbarkeitskategorien

Rüstlisten und Checklisten werden fachlich getrennt nach Zuständigkeit:

1. **Kaufmännisch / Büro**
   - sieht kaufmännische Checklistenpunkte und Büro-Aufgaben.
   - kann je nach Berechtigung Beträge/Preisinformationen sehen.
   - Preis-/Betragszugriff ist ein separates Recht, nicht automatisch Teil jeder Büro-Rolle.

2. **Gewerblich / Monteur / Techniker**
   - sieht gewerbliche Rüstlisten, Werkzeuge, Messgeräte, PSA, Material, Nachweise und technische Checklistenpunkte.
   - sieht standardmäßig keine Beträge/Preise.

3. **Arbeitsvorbereitung**
   - eigene Kategorie für vorbereitende Aufgaben vor Einsatz/Auftrag.
   - kann von Büro oder Gewerblich ausgeführt werden.
   - sieht nur die für Vorbereitung nötigen Daten, aber standardmäßig keine Beträge.
   - kann eigene Checklisten/Rüstlistenpunkte haben, z. B. Zugang klären, Unterlagen prüfen, Messgeräte/Prüffristen vorbereiten.

Personen können mehrere Rollen haben, z. B. gewerblich + Arbeitsvorbereitung oder kaufmännisch + Preisfreigabe. Die UI zeigt dann nur die Summe der erlaubten relevanten Bereiche. Beträge erscheinen nur mit explizitem Preis-/Betragsrecht.

## Datenquellen

1. **Manuell in HWERP erstellter Auftrag / Vorgang**
   - Nutzer wählt Kategorie, Leistung, Asset oder Asset-Typ.
   - HWERP schlägt passende Rüstliste vor.

2. **Anfragemodul**
   - liefert Anfrageart, Leistungen, technische Daten, Anhänge, Hinweise und ggf. Asset-Verknüpfung.
   - HWERP erzeugt daraus Rüstlisten-Vorschläge.

3. **Assets in HWERP**
   - Asset-Kategorie, Typ, Hersteller, Modell, Spannungsebene, Standort, technische Daten.
   - Sobald ein Asset gepflegt ist, kann HWERP wissen, welche Rüstlisten typischerweise dazugehören.

4. **Stationsbegehung / spätere Zulieferer**
   - liefern Befunde, Fotos, Protokolle oder Hinweise.
   - gehen über Anfrage-/HWERP-Kontext in die Rüstlistenentscheidung ein.

## Rüstlisten-Presets

Presets sind wiederverwendbare Vorlagen je:

- Auftragskategorie
- Leistung / Tätigkeit
- Sichtbarkeits-/Zuständigkeitskategorie: kaufmännisch, gewerblich oder Arbeitsvorbereitung
- Asset-Kategorie
- Asset-Typ
- optional Hersteller / Modell / Spannungsebene

Beispiele:

- Leistungsschalter Mittelspannung prüfen
- Leistungsschalter Niederspannung prüfen
- Trafo Wartung / Sichtprüfung
- Ölprobe nehmen
- DGUV/VDE-Prüfung
- Stationsbegehung mit Fotodokumentation

## Rüstlisten-Inhalt

Eine Rüstliste kann enthalten:

- Werkzeuge
- Messgeräte inkl. Prüffrist-/Kalibrierhinweis
- PSA
- Verbrauchsmaterial
- Ersatzteile / typische Teile
- Dokumente / Unterlagen
- Fotos / Nachweise, die vor Ort aufgenommen werden müssen
- Sicherheits- und Zugangshinweise
- optionale Positionen
- Pflichtpositionen

## Manuelle Ergänzungen und Vorlagen-Übernahme

- Jede erzeugte Rüstliste/Checkliste ist immer direkt bearbeitbar.
- Nutzer kann einer bereits erzeugten Liste weitere Stichpunkte/Positionen hinzufügen.
- Neue Stichpunkte werden **immer** in die konkrete Rüstliste des aktuellen Auftrags übernommen.
- Zusätzlich gibt es pro neuem Stichpunkt eine Entscheidung:
  - **nur für diese Rüstliste** übernehmen
  - **auch in die Vorlage / das Preset übernehmen**
- Wird ein Punkt in die Vorlage übernommen, erscheint er künftig bei neuen Rüstlisten aus diesem Preset.
- Wird er nicht in die Vorlage übernommen, bleibt er eine einmalige Ergänzung für den aktuellen Auftrag.
- Bei kombinierten Presets muss HWERP anzeigen, in welches Preset der Punkt übernommen würde.
- Änderungen an Vorlagen sollten nachvollziehbar bleiben: wer hat wann welchen Punkt ergänzt.

## Asset-Bezug

Zielbild:

- Asset wird in HWERP angelegt.
- Asset erhält Kategorie und technische Merkmale.
- HWERP verknüpft passende Rüstlisten-Presets.
- Bei Auftrag zu diesem Asset werden Presets automatisch vorgeschlagen.
- Nutzer kann Rüstliste anpassen, ohne das Preset zu verändern.

Beispiel:

- Asset: Leistungsschalter
- Ebene: Mittelspannung
- Typ/Modell bekannt
- HWERP schlägt Rüstliste „Leistungsschalter Mittelspannung“ vor.
- Wenn Typ genauer bekannt ist, kann eine typbezogene Zusatzliste ergänzt werden.

## MVP-Scope

Phase 1:

- Rüstlisten-Preset-Modell planen/anlegen.
- Presets nach Auftragskategorie und Leistung auswählbar machen.
- Presets und Punkte einer Sichtbarkeitskategorie zuordnen: kaufmännisch, gewerblich, Arbeitsvorbereitung.
- Rüstliste aus einem HWERP-Auftrag/Vorgang erzeugen.
- Manuell editierbare Rüstlistenpositionen.
- Ad-hoc-Stichpunkte immer in die aktuelle Rüstliste übernehmen.
- Optionaler Schalter: Stichpunkt zusätzlich in die Vorlage / das Preset übernehmen.
- Keine Preise/Beträge.

Phase 2:

- Asset-Kategorie und Asset-Typ als Auswahlkriterium.
- Mehrere Presets kombinieren.
- Pflicht-/Optional-Markierungen.
- Rollenfilter in UI/API: Nutzer sehen nur kaufmännisch, gewerblich oder Arbeitsvorbereitung gemäß Rollen.
- Preis-/Betragssicht als separates Recht absichern, nicht an Arbeitsvorbereitung koppeln.

Phase 3:

- Automatischer Vorschlag aus Anfragemodul-Daten.
- Vorschlagsbegründung: „wegen Leistung X / Asset-Typ Y“.

Phase 4:

- Typ-/Hersteller-/Modell-spezifische Zusatzlisten.
- Rückkopplung aus echten Einsätzen: fehlte etwas, wurde etwas nie gebraucht?

## Offene Modellfragen

- Heißt das Objekt im UI „Rüstliste“, „Packliste“, „Einsatzvorbereitung“ oder kombiniert?
- Wird eine Rüstliste immer an Auftrag/Vorgang gebunden oder auch direkt an Asset/Wartungsplan?
- Welche ersten 5 Presets sollen als Seed-Daten starten?
- Welche konkreten Berechtigungsnamen bekommen kaufmännisch, gewerblich, Arbeitsvorbereitung und Preis-/Betragssicht?

## Akzeptanzkriterien

- Eine Rüstliste kann in HWERP aus Auftrag/Leistung erstellt werden.
- Presets können pro Auftragskategorie gepflegt werden.
- Nutzer kann einer vorhandenen Rüstliste Stichpunkte hinzufügen.
- Neue Stichpunkte landen immer in der aktuellen Rüstliste.
- Nutzer kann je Stichpunkt entscheiden, ob er zusätzlich dauerhaft ins Preset übernommen wird.
- Rüstlisten-/Checklistenpunkte sind einer Kategorie zugeordnet: kaufmännisch, gewerblich oder Arbeitsvorbereitung.
- Nutzer sehen standardmäßig nur die Kategorien, für die sie berechtigt sind.
- Arbeitsvorbereitung sieht standardmäßig keine Beträge.
- Beträge/Preise erscheinen nur bei explizitem Preis-/Betragsrecht.
- Asset-Bezug ist vorbereitet.
- Keine Preisfelder oder Beträge im Rüstlistenbereich.
- Aus dem Anfragemodul kommende Daten können später Vorschläge auslösen, ohne die Logik aus HWERP herauszulösen.
