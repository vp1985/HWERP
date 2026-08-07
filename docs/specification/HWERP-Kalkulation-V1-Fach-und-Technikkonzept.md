# HWERP Kalkulation – Fach- und Technikkonzept V1

## 1. Dokumentstatus

Dieses Dokument konsolidiert die im Anforderungsinterview bis einschließlich Frage 152 getroffenen Entscheidungen. Spätere Korrekturen haben frühere Antworten ersetzt.

Status: fachliche V1-Zieldefinition
Umsetzungsstatus: noch nicht implementiert
Technische Detailprüfung im Zielsystem: vor Entwicklungsbeginn erforderlich

Entscheidungsprovenienz:

- Die fachlichen Aussagen aus dem Interview sind verbindliche Festlegungen.
- Ein nachgelagerter unabhängiger Qualitätsreview hat zuvor nicht determinierte technische und sicherheitsrelevante Details offengelegt. Die daraufhin ergänzten Regeln zu Company-/Kundengrenzen, Rechenreihenfolge und Rundung, Rechteprüfung, Idempotenz, Belegallokation, Reservierungslebenszyklus, Herkunftssnapshots, Browserentwurf sowie Qualitätsbudgets sind normative V1-Umsetzungsstandards, aber keine nachträglich erfundenen Interviewantworten.
- Zielversionsabhängige Aussagen sind ausdrücklich als Go/No-Go-Prüfung gekennzeichnet. Schlägt eine solche Prüfung fehl, wird keine Ersatzfachlichkeit still angenommen.
- Die normativen Umsetzungsstandards werden bei der Entwicklungsfreigabe gemeinsam mit den Akzeptanzkriterien bestätigt; hierfür ist kein erneutes allgemeines Fachinterview nötig.

## 2. Zielbild

HWERP ist die primäre tägliche Arbeitsoberfläche für Kalkulation, Assets, Material, Angebote und die dazugehörigen operativen Abläufe. Die reguläre ERPNext-Oberfläche wird im Tagesgeschäft hauptsächlich für Administration, Buchhaltung, spezialisierte Standardprozesse und seltene Ausnahmefälle benötigt.

ERPNext/Frappe bleibt trotzdem das allein führende System:

- Alle verbindlichen Standard- und HWERP-Fachdaten werden in ERPNext/Frappe gespeichert.
- Standardobjekte werden nicht in einer zweiten HWERP-Datenbank gespiegelt.
- HWERP verwendet die bestehenden ERPNext-Benutzer, Rollen und Berechtigungen.
- Die bestehende React-Oberfläche kann als eigenständige HWERP-Anwendungsschale erhalten bleiben.
- HWERP-spezifische Fachlogik wird in einer eigenen, versionierten Frappe-App umgesetzt.
- ERPNext-Core-Dateien werden nicht verändert.

Vereinfachte Zielarchitektur:

```text
HWERP React-Oberfläche
        |
        | abgesicherte, gebündelte Frappe-APIs
        v
eigene Frappe-App „HWERP“
        |
        v
ERPNext/Frappe-Datenbank als einzige verbindliche Datenquelle
```

Ein eventuell verbleibender Express-Dienst darf höchstens als zustandsloser technischer Vermittler dienen. Er darf keine zweite führende Geschäftslogik oder Geschäftsdatenbank betreiben.

## 3. V1-Geltungsbereich

V1 umfasst Verkaufskalkulationen für:

- Transformatoren und andere technische Geräte,
- ERPNext-Items und Leistungen,
- eigene ERPNext-Assets,
- kundeneigene Assets bzw. technische Anlagen,
- Mietassets und externe Mietmittel,
- frei beschriebene technische Hauptobjekte,
- projekt- bzw. dienstleistungsbezogene Kalkulationen ohne konkretes Hauptobjekt.

Eine Kalkulation darf mehrere Hauptobjekte enthalten. Positionen können einem Hauptobjekt zugeordnet oder als allgemeine, objektunabhängige Position geführt werden.

Jede operative Kalkulation gehört genau einem ERPNext-Kunden. Eine Kalkulation darf nur in Angebote dieses Kunden übertragen werden. Kundenneutrale Wiederverwendung erfolgt über Kalkulationsvorlagen; für einen anderen Kunden wird eine neue Kalkulation durch Duplizieren erzeugt.

Ein ERPNext-Projekt kann optional verknüpft werden. Es ist keine Voraussetzung für eine Kalkulation.

## 4. Nicht Bestandteil von V1

Nicht verpflichtend bzw. ausdrücklich zurückgestellt sind:

- eine eigenständige Einkaufskalkulationsart,
- eine vollständige Nachkalkulation mit tatsächlichen Arbeitszeiten und realen Personalkosten,
- interne Arbeitskostensätze,
- eine automatische Erzeugung von Supplier Quotations, Purchase Orders oder Purchase Invoices,
- Lieferantengutschriften in der Ist-Kostenbetrachtung,
- Fremdwährungen und Wechselkurslogik,
- Bruttokalkulation bzw. Umsatzsteuerberechnung innerhalb der Kalkulation,
- ERPNext-Kostenstellen in Kalkulationspositionen,
- eine zentrale Kalender-/Dispositionsansicht für alle Asset-Belegungen,
- eine vollständige Offline-Synchronisation,
- vollständige Smartphone- und Tablet-Optimierung,
- Excel-/CSV-Export als Pflichtfunktion,
- eine Übernahme der Test-/Demodaten von hwos.ht-v.de,
- ein automatisches Aktualisieren bestehender Angebote aus geänderten Kalkulationen,
- automatisches Erzeugen eines ERPNext-Items aus jeder Freitextposition.

V1 enthält jedoch eine abgegrenzte Einkaufs- und Nachkalkulationssicht für verknüpfte Fremdleistungen: kalkulierter, beauftragter und tatsächlich abgerechneter Nettowert werden getrennt verglichen. Das ist keine vollständige Nachkalkulation aller Kostenarten.

## 5. Bedienoberfläche und Design

### 5.1 Visuelle Grundlage

Die bestehende Gestaltung von hwos.ht-v.de bleibt die verbindliche visuelle Grundlage. Beibehalten werden insbesondere:

- dunkle linke Seitenleiste,
- weiße Arbeitsfläche,
- Karten und Tabellen,
- vorhandene Akzentfarben,
- bestehende HWERP-Anwendungsschale und Sprache.

Die zwischenzeitlich betrachtete Lexoffice-nahe Neugestaltung ist verworfen. Verbesserungen erfolgen schrittweise und konsistent, nicht als vollständiger visueller Neustart.

### 5.2 Gerätepriorität

V1 ist desktop-first. Tablets und Smartphones sollen Inhalte grundsätzlich lesbar darstellen, erhalten aber nur eingeschränkte Unterstützung.

### 5.3 Bedienprinzipien

- Kalkulationspositionen und Hauptobjekte werden strukturiert und bei Bedarf per Drag-and-drop angeordnet.
- Preisinformationen werden abhängig von den serverseitigen Rechten vollständig angezeigt oder vollständig maskiert.
- Warnungen müssen den fachlichen Grund sowie direkte Links zu betroffenen Datensätzen anzeigen.
- ERPNext-Bezeichnungen werden in HWERP in verständlicher deutscher Fachsprache dargestellt.
- ERPNext-Standardbildschirme sollen im normalen HWERP-Tagesablauf nicht erforderlich sein.

### 5.4 Messbare V1-Qualitätsgrenzen

- Unterstützte Desktopbasis: aktuelle und vorherige stabile Chrome-/Edge-Version ab 1366×768.
- Tabletansichten ab 768 px bleiben lesbar; komplexe Bearbeitungsfunktionen dürfen eingeschränkt sein.
- Der Lastreferenzfall umfasst 20 Hauptobjekte, 500 Positionen und 20 parallele Nutzer.
- Konkrete p95-Zeitbudgets, visuelle Referenzseiten und Staging-Bedingungen stehen verbindlich in den Akzeptanzkriterien 39 und 40.

## 6. Führende ERPNext- und Frappe-Objekte

Bestehende ERPNext-Objekte bleiben für ihre Standardaufgabe führend:

| Fachbereich | Führendes Standardobjekt |
|---|---|
| Kunden | `Customer` |
| Lieferanten/Vermieter | `Supplier` |
| Material und Leistungen | `Item` |
| Einkaufs-/Verkaufspreise | `Item Price`, `Price List` |
| kunden-/mengenbezogene Preislogik | `Pricing Rule` |
| eigene Anlagegüter/Betriebsmittel | `Asset` |
| Projekte | `Project` |
| Angebote | `Quotation`, `Quotation Item` |
| Kundenaufträge | `Sales Order`, `Sales Order Item` |
| Lieferantenangebote | `Supplier Quotation` |
| Bestellungen | `Purchase Order` |
| Eingangsrechnungen | `Purchase Invoice` |
| Benutzer und Rollen | `User`, `Role`, Berechtigungen |
| Anhänge | `File` |
| Aufgaben und Hinweise | `ToDo`, Desk-Benachrichtigung |
| Änderungsverlauf | Frappe Version/Timeline plus HWERP-Auditdaten |

HWERP-spezifische Lebenszyklen werden als eigene DocTypes in derselben Frappe-Datenbank umgesetzt. Voraussichtlich erforderlich sind mindestens:

- `HWERP Kalkulation`,
- `HWERP Kalkulations-Hauptobjekt`,
- `HWERP Kalkulationsposition`,
- `HWERP Kalkulationsvorlage`,
- `HWERP Kalkulations-Preisgruppe`,
- `HWERP Kalkulations-Preis-/Kostenregel`,
- `HWERP Preisvorschlag`,
- `HWERP Asset-Einsatz` bzw. Asset-Planung,
- `HWERP Angebotsvormerkung/Reservierung`,
- ein schlanker HWERP-Stammsatz für ausdrücklich wiederverwendbar gemachte externe Mietmittel,
- strukturierte Preis- und Objektsnapshots,
- eigenständiger `HWERP Angebotstransfer-Snapshot` bzw. gleichwertiger Transfer-/Auditdatensatz, dessen Ursprung nicht mit einer später gelöschten Kalkulation verschwindet.

Die endgültigen DocType-Namen sind ein technisches Detail; die beschriebenen Lebenszyklen und Datenbeziehungen sind fachlich verbindlich.

Der Standard-DocType `Asset` wird nur für eigenes Anlagevermögen verwendet. Kundeneigene technische Anlagen und handelbare Transformatoren bleiben in den dafür vorgesehenen HWERP-Fach-DocTypes innerhalb Frappe und werden nur dann mit einem Standard-`Asset` verknüpft, wenn dessen buchhalterische Bedeutung tatsächlich zutrifft.

## 7. Benutzer, Rollen und Berechtigungen

### 7.1 Anmeldung

HWERP verwendet dieselben Benutzerkonten, Rollen und Berechtigungen wie ERPNext. Es gibt keine separate HWERP-Benutzerverwaltung und keine zweite Anmeldung.

Berechtigungen werden serverseitig an jedem API-Pfad durchgesetzt. Das Ausblenden von Feldern im React-Frontend ist keine ausreichende Zugriffskontrolle.

Die Preisgrenze gilt Ende-zu-Ende: HWERP- und Standard-REST-APIs, Listen, Reports, Druckansichten, `Version`, `Item Price`, Angebote, Einkaufsbelege, Snapshots, Benachrichtigungen und `File`-Downloads dürfen einer Rolle ohne Preisansicht keine Preis- oder ableitbaren Margenwerte liefern. Rollen der Stufe C erhalten deshalb keine direkten Standardrechte auf preisführende DocTypes oder Reports. Ein Vermittlungsdienst arbeitet immer im Kontext des angemeldeten ERPNext-Benutzers und niemals mit einem gemeinsamen privilegierten Servicekonto.

### 7.2 Drei Preisberechtigungsstufen

#### A. Preise sehen und ändern

Diese Nutzer dürfen:

- Kosten-, Einkaufs-, Verkaufs-, Risiko-, Rabatt- und Margenwerte sehen,
- wirksame Preiswerte frei bearbeiten,
- automatisch vorgeschlagene Regeln übersteuern,
- Preise aus ERPNext-Preislisten überschreiben,
- Preisvorschläge übernehmen, anpassen oder ablehnen.

Das dauerhafte Anlegen oder Ändern eines ERPNext-`Item Price` erfordert zusätzlich das getrennte Recht „Preislistenpreise speichern bzw. ändern“.

#### B. Preise sehen

Diese Nutzer dürfen:

- sämtliche Preiswerte lesen,
- eingereichte Preisvorschläge prüfen,
- einen Preisvorschlag im Rahmen der Übernahme anpassen und aktivieren,
- wirksame Preise außerhalb dieses Prüfablaufs nicht frei bearbeiten,
- keine ERPNext-`Item Price`-Datensätze anlegen oder ändern.

#### C. Kalkulieren, ohne Preise zu sehen

Diese Nutzer dürfen:

- Kalkulationen und alle Positionsarten fachlich bearbeiten,
- Mengen, Texte, Termine, Assets und Dokumente pflegen,
- Freitextpositionen anlegen,
- Preisvorschläge zur Prüfung einreichen.

Sie dürfen wirksame Preis-, Kosten-, Risiko-, Rabatt- und Margenwerte weder über UI noch API auslesen. Ein Preisvorschlag wird erst durch Stufe A oder B im definierten Prüfablauf wirksam. Der Einreicher darf den Betrag und Status ausschließlich seines eigenen Vorschlags weitersehen; eine bei der Prüfung vorgenommene Wertänderung und der danach wirksame Preis bleiben verborgen.

### 7.3 Weitere getrennte Rechte

Folgende Rechte werden nicht still aus einem allgemeinen Bearbeitungsrecht abgeleitet:

- Kalkulation bearbeiten,
- Preise sehen,
- Preise sehen und ändern,
- Kalkulation freigeben,
- Kalkulation in Angebot übertragen,
- eingereichtes Angebot kontrolliert ändern,
- vorhandenes Item zuordnen,
- neues Item anlegen bzw. freigeben,
- Preislistenpreise speichern bzw. ändern,
- Preisgruppen und HWERP-Preis-/Kostenregeln verwalten,
- Teilnehmerzugriff verwalten,
- aktive Reservierung manuell aufheben,
- Entwurf löschen,
- administrative Löschung.

Nur Nutzer mit dem separaten Recht „Kalkulation freigeben“ dürfen freigeben oder nach einer fachlich relevanten Änderung den Status `Freigegeben` beibehalten. Nur Nutzer mit dem separaten Recht „Kalkulation in Angebot übertragen“ dürfen eine freigegebene Kalkulation übertragen.

Das Recht zum Stornieren folgt der finalen Fachentscheidung direkt aus „Kalkulation bearbeiten“ und ist daher kein zusätzliches Einzelrecht. Unverknüpfte Entwürfe dürfen nur mit dem getrennten Löschrecht gelöscht werden. Weitergehende physische Löschungen sind Administratoren vorbehalten und unterliegen den Abhängigkeitsregeln in Abschnitt 18.

Verbindliche Aktionsgrenzen:

| Aktion | Erforderliches Recht |
|---|---|
| fachliche Positionen bearbeiten | Kalkulation bearbeiten |
| stornieren | Kalkulation bearbeiten |
| wirksame Preise frei ändern | Preise sehen und ändern |
| Preisvorschlag prüfen/anpassen | Preise sehen oder Preise sehen und ändern |
| nach relevanter Änderung freigegeben lassen | Kalkulation freigeben |
| in Angebot übertragen | Kalkulation in Angebot übertragen |
| eingereichtes Angebot ändern | eingereichtes Angebot kontrolliert ändern |
| vorhandenes Item zuordnen | Kalkulation bearbeiten |
| neues Item anlegen/freigeben | Items anlegen bzw. freigeben |
| `Item Price` speichern/ändern | Preise sehen und ändern plus Preislistenrecht |
| Preisgruppen/Regeln verwalten | Preisgruppen und HWERP-Preis-/Kostenregeln verwalten |
| Teilnehmerliste ändern | Teilnehmerzugriff verwalten oder Administrator |
| aktive Reservierung manuell aufheben | aktive Reservierung manuell aufheben |
| unverknüpften Entwurf löschen | Entwurf löschen |
| weitergehende physische Löschung | Administrator |

### 7.4 Verantwortung und Zusammenarbeit

- Der Ersteller wird standardmäßig als verantwortlicher Kalkulationssachbearbeiter gesetzt.
- Mehrere Sachbearbeiter dürfen an einer Kalkulation bzw. einem Projekt arbeiten.
- Wenn ein ERPNext-Projekt verknüpft ist, wird dessen Projektverantwortlicher vorgeschlagen; der Verantwortliche kann in der Kalkulation berechtigt geändert werden.
- Für Preisvorschläge muss ein gültiger Preisprüfer feststehen: zuerst ein berechtigter Projektverantwortlicher, ersatzweise der berechtigte Kalkulationsverantwortliche, andernfalls der in den HWERP-Einstellungen konfigurierte Standard-Preisprüfer. Ohne berechtigten Empfänger kann kein Preisvorschlag eingereicht werden.
- Beim Einreichen erhält dieser Preisprüfer ein zugewiesenes `ToDo`; dessen Zuweisung erzeugt die ERPNext-Desk-Benachrichtigung. Es werden nicht zwei unabhängige Aufgaben erzeugt.
- Standardmäßig dürfen passende Rollen alle Kalkulationen bearbeiten.
- Für sensible Kalkulationen kann eine Teilnehmerliste den Zugriff zusätzlich einschränken. Diese Einschränkung gilt serverseitig ebenso für Child-DocTypes, Snapshots, Auditdaten, Anhänge, Reports, Druckansichten und API-Zugriffe. Nur ein Nutzer mit „Teilnehmerzugriff verwalten“ oder ein Administrator darf die Teilnehmerliste ändern.

## 8. Kalkulationskopf und Lebenszyklus

### 8.1 Mindestinformationen

Eine operative Kalkulation enthält mindestens:

- eindeutige Kalkulationsnummer,
- genau eine ERPNext-`Company`,
- genau einen ERPNext-Kunden,
- verantwortlichen Sachbearbeiter,
- Status,
- Basiswährung der gewählten Company,
- genau eine Kalkulations-Preisgruppe,
- Erstellungs- und Änderungszeitpunkt,
- optional ERPNext-Projekt,
- optional Notizen und interne Notizen,
- null bis mehrere Hauptobjekte,
- Kalkulationspositionen und Summen,
- Preis-, Regel- und Übertragungssnapshots.

Ein verbindlicher Gültigkeitszeitraum ist für die Kalkulation nicht erforderlich. Gültigkeitsdaten des ERPNext-Angebots bleiben davon getrennt.

Für V1 müssen Kalkulation, eigene Assets, Zielangebot und verknüpfte Einkaufsbelege derselben Company angehören. Verwendete Preislisten und `Item Price`-Datensätze müssen in deren Basiswährung geführt und für diesen Unternehmenskontext gültig sein. Fremdwährungs- oder Cross-Company-Verknüpfungen werden serverseitig abgewiesen. Der Kalkulationskunde ist nach dem ersten Speichern unveränderlich; bei einer falschen Kundenzuordnung wird ein unverknüpfter Entwurf gelöscht oder für den richtigen Kunden neu angelegt. Projekt, kundeneigene Assets und Zielangebot müssen ebenfalls zum Kalkulationskunden passen.

### 8.2 Statuswerte

V1 verwendet als Hauptstatus:

- `Entwurf`,
- `Freigegeben`,
- `Storniert`.

Angebots-, Auftrags-, Einkaufs- und Reservierungsbezüge werden getrennt vom Kalkulationsstatus geführt.
Eine Anforderung „zur Freigabe vorgelegt“ wird als eigener Workflow-/Aufgabenbezug geführt und erzeugt keinen vierten fachlichen Hauptstatus; bis zur Freigabe bleibt die Kalkulation `Entwurf`.

### 8.3 Freigabe und direkte Änderungen

- Nur Nutzer mit separatem Freigaberecht dürfen freigeben.
- Nur freigegebene Kalkulationen dürfen in ERPNext-Angebote übertragen werden.
- Nutzer mit „Kalkulation bearbeiten“ dürfen auch freigegebene Kalkulationen direkt ändern; für Preisfelder und sonstige geschützte Aktionen gelten zusätzlich die Rechte aus Abschnitt 7.3.
- Eine direkte Änderung erzeugt nicht automatisch eine neue Version.
- Nach einer preis- oder mengenrelevanten Änderung darf nur ein Nutzer mit Freigaberecht ausdrücklich entscheiden, dass die Kalkulation `Freigegeben` bleibt. Bei allen anderen Bearbeitern wechselt sie automatisch zu `Entwurf` und erhält eine Freigabeanforderung.
- Für Änderungen ist kein verpflichtender Begründungstext erforderlich.
- Alter Wert, neuer Wert, Nutzer und Zeitpunkt werden automatisch protokolliert.

Als freigaberelevant gelten mindestens Anlegen/Löschen einer preiswirksamen Position sowie Änderungen an Menge, UOM, internem Kostenwert, Verkaufspreis, Rabatt, Risiko, Preisgruppe, Zielmarge oder wirksamer Preisregel. Reine Rechtschreibkorrekturen in internen Notizen lösen keine Rückstufung aus, werden aber ebenfalls auditiert.

### 8.4 Manuelle Versionen

Ein Nutzer kann bewusst eine neue Version als Kopie erzeugen:

- eigenständiger Datensatz mit eindeutiger Identität sowie Vorgänger-/Versionsverknüpfung; das genaue Nummernformat ist eine technische Konfiguration,
- Start als Entwurf,
- alte Version bleibt erhalten,
- Einkaufsverknüpfungen werden nur nach ausdrücklicher Entscheidung übernommen,
- nicht übernommene Verknüpfungen verbleiben an der alten Version.

Vorlagenänderungen werden nicht nachträglich auf bestehende Kalkulationen übertragen. Vorlagen liefern ausschließlich die Startstruktur.

## 9. Hauptobjekte und Positionsstruktur

### 9.1 Unterstützte Hauptobjekte

Eine Kalkulation kann enthalten:

- HWERP-Transformator bzw. anderes HWERP-Technikobjekt,
- ERPNext-Item,
- eigenes ERPNext-Asset,
- kundeneigenes Asset bzw. technische Kundenanlage,
- Mietasset,
- externes Mietmittel,
- vollständig frei beschriebenes technisches Objekt.

Eine Kalkulation darf auch ohne konkretes Hauptobjekt geführt werden, bleibt als operative Kalkulation aber einem Kunden zugeordnet.

### 9.2 Mehrere Hauptobjekte

- Mehrere Hauptobjekte je Kalkulation sind erlaubt.
- Positionen können einem konkreten Hauptobjekt zugeordnet werden.
- Allgemeine Positionen ohne Objektbezug sind erlaubt, beispielsweise Projektleitung, Anfahrt oder Baustelleneinrichtung.
- Verkaufspreise werden aus den einzelnen Kalkulations-/Objektpositionen aufgebaut; für die Darstellung dürfen mehrere davon zu einer Angebotsposition zusammengefasst werden.
- Es gibt keinen separaten Gesamtpreis, der manuell oder automatisch auf Hauptobjekte verteilt wird.
- Der ERPNext-Angebotsgesamtbetrag entsteht stets aus den tatsächlich übertragenen Angebotspositionen.

### 9.3 Kundenassets

Ein Kundenasset dient zunächst als Bezugsobjekt und erzeugt keine automatische Kostenposition. Benötigte Kosten werden bewusst als eigene Positionen ergänzt.

## 10. Unterstützte Positionen und Kostenarten

Alle Positionstypen sind optional; nicht jede Kalkulation muss jede Kostenart enthalten.

V1 unterstützt als getrennte Kostenarten:

- Material,
- Arbeitszeit bzw. Serviceleistungen,
- Fremdleistungen,
- eigene Assets/Maschinen,
- externe Mietassets/Mietmittel,
- Transport,
- Reise- und Übernachtungskosten,
- sonstige Gemeinkosten.

Daneben sind allgemeine Verkaufs-/Dienstleistungspositionen sowie reine Hinweis-/Textpositionen ohne Preiswirkung zulässig. Weitere frei konfigurierbare Kostenarten sind in V1 nicht vorgesehen.

Gewährleistung, Provision/Vermittlung und Finanzierung/Lagerhaltung sind in V1 keine eigenen, fest definierten Kostenarten; falls benötigt, können sie zunächst als passend beschriebene sonstige Gemeinkosten erfasst werden. Risiko wird nicht als normale Kostenposition geführt, sondern ausschließlich über den Risikopuffer der Preislogik in Abschnitt 15.

## 11. Arbeitsleistungen

- Arbeitsleistungen werden als bestehende ERPNext-Service-Items geführt, nicht über konkrete `Employee`-Datensätze.
- Beispiele sind Helfer, Servicetechniker oder Leistungsschaltertechniker.
- In einer Kalkulation dürfen mehrere unterschiedliche Arbeits-Items vorkommen.
- Der Nutzer erfasst die Stundenmenge.
- Der im Item-/Preislistenstamm hinterlegte Stundensatz ist in V1 der vorgeschlagene Verkaufspreis pro Stunde.
- Der verwendete Verkaufssatz wird als Snapshot gespeichert.
- Interne Arbeitskosten werden in V1 nicht geführt.
- Eine aus den Arbeitsleistungen abgeleitete tatsächliche Marge ist deshalb nicht Bestandteil von V1.
- Die Oberfläche muss kenntlich machen, dass eine angezeigte Gesamtmarge interne Arbeitskosten nicht enthält und daher keine vollständige Nachkalkulationsmarge ist.

## 12. Material und Items

### 12.1 Materialpreise

Bei vorhandenen ERPNext-Items gilt:

- Der Einkaufspreis dient als interner Materialkostenwert.
- Der Verkaufspreis aus der zur Preisgruppe gehörenden ERPNext-Preisliste wird als Verkaufspreis vorgeschlagen.
- Aktive ERPNext-`Pricing Rules` werden angewendet und ihr Ergebnis als zusätzlicher Preisvorschlag dargestellt.
- Nur die Rolle „Preise sehen und ändern“ darf den wirksamen vorgeschlagenen Verkaufspreis frei überschreiben.
- Änderungen werden auditiert.

### 12.2 Freitextpositionen

- Material- und Leistungspositionen dürfen ohne bestehendes Item als Freitext erfasst werden.
- Solche Positionen müssen in der unterstützten ERPNext-Zielversion als frei beschriebene Angebotszeile ohne `item_code` übertragen werden können.
- Vor der Übernahme in einen `Sales Order` muss jeder freien Zeile bewusst ein vorhandenes ERPNext-Item zugeordnet oder ein neues Item angelegt werden.
- Die ursprüngliche Beschreibung, Menge, Einheit und der Preis werden dabei erhalten.

Die Zielversion wird vor Entwicklungsfreigabe mit einem automatisierten Kompatibilitätstest geprüft. Unterstützt sie itemlose `Quotation Item`-Zeilen nicht update-sicher, ist dies ein V1-Go/No-Go; HWERP verwendet nicht still ein generisches Sammel-Item.

### 12.3 Rechte für Zuordnung und Anlage

- Jeder berechtigte Kalkulationsnutzer darf ein vorhandenes Item zuordnen.
- Nur Nutzer mit separatem Recht dürfen neue Items anlegen bzw. freigeben.
- Neue Items werden niemals automatisch ohne Bestätigung erzeugt.

### 12.4 Anlage eines neuen Items

Beim Anlegen entscheidet der Nutzer ausdrücklich zwischen:

- lagergeführtem Material-Item,
- nicht lagergeführtem Material-/Dienstleistungs-Item.

Das System schlägt anhand der Positionsart eine Vorauswahl vor. Außerdem:

- zentrale Standardwerte für `Item Group` und `UOM` werden vorgeschlagen,
- Nutzer mit dem Recht „Items anlegen bzw. freigeben“ dürfen diese ändern,
- die Anlage erfolgt serverseitig und idempotent,
- vorhandene Links dürfen niemals ein zweites Item erzeugen.

### 12.5 Speichern von Preisen in ERPNext

Verkaufspreis:

- Ein Nutzer der Stufe A mit zusätzlichem Preislistenrecht entscheidet ausdrücklich, ob der Kalkulationsverkaufspreis zusätzlich als ERPNext-Preislistenpreis gespeichert wird.
- Eine zentrale Standard-Verkaufspreisliste wird vorgeschlagen.
- Dieser Nutzer darf eine andere Verkaufspreisliste wählen.
- Der Kalkulations-Snapshot bleibt unabhängig davon erhalten.

Einkaufspreis:

- Ein Nutzer der Stufe A mit zusätzlichem Preislistenrecht entscheidet ausdrücklich, ob der interne Materialkostenwert als ERPNext-Einkaufspreis gespeichert wird.
- Eine zentrale Standard-Einkaufspreisliste wird vorgeschlagen und darf von diesem Nutzer geändert werden.
- Ein Einkaufspreis wird nur gespeichert, wenn ein konkreter Lieferant erfasst ist.
- Gibt es bereits einen Einkaufspreis für Item und Lieferant, zeigt HWERP die Abweichung.
- Der Nutzer entscheidet zwischen Ersetzen und zusätzlichem Preiseintrag.
- Neue oder zusätzliche Einkaufspreise gelten ohne Enddatum, bis sie ersetzt oder manuell geändert werden.

## 13. Assets und Mietmittel

### 13.1 Eigene Assets

Eigene Maschinen, Fahrzeuge, Prüfgeräte und andere Anlagegüter werden aus dem ERPNext-`Asset`-Stamm gewählt.

Für interne Asset-Einsätze:

- Ein Satz aus Asset oder Asset-Kategorie wird vorgeschlagen.
- Nur Stufe A darf den kostenwirksamen Satz in der Kalkulation überschreiben.
- Abrechnung ist nach Stunden, Tagen, Kilometern oder pauschal möglich.
- Zeitraum, Menge und Bemerkung sind erfassbar.
- Der tatsächlich verwendete Satz wird als Snapshot gespeichert.
- In einer offenen Kalkulation darf ein Administrator den Snapshot bewusst mit dem aktuell im Asset-/Kategoriestamm hinterlegten Satz aktualisieren. Freigegebene historische Werte ändern sich nicht automatisch.

Der Snapshot enthält mindestens:

- Assetnummer,
- Bezeichnung,
- Kategorie,
- Abrechnungseinheit,
- verwendeten Satz.

### 13.2 Externe Mietmittel

Ein fremd gemieteter Kran oder ein anderes externes Gerät ist kein eigenes ERPNext-Asset.

Mindestangaben einer externen Assetposition:

- Bezeichnung,
- Vermieter/Lieferant,
- Abrechnungseinheit,
- Satz.

Zeitraum, externe Gerätenummer, Angebots-/Vertragsreferenz, Dokumente und Bemerkung sind optional.

Ein externes Mietmittel bleibt standardmäßig eine einmalige Position. Der Nutzer kann es ausdrücklich als wiederverwendbaren HWERP-Stammsatz in Frappe speichern. Dies erfolgt nie automatisch.

Je Mietasset ist die Abrechnungseinheit frei definierbar, beispielsweise Stunde, Tag, Woche, Monat, Kilometer oder Pauschale. Manuelle Mietpositionen bleiben zusätzlich möglich.

### 13.3 Einsatzplanung

V1 verwendet ein Hybridmodell:

- Im einfachen Fall stehen Zeitraum, Menge und Satz direkt an der Assetposition.
- Für komplexere Einsätze kann eine separate, verknüpfte Einsatzplanung angelegt werden.
- Sobald eine Ressource vorgemerkt oder reserviert werden soll, sind eindeutige Ressourcen-ID sowie Beginn und Ende verpflichtend.
- Entwurfskalkulationen dürfen sich zeitlich überschneiden, zeigen aber eine sichtbare Verfügbarkeitswarnung.
- Die Warnung enthält Links zu kollidierenden Kalkulationen, Angeboten, Vormerkungen und Reservierungen.
- Eine zentrale Kalenderansicht ist für V1 nicht erforderlich.

## 14. Vormerkung und verbindliche Reservierung

Vormerkung und Reservierung sind getrennte Zustände:

- Eine Kalkulation allein reserviert kein Asset verbindlich.
- Reservierbar sind in V1 nur eindeutig identifizierte eigene ERPNext-Assets, disponierbare HWERP-Transformatoren bzw. HWERP-Technikobjekte und wiederverwendbare externe Mietmittel-Stammsätze. Kundeneigene Assets, freie technische Objekte, allgemeine Items und einmalige Mietfreitextpositionen erhalten keine HWERP-Verfügbarkeitsreservierung.
- Beim Übertragen in ein Angebot fragt HWERP, ob für diese betroffenen Ressourcen eine unverbindliche Angebotsvormerkung angelegt werden soll.
- Die Vormerkung warnt bei weiteren Vorgängen, blockiert diese aber nicht vollständig.
- Bei einer kollidierenden zusätzlichen Vormerkung werden bestehende Belegungen angezeigt und eine ausdrückliche Bestätigung verlangt.
- Erst das Einreichen (`docstatus = 1`) eines zugehörigen ERPNext-`Sales Order` erzeugt eine verbindliche Reservierung. Ein anderer informeller Annahmehinweis genügt nicht.
- Zwei verbindliche Reservierungen dürfen sich nicht überschneiden.

Für Vormerkung und Reservierung gilt ein Pflichtintervall `[Beginn, Ende)` in der Zeitzone der Frappe-Site; Beginn ist inklusive, Ende exklusive und `Beginn < Ende`. Damit darf eine Folgebelegung genau am Endzeitpunkt der vorherigen beginnen.

Das Einreichen des Sales Order prüft und sperrt die betroffenen Ressourcenzeiträume transaktional. Eine vorhandene Vormerkung wird in derselben Transaktion umgewandelt. Ohne vorherige Vormerkung wird die Reservierung angelegt, sofern der Zeitraum frei ist. Bei einem parallelen Konflikt wird genau ein Vorgang erfolgreich; der andere wird mit der kollidierenden Reservierung abgewiesen.

Eine Angebotsvormerkung endet:

- bei Annahme durch atomare Umwandlung in die verbindliche Reservierung,
- bei Ablehnung,
- bei Ablauf des Angebots,
- durch berechtigte manuelle Aufhebung.

Der Nutzer, der die Vormerkung gesetzt hat, erhält beim automatischen Ende eine ERPNext-Desk-Benachrichtigung. Für diesen Vorgang ist keine zusätzliche E-Mail und kein zusätzliches ToDo erforderlich.

Wird eine Kalkulation storniert, bleibt eine aktive Angebotsvormerkung bestehen. Sie wird separat bzw. nach dem Status des zugehörigen Angebots aufgehoben.

Wird ein versendetes Angebot geändert, entscheidet der Nutzer ausdrücklich, ob:

- das Angebotsgültigkeitsdatum geändert wird,
- die zugehörige Vormerkung an dieses Datum angepasst wird.

Lebenszyklus der verbindlichen Reservierung:

- Storno des zugehörigen Sales Order hebt die aktive Reservierung auf, bewahrt sie aber historisch als storniert.
- Ein Amendment oder eine relevante Terminänderung prüft den neuen Zeitraum erneut; bei Konflikt wird die Änderung blockiert, statt die bestehende Reservierung still zu verschieben.
- Nach Erreichen des Endzeitpunkts wird die Reservierung historisch als beendet geführt und blockiert keine Folgetermine mehr.
- Eine manuelle Aufhebung trotz aktivem Sales Order benötigt das Recht „aktive Reservierung manuell aufheben“, ausdrückliche Bestätigung und Audit-Eintrag.

## 15. Preisgruppen, Regeln und Berechnung

### 15.1 Preisgruppen

Jede operative Verkaufskalkulation muss genau einer HWERP-Kalkulations-Preisgruppe zugeordnet sein.

V1 startet mit:

- Endkunde Deutschland,
- Wiederverkäufer,
- Export.

Nur Nutzer mit dem getrennten Recht „Preisgruppen und HWERP-Preis-/Kostenregeln verwalten“ dürfen weitere Preisgruppen anlegen oder deren Regeln ändern.

Der DocType `HWERP Kalkulations-Preisgruppe` enthält mindestens:

- Name,
- Aktivstatus,
- Zielmarge,
- Margenberechnungsart,
- Standard-Risikopuffer,
- genau eine verknüpfte ERPNext-`Price List`,
- optionale Standard-Kalkulationsvorlage,
- Priorität/Reihenfolge und Beschreibung.

### 15.2 Margenberechnung

Je Preisgruppe ist eine der beiden Methoden wählbar:

1. Aufschlag auf die Kostenbasis,
2. Marge als Anteil am Verkaufspreis.

Verbindliche Rechengrößen, jeweils netto und in der Basiswährung der Company:

```text
C = Summe der bekannten internen Kostenbeträge
r = angewendeter Risikopuffer als Dezimalzahl
R = C × r
M = C + R                                      (Mindestverkaufspreis)

Bei Aufschlag m auf die Kostenbasis:
T = M × (1 + m)                                (Zielverkaufspreis)

Bei Marge m als Anteil am Verkaufspreis:
T = M ÷ (1 - m), mit 0 ≤ m < 1                (Zielverkaufspreis)
```

`C` enthält nur Positionen mit vorhandenem internem Kostenbetrag. Da Arbeitspositionen in V1 keinen internen Arbeitskostensatz besitzen, werden deren unbekannte Kosten nicht mit `0` als vermeintlich vollständige Kosten interpretiert, sondern aus `C` ausgeschlossen. Jede Summen-, Margen- und PDF-Darstellung trägt dann sichtbar den Hinweis „Teilkostenmarge – interne Arbeitskosten fehlen“.

Numerisches Referenzbeispiel:

```text
C = 10.000,00; r = 5 %; daraus R = 500,00 und M = 10.500,00
Aufschlag m = 20 %: T = 12.600,00
Marge m = 20 % vom Verkaufspreis: T = 13.125,00
```

Da interne Arbeitskosten in V1 fehlen, darf die berechnete Marge nicht als vollständige Ist- oder Vollkostenmarge bezeichnet werden.

### 15.3 Risiko

- Jede Preisgruppe enthält einen Standard-Risikopuffer.
- Nur Stufe A darf den angewendeten Risikowert überschreiben.
- Eine Abweichung wird protokolliert.
- Objekt- oder merkmalabhängige Risikoregeln bleiben als Erweiterungspunkt vorgesehen, sind aber keine verpflichtende V1-Funktion.

### 15.4 Preis- und Kostenregeln

- Passende Regeln werden automatisch angewendet.
- Treffen mehrere aktive Regeln auf denselben Sachverhalt zu, gewinnt die Regel mit der höchsten Priorität.
- Treffen zwei Regeln mit gleicher höchster Priorität auf dasselbe Zielfeld, ist dies ein Konfigurationsfehler: Die Neuberechnung und Freigabe werden blockiert, bis der Konflikt behoben ist.
- Nutzer mit Recht „Preise sehen und ändern“ dürfen Regel oder Ergebnis übersteuern.
- Ein Begründungstext ist nicht verpflichtend.
- Regel, alter Wert, neuer Wert, Nutzer und Zeitpunkt werden protokolliert.

### 15.5 Preislisten und Pricing Rules

- Jede HWERP-Preisgruppe ist genau einer ERPNext-Preisliste zugeordnet.
- Der gefundene Item-Verkaufspreis ist je Position der standardmäßig vorausgewählte Verkaufspreisvorschlag.
- Das Ergebnis aktiver ERPNext-`Pricing Rules` wird als getrennte Alternative angezeigt und niemals still zum wirksamen Preis gemacht.
- Der HWERP-Zielverkaufspreis `T` bleibt als dritter, kalkulationsweiter Vergleich sichtbar und überschreibt keine Positionspreise automatisch.
- Eine Preisrolle wählt bzw. bestätigt den wirksamen Positionspreis. Stufe B darf dies nur innerhalb der Prüfung eines eingereichten Preisvorschlags; freie Abweichungen benötigen Stufe A.
- Fehlt für eine preiswirksame Position ein wirksamer Verkaufspreis, darf die Kalkulation nicht freigegeben werden.
- Beim Speichern eines neuen `Item Price` bleibt die zentral konfigurierte Standard-Verkaufspreisliste der vorausgewählte Zielstamm. Weicht sie von der Preisgruppen-Preisliste ab, zeigt HWERP beide Listen und verlangt eine ausdrückliche Auswahl; es erfolgt keine stille Übernahme.

### 15.6 Rabatte und Mindestmarge

- Rabatte dürfen als Prozent oder fester Betrag eingegeben werden.
- Der Nutzer gibt entweder Prozentsatz oder Festbetrag ein; HWERP berechnet den jeweils anderen Wert.
- Zuerst werden Preisvorschlag bzw. manuelle Preisänderung bestimmt, danach wird der Rabatt angewendet.
- `P` ist die Summe der gerundeten Netto-Zeilenbeträge vor Rabatt, `D` der Rabattbetrag und `F = P - D` der Netto-Endverkaufspreis. In V1 gilt `0 ≤ D ≤ P`.
- Die Teilkostenmarge nach Risiko ist `G = F - M`. Bei der Aufschlagsmethode wird `G ÷ M`, bei der Verkaufspreismethode `G ÷ F` angezeigt; bei `M = 0` bzw. `F = 0` erscheint kein irreführender Prozentwert.
- Es wird kein „maximal möglicher Rabatt“ vorgeschlagen.
- Eine zu niedrige oder negative Marge erzeugt eine deutliche Warnung, blockiert aber Freigabe oder Übertragung nicht technisch.

Referenz für Rabatt und angezeigte Teilkostenmarge:

```text
P = 13.000,00; Rabatt = 10 %; D = 1.300,00; F = 11.700,00
bei M = 10.500,00: G = 1.200,00
G ÷ M = 11,43 % (Aufschlagsdarstellung)
G ÷ F = 10,26 % (Verkaufspreis-Margendarstellung)
```

### 15.7 Rundung

- Mengen und Sätze verwenden die in ERPNext konfigurierte Feldpräzision; Geldbeträge verwenden die Währungspräzision der Company.
- Jeder Netto-Zeilenbetrag wird nach `Menge × Satz` auf Währungspräzision gerundet; `P` ist die Summe dieser gerundeten Zeilenbeträge.
- Risiko, Zielpreis, Rabattbetrag und Endpreis werden jeweils nach dem beschriebenen Rechenschritt auf Währungspräzision gerundet.
- Prozentwerte werden für die Anzeige auf zwei Nachkommastellen gerundet; die Berechnung verwendet Dezimalarithmetik und keine binären Gleitkommazahlen.
- Steuern gehören nicht zur HWERP-Kosten-/Margenberechnung. Der hier bezeichnete Angebotsgesamtpreis ist die Netto-Zeilensumme vor ERPNext-Steuern.

### 15.8 Snapshots und Aktualisierung

Als Snapshot gespeichert werden mindestens:

- verwendete Preisgruppe und Preisliste,
- Item-Preise,
- angewendete Pricing Rules,
- Kosten-/Preisregeln,
- Risiko,
- Margenart und Zielmarge,
- Rechengrößen `C`, `R`, `M`, `T`, `P`, `D`, `F` und `G`,
- ausgewählte Preisquelle je Position und verworfene Alternativvorschläge,
- Company, Währung, Preis-/Währungspräzision und angewendete Rundung,
- Kennzeichen, ob interne Arbeitskosten fehlen,
- manuelle Überschreibungen,
- Asset-/Mietsätze.

Offene Entwürfe können auf ausdrücklichen Nutzerwunsch mit aktuellen Preislisten und Regeln neu berechnet werden. Freigegebene Kalkulationen werden durch spätere Stammdatenänderungen niemals automatisch umgerechnet. Bewusste direkte Änderungen bleiben gemäß Abschnitt 8 möglich und werden auditiert.

## 16. Fremdleistungen, Einkauf und abgegrenzte Nachkalkulation

### 16.1 Optionale Einkaufsverknüpfung

Eine Fremdleistungsposition kann optional verknüpft werden mit:

- einer oder mehreren `Supplier Quotation Item`-Positionen,
- einer oder mehreren `Purchase Order Item`-Positionen,
- einer oder mehreren `Purchase Invoice`-Positionen.

Eine Kalkulation bleibt auch ohne diese Links freigabefähig.

Lieferant, Angebotsnummer, Angebotsdatum und Dokument sind freiwillig. Wenn kein passender `Supplier`-Stammsatz benötigt wird oder vorhanden ist, dürfen Lieferant und Referenz als Freitext erfasst werden; ein solcher Freitext erzeugt keinen parallelen Lieferantenstamm.

Eine freie Fremdleistungsposition benötigt mindestens Beschreibung, Menge, UOM und kalkulierten Netto-Einstandssatz in der Company-Währung. Supplier-Link, Einkaufsbeleg und Anhang bleiben optional.

HWERP erzeugt in V1 keine Einkaufsbelege. Sie werden im ERPNext-Standardeinkauf angelegt und anschließend bei Bedarf manuell verknüpft.

### 16.2 Vergleichswerte

HWERP zeigt getrennt:

- kalkulierter Nettowert,
- angebotener Lieferantenwert,
- beauftragter Nettowert aus Bestellungen,
- tatsächlich abgerechneter Nettowert aus Eingangsrechnungen.

Mehrere Belegpositionen je Fremdleistungsposition sind zulässig. Jeder Link enthält Quellbeleg, genaue Quellzeile und einen expliziten zugeordneten Nettobetrag. Innerhalb derselben Kalkulationsversion darf ein Quellzeilenbetrag auf mehrere Kalkulationspositionen aufgeteilt werden, aber die Summe ihrer aktiven Zuordnungen darf den Nettowert nicht überschreiten; eindeutige Constraints und eine transaktionale Prüfung verhindern Doppelzählungen. Historische oder bewusst übernommene Links in einer anderen Kalkulationsversion bleiben zulässig, werden in versionsübergreifenden Auswertungen jedoch nicht gemeinsam als zusätzliche Ist-Kosten summiert.

Für den Vergleich gelten verbindlich:

- nur eingereichte (`docstatus = 1`) Quellbelege zählen,
- stornierte und ersetzte Ursprungsbelege zählen nicht; bei Amendment wird nur der gültige Nachfolgebeleg verknüpft,
- Nettowert bedeutet Zeilenwert nach Zeilenrabatt und vor Steuern,
- Teilmengen und Teilrechnungen werden über den zugeordneten Nettobetrag abgebildet,
- Kalkulation und Quellbeleg müssen derselben Company und Basiswährung angehören,
- Retouren und Lieferantengutschriften werden in V1 nicht eingerechnet,
- ein Link-Snapshot speichert Beleg, Zeile, Status, Nettowert, Zuordnungsbetrag, Nutzer und Zeitpunkt; jede spätere Aktualisierung wird als neuer Auditstand protokolliert.

Beträge werden je Belegart aus den aktiven Zuordnungen summiert. Abweichungen werden sichtbar und revisionssicher protokolliert.

Die freigegebene Kalkulation und das Kundenangebot ändern sich durch spätere Einkaufswerte nicht automatisch.

Lieferantengutschriften und Retouren werden in V1 nicht in den tatsächlichen Kostenwert eingerechnet.

### 16.3 Neue Versionen

Beim Erzeugen einer neuen Kalkulationsversion entscheidet der Nutzer mit Kalkulations-Bearbeitungsrecht ausdrücklich, ob Einkaufsverknüpfungen übernommen werden. Nicht übernommene Links verbleiben ausschließlich an der alten Version.

## 17. Übertragung in ERPNext-Angebote

### 17.1 Voraussetzungen

- Die Kalkulation ist `Freigegeben`.
- Der Nutzer besitzt das separate Recht „Kalkulation in Angebot übertragen“.
- Kalkulation und Zielangebot gehören zum selben Kunden.
- Kalkulation und Zielangebot gehören zur selben Company und Basiswährung.
- Erforderliche Preis- und Objektsnapshots sind vorhanden.

Jeder Übertragungsaufruf besitzt einen vom Client erzeugten Idempotency-Key. Status, Kunde, Company, Berechtigung, Zielangebot und Quellversionsstand werden innerhalb derselben Transaktion erneut geprüft. Ein Retry mit demselben Key liefert dasselbe Angebot und dieselben Zeilen zurück und erzeugt keine Duplikate; nur eine ausdrücklich neue Übertragungsaktion mit neuem Key kann gemäß Konfliktauswahl weitere Zeilen erzeugen.

### 17.2 Neues oder bestehendes Angebot

Der Nutzer entscheidet:

- neues ERPNext-Angebot erzeugen,
- Kalkulation zu einem bestehenden Angebot desselben Kunden hinzufügen.

Ein Angebot darf mehrere Kalkulationen und mehrere Hauptobjekte bündeln.

### 17.3 Angebotspositionen

Der Nutzer kann Hauptobjekte übertragen als:

- einzelne Angebotspositionen,
- zusammengefasste Angebotsposition mit gemeinsamem Preis.

Auch eine zusammengefasste Position speichert den strukturierten Snapshot aller enthaltenen Hauptobjekte. Ihr Betrag entspricht der Summe der zusammengefassten, übertragenen Einzelpreise; sie führt keinen davon unabhängigen Gesamtpreis und löst keine Preisverteilung auf Objekte aus.

Allgemeine Kosten erscheinen standardmäßig als eigene Angebotspositionen ohne Objektbezug. Stufe A oder B darf sie bei Bedarf einem Hauptobjekt zuordnen.

Der Gesamtpreis des Angebots wird aus den übertragenen Einzelpositionen berechnet; es gibt keinen separaten globalen Gesamtpreis, den das System automatisch verteilt.

### 17.4 Herkunft und Snapshots

Jede aus einer Kalkulation erzeugte Angebotsposition speichert:

- Referenz auf die genaue Kalkulation,
- Referenz auf die genaue Kalkulationsposition,
- Kalkulationsnummer, Positions-ID und Versionsstand zusätzlich als unveränderliche Textwerte,
- Transfer-ID und Idempotency-Key,
- Referenzen auf enthaltene Hauptobjekte,
- unveränderlichen Übertragungs-Snapshot von Beschreibung, Menge, Einheit und Preis,
- technischen Snapshot der enthaltenen Objekte.

Der Übertragungs-Snapshot liegt in einem eigenständigen, nicht von der Kalkulationsquelle abhängigen HWERP-Transferdatensatz. Nach Anlage ist dieser für normale Benutzer unveränderlich und nicht löschbar; Korrekturen werden nur als zusätzliche Auditereignisse angehängt. Wird die Quellposition oder nach erlaubtem Unlink die Kalkulation später gelöscht, wird nur der Live-Link geleert; Quellnummer, Positions-ID, Versionsstand, Transferdaten und Snapshot bleiben erhalten und werden als „Quelle gelöscht“ gekennzeichnet. Wird eine Angebotszeile direkt geändert oder gelöscht, bleibt ihr ursprünglicher Transferdatensatz bestehen; Korrekturen werden als neue Auditereignisse angehängt und überschreiben den Ursprungssnapshot nicht.

### 17.5 Spätere Kalkulationsänderungen

- Ein bestehendes Angebot wird nie still aktualisiert.
- Der Nutzer muss eine geänderte Kalkulation bewusst erneut übertragen.
- Wurde eine Angebotsposition manuell abweichend verändert, zeigt HWERP die Abweichung.
- Bei erneuter Übertragung entscheidet der Nutzer je Konflikt ausdrücklich:
  - Position ersetzen,
  - Angebotsposition beibehalten,
  - aktualisierte Position zusätzlich anlegen.

### 17.6 Manuelle Angebotsänderungen

Aus Kalkulationen übertragene Angebotspositionen dürfen nach ausdrücklicher Bestätigung direkt im Angebot geändert oder gelöscht werden.

- Die Kalkulation bleibt unverändert.
- Die Angebotsposition wird sichtbar als „von Kalkulation abweichend“ gekennzeichnet.
- Die Änderung wird auditiert.

Nach ausdrücklicher Bestätigung und nur mit dem Sonderrecht „eingereichtes Angebot kontrolliert ändern“ müssen auch bereits eingereichte ERPNext-Angebote kontrolliert ergänzt bzw. geändert werden können. Dies ist eine bewusste HWERP-Sonderanforderung und muss gegen die tatsächlich installierte ERPNext-Version sicher implementiert werden.

Die Sonderfunktion darf weder ERPNext-Core patchen noch direkte SQL-Änderungen verwenden. Sie benötigt eine transaktionale Servermethode mit separater Berechtigungsprüfung, ausdrücklicher Bestätigung und vollständigem Vorher-/Nachher-Audit. Bereits vorhandene Folgebelege werden dadurch nicht still verändert und werden vor Bestätigung sichtbar aufgelistet. Lässt sich die Funktion in der Zielversion nicht update-sicher und auditfest umsetzen, ist dies ein V1-Go/No-Go und kein Anlass für einen verdeckten Bypass.

Wurde das Angebot bereits versendet:

- erhält es die Kennzeichnung „nach Versand geändert“,
- erhalten der ändernde Nutzer und der im Angebot hinterlegte Angebotsverantwortliche eine Desk-Benachrichtigung und ein ToDo zur Prüfung bzw. zum erneuten Versand,
- entscheidet der Nutzer ausdrücklich, ob und auf welches Datum die Angebotsgültigkeit geändert wird,
- entscheidet der Nutzer getrennt, ob eine Angebotsvormerkung an das neue Datum angepasst wird.

## 18. Storno, Löschen und Audit

### 18.1 Storno

- Jeder Nutzer mit Kalkulations-Bearbeitungsrecht darf stornieren.
- Die Kalkulation bleibt mit Status `Storniert` und vollständigem Verlauf erhalten.
- Stornierte Kalkulationen sind nicht normal bearbeitbar und dürfen nicht in Angebote übertragen werden.
- Eine bereits bestehende Angebotsvormerkung bleibt zunächst bestehen und folgt ihren eigenen Regeln.
- Eine Stornierung erfordert einen Begründungstext; normale Feldänderungen benötigen keine Begründung.

### 18.2 Physisches Löschen

- Nutzer mit „Entwurf löschen“ dürfen unverknüpfte Entwürfe löschen.
- Administratoren dürfen grundsätzlich auch freigegebene Kalkulationen löschen.
- Eine aktuell mit Angeboten, Bestellungen oder Rechnungen verknüpfte Kalkulation darf nicht direkt gelöscht werden.
- Der Administrator muss zuerst jede Verknüpfung bewusst entfernen.
- Verknüpfte ERPNext-Standardbelege werden niemals mitgelöscht.
- Serverseitige Abhängigkeitsprüfung ist verpflichtend.
- Das Entfernen eines Live-Links löscht weder HWERP-Transferdatensatz noch unveränderliche Quellkennungen und Snapshots gemäß Abschnitt 17.4.
- Für die Administrator-Löschung genügt das normale ERPNext-Systemprotokoll mit Nutzer und Zeitpunkt; ein gesonderter nicht löschbarer Löschbeleg ist nicht erforderlich.

### 18.3 Audit-Mindestumfang

Mindestens zu protokollieren sind:

- alte und neue Feldwerte,
- Nutzer und Zeitpunkt,
- Freigabe, Rücknahme der Freigabe und Storno,
- Preis- und Regelüberschreibungen,
- Preisvorschlag, Prüfer, Prüfänderung und Annahme/Ablehnung,
- Kalkulations- und Angebotsübertragungen,
- manuelle Angebotsabweichungen,
- Anlage/Aufhebung von Vormerkungen und Reservierungen,
- Hinzufügen/Entfernen von Einkaufsverknüpfungen,
- Duplizieren und Versionsbildung.

## 19. Duplizieren für einen anderen Kunden

Eine Kalkulation wird niemals auf einen anderen Kunden umgehängt. Stattdessen wird sie dupliziert:

- neue Kalkulationsnummer,
- ausgewählter neuer Kunde,
- Status `Entwurf`,
- ursprüngliche Kalkulation und ursprünglicher Kunde bleiben unverändert.

Der Nutzer entscheidet, welche fachlichen Inhalte übernommen werden. Verbindliche Regeln:

- fachliche Struktur und Positionen dürfen übernommen werden,
- Lieferantenangebote dürfen als Preisgrundlage übernommen werden,
- Kundenangebote werden immer zurückgesetzt,
- Bestellungen werden immer zurückgesetzt,
- Eingangsrechnungen werden immer zurückgesetzt,
- Angebotsvormerkungen werden immer zurückgesetzt,
- verbindliche Reservierungen werden immer zurückgesetzt,
- für die Kopie ist eine neue Verfügbarkeitsprüfung erforderlich.

Für Preise entscheidet der Nutzer:

- bisherige Preis-Snapshots übernehmen,
- oder anhand aktuell gültiger ERPNext-Preislisten und `Pricing Rules` neu berechnen.

Ein abgelaufenes Lieferantenangebot darf als Preisgrundlage übernommen werden, muss aber deutlich als „abgelaufen“ gekennzeichnet sein.

Bei einem kundeneigenen Asset:

- wird die Live-Verknüpfung zum Asset des ursprünglichen Kunden entfernt,
- werden nur allgemeine technische Daten als unverknüpfte Vorlage übernommen,
- werden Assetnummer, Seriennummer, Eigentümer, Standort und andere kundenbezogene Identifikationsdaten entfernt,
- wird der Nutzer gefragt, ob er jetzt ein anderes Asset des neuen Kunden verknüpfen möchte,
- darf ein anderes Asset auch später verknüpft werden.

## 20. Dokumente und interne PDF

### 20.1 Anhänge

Kalkulationen dürfen:

- eigene Dateien und Fotos über Frappe `File` enthalten,
- vorhandene Dokumente an Transformator, Asset oder Angebot verknüpft anzeigen.

Beispiele sind Lieferantenangebote, Typenschildfotos, Prüfberichte und Mietverträge.

### 20.2 Pflichtausgabe V1

Zusätzlich zu Bildschirmansichten und ERPNext-Angebotsübertragung benötigt V1 eine interne Kalkulations-PDF.

Sie enthält mindestens:

- Kalkulationsnummer,
- Kunde,
- Hauptobjekte,
- Positionen,
- Mengen und Einheiten,
- Preise und Summen,
- Preisgruppe,
- Status,
- Erstellungs-/Änderungsstand.

Preiswerte in PDF und PDF-Erzeugung müssen dieselben serverseitigen Berechtigungen beachten wie die Anwendung. Die interne Kalkulations-PDF ist preisführend und kann deshalb nur von Stufe A oder B erzeugt und heruntergeladen werden. Sie wird als privater Frappe-`File` ohne öffentliche URL gespeichert; jeder Download prüft erneut aktuelle DocType-, Teilnehmer- und Preisrechte. Rollenentzug sperrt damit auch bereits erzeugte PDFs. Ein Vermittlungsdienst darf den Download nicht mit einem privilegierten Sammelkonto ausführen.

Excel-/CSV-Export und weitergehende Auswertungen sind keine V1-Pflicht.

## 21. Verhalten bei ERPNext-Ausfall

V1 erhält keinen vollwertigen Offline-Modus.

Wenn ERPNext vorübergehend nicht erreichbar ist:

- bleibt die geöffnete HWERP-Oberfläche bedienbar,
- werden aktuelle, noch nicht gespeicherte Eingaben vorübergehend als klar gekennzeichneter Browser-Entwurf erhalten,
- zeigt HWERP deutlich „ERPNext ist nicht erreichbar – Änderungen sind noch nicht gespeichert“,
- werden Speichern, Freigabe, Preisaktualisierung, Vormerkung und Belegübertragung blockiert,
- gibt es eine Aktion zum erneuten Prüfen der Verbindung und Speichern,
- prüft HWERP nach Wiederherstellung vor dem Speichern, ob der Datensatz zwischenzeitlich geändert wurde.

Der V1-Entwurf lebt nur im Arbeitsspeicher des geöffneten Browser-Tabs. Er wird nicht in `localStorage`, `sessionStorage`, IndexedDB oder einer zweiten lokalen Datenbank persistiert und überlebt daher weder Tab-/Browser-Schließen noch Neuladen, Logout, Sessionablauf oder Benutzerwechsel. Dadurch bleiben aktuelle Eingaben bei einer kurzen Verbindungsstörung im geöffneten Formular erhalten, ohne einen dauerhaften zweiten Datenbestand zu erzeugen.

Nach Wiederherstellung wird der beim Laden gespeicherte Server-Versionsstand verglichen. Bei einem Konflikt gibt es keinen erzwungenen Blind-Overwrite: HWERP zeigt dem weiterhin berechtigten Nutzer einen Feldvergleich, erlaubt das Verwerfen des lokalen Entwurfs oder eine bewusste manuelle Übernahme in den aktuellen Serverstand. Nach Rollenentzug oder fehlender Leseberechtigung wird der lokale Entwurf verworfen und nicht angezeigt. Preisfelder erscheinen im Vergleich nur einer aktuell preisberechtigten Rolle.

## 22. Bestehende Daten

Die derzeit auf hwos.ht-v.de vorhandenen Daten gelten als Test-/Demodaten und werden nicht in die integrierte V1 übernommen.

Die vorhandene Oberfläche und ihr sichtbarer Quellstand dienen als Design- und Bedienreferenz, nicht als verbindliche Datenquelle.

## 23. Server- und API-Anforderungen

- Alle Geschäftsregeln und Berechtigungen werden serverseitig validiert.
- Rechenlogik liegt zentral in der Frappe-App, nicht ausschließlich in React.
- Der Client sendet bei größeren Kalkulationen gebündelte Änderungen statt einer Anfrage je Tabellenzelle.
- Schreibvorgänge sind transaktional; Teilergebnisse dürfen keine inkonsistenten Links erzeugen.
- Preisantworten für Nutzer ohne Preisrecht dürfen geschützte Werte nicht nur optisch verstecken, sondern gar nicht ausliefern.
- Diese Filterung gilt auch für Standard-REST-Routen, Reports, Druck/PDF, `File`, Versionen, Snapshots, Child-DocTypes und Benachrichtigungsinhalte.
- Item-Anlage und Angebotsübertragung sind idempotent.
- Vormerkungs- und Reservierungskonflikte werden unter Datenbanksperre serverseitig geprüft.
- Quell- und Snapshotverknüpfungen sind stabil und dürfen durch spätere Stammdatenänderungen nicht umgedeutet werden.
- Concurrency-/Versionsprüfung verhindert das stille Überschreiben paralleler Änderungen.
- Kunde, Company, Basiswährung, Status und Aktionsrecht werden bei jedem Schreibvorgang serverseitig neu validiert.

## 24. Korrekturen gegenüber früheren Zwischenständen

Die folgenden späteren Entscheidungen sind verbindlich und ersetzen ältere Zwischenstände:

1. Alle verbindlichen Daten einschließlich HWERP-Kalkulationen liegen in ERPNext/Frappe; keine separate HWERP-Geschäftsdatenbank ist führend.
2. Nur freigegebene Kalkulationen dürfen übertragen werden; die frühere Möglichkeit einer Entwurfsübertragung ist verworfen.
3. Kalkulationsvorlagen liefern nur die Startstruktur; eine spätere Vorlagenaktualisierung bestehender Kalkulationen ist nicht Teil von V1.
4. Freigegebene und bereits übertragene Kalkulationen dürfen berechtigt direkt geändert werden; Angebote werden dabei nie automatisch aktualisiert.
5. V1 enthält keine vollständige Nachkalkulation, aber den verbindlich geforderten Nettovergleich von Kalkulation, Bestellung und Eingangsrechnung für verknüpfte Fremdleistungen.
6. Eine Kalkulation gehört genau einem Kunden. Für andere Kunden wird dupliziert.
7. Freie Angebotspositionen dürfen ohne Item-Code übertragen werden; vor dem Kundenauftrag muss ein vorhandenes oder neues Item zugeordnet werden.
8. Das bestehende HWERP-Design bleibt; die Lexoffice-nahe Designrichtung ist verworfen.
9. Angebotsvormerkungen und verbindliche Reservierungen werden beim Duplizieren niemals übernommen.

## 25. Technische Go/No-Go-Prüfungen vor Implementierungsbeginn

Die fachlichen V1-Regeln stehen in den vorherigen Abschnitten. Vor Entwicklungsfreigabe sind ausschließlich Zielsystem-Kompatibilität und konkrete Betriebsparameter zu verifizieren:

- tatsächlich installierte und künftig unterstützte Frappe-/ERPNext-Version,
- installierte Apps und bereits vorhandene HWERP-DocTypes, Custom Fields und Property Setter,
- automatisierter Nachweis, dass `Quotation Item` ohne `item_code` und der verpflichtende Sales-Order-Item-Bridge-Workflow in der Zielversion funktionieren,
- dokumentierter, update-sicherer Hook für kontrollierte, auditierte Änderungen eingereichter Angebote ohne Core-Patch oder SQL-Bypass,
- zuverlässige technische Erkennung „Angebot wurde versendet“ sowie vorhandener Folgebelege,
- vorhandene Company, Basiswährung, Preislisten, Pricing Rules, Item Groups, UOMs, Rollen und Berechtigungsprofile,
- Umfang und Feldmodell der bereits vorhandenen Asset-, Trafo-, Mietmittel- und Reservierungsobjekte,
- Hosting sowie Same-Site-, CORS-, CSRF- und gemeinsame Session-/SSO-Konfiguration für React und Frappe,
- privater `File`-Zugriff und serverseitige Preisfilterung über Standard-API, Report, Print und Download in der konkreten Zielversion,
- Backup-, Restore-, Staging-, Upgrade- und Rollbackverfahren.

Schlägt der Nachweis für itemlose Angebotszeilen oder für die ausdrücklich verlangte, update-sichere Änderung eingereichter Angebote fehl, ist die V1-Entwicklungsfreigabe blockiert. Eine fachliche Ersatzlösung bedarf dann einer neuen ausdrücklichen Entscheidung.

## 26. Mindest-Akzeptanzkriterien für V1

V1 gilt erst als abnahmefähig, wenn mindestens folgende positiven und negativen Szenarien automatisiert bzw. reproduzierbar getestet sind:

1. Eine Kalkulation kann für genau einen ERPNext-Kunden mit mehreren Hauptobjekten und allgemeinen Positionen erstellt werden.
2. Eine Kalkulation ohne Hauptobjekt, aber mit Kunde, Company, Preisgruppe und verantwortlichem Nutzer kann erstellt werden.
3. Links auf andere Company, Fremdwährung, fremden Kunden, unpassendes Projekt oder fremdes Kundenasset werden über UI und direkten API-Aufruf abgewiesen.
4. Der Kunde kann nach dem ersten Speichern nicht umgehängt werden; ein anderer Kunde erfordert Duplizieren bzw. Neuanlage.
5. Stufe C erhält über HWERP-API, Standard-REST, Liste, Report, Print, `Version`, `File`, PDF und Child-DocTypes weder Preise noch ableitbare Margen; entsprechende direkte Requests liefern keine geschützten Werte.
6. Stufe C kann einen eigenen Preisvorschlag einreichen und danach nur eigenen Betrag und Status sehen; Prüfänderung und wirksamer Preis bleiben verborgen.
7. Ein Preisvorschlag erzeugt genau ein zugewiesenes `ToDo` samt ERPNext-Desk-Benachrichtigung an einen berechtigten Prüfer; fehlt Projektprüfer und Verantwortlicher, greift der konfigurierte Fallback, und ohne gültigen Empfänger wird das Einreichen blockiert.
8. Stufe B kann einen Vorschlag im Prüfablauf anpassen und aktivieren, aber außerhalb dieses Ablaufs keinen wirksamen Preis frei ändern; Stufe A kann dies.
9. Ein Bearbeiter ohne Freigaberecht setzt eine fachlich relevant geänderte freigegebene Kalkulation automatisch auf `Entwurf`; nur Freigaberecht darf sie ausdrücklich freigegeben lassen.
10. Ein Bearbeiter darf mit Begründung stornieren, aber nicht physisch löschen oder eine stornierte Kalkulation übertragen.
11. Vorhandene Items können mit Bearbeitungsrecht zugeordnet werden; Item-Neuanlage ohne Item-Recht wird in UI und API abgewiesen und ein Retry erzeugt nie ein zweites Item.
12. Ein `Item Price` kann nur mit Stufe A plus Preislistenrecht gespeichert oder geändert werden; Stufe B und C werden auch über direkte API abgewiesen.
13. Material übernimmt Einkaufs-Kostenwert, Price-List-Vorschlag und getrennten Pricing-Rule-Vorschlag nachvollziehbar und speichert die verwendeten Werte als Snapshot.
14. Für `C = 10.000,00`, Risiko `5 %` und Zielmarge `20 %` ergeben die Golden Tests `M = 10.500,00`, bei Aufschlag `T = 12.600,00` und bei Verkaufspreismarge `T = 13.125,00`.
15. Für `P = 13.000,00` und Rabatt `10 %` ergeben sich `D = 1.300,00`, `F = 11.700,00`; bei `M = 10.500,00` werden `G = 1.200,00`, `11,43 %` Aufschlag bzw. `10,26 %` Verkaufspreismarge angezeigt. Zeilen- und Währungsrundung folgen Abschnitt 15.7.
16. Price List bleibt Standardvorschlag, Pricing Rule getrennte Alternative und HWERP-Zielpreis Vergleich; keine Alternative überschreibt eine andere still. Gleichrangige interne Regeln für dasselbe Zielfeld blockieren Neuberechnung und Freigabe.
17. Eine niedrige oder negative Teilkostenmarge erzeugt eine Warnung, blockiert Freigabe und Übertragung aber nicht.
18. Sobald Arbeitspositionen vorkommen, erscheint „Teilkostenmarge – interne Arbeitskosten fehlen“ in Detail, Summen, Freigabedialog und PDF; nirgends wird sie als Vollkosten- oder Ist-Marge bezeichnet.
19. Eine freigegebene Kalkulation bleibt trotz späterer Stamm-/Preislistenänderung unverändert; bewusste Aktualisierung eines Entwurfs erzeugt einen neuen Audit- und Snapshotstand.
20. Nur ein Nutzer mit Übertragungsrecht kann eine freigegebene Kalkulation in ein Angebot desselben Kunden, derselben Company und Basiswährung übertragen; jeder Gegenfall wird serverseitig abgewiesen.
21. Doppelklick, Timeout-Retry und zwei parallele Requests mit demselben Idempotency-Key erzeugen genau ein Angebot bzw. einen Satz Angebotszeilen und liefern beim Retry dasselbe Ergebnis.
22. Ein Angebot kann mehrere Kalkulationen bündeln; zusammengefasste Zeilen entsprechen der Summe ihrer Einzelpreise, und es existiert kein separat zu verteilender Gesamtpreis.
23. Jede Übertragung erzeugt einen eigenständigen Ursprungssnapshot. Unlink oder zulässige Löschung von Quelle bzw. Angebotszeile entfernt diesen nicht; Quellnummer, Positions-ID, Versionsstand und ursprüngliche Werte bleiben prüfbar.
24. Direkte Angebotsabweichungen sind bestätigt, sichtbar und mit Vorher-/Nachher-Werten auditiert; die Kalkulation bleibt unverändert.
25. Eine erneute Übertragung bietet je Abweichung Ersetzen, Beibehalten oder zusätzliches Anlegen und führt die gewählte Option reproduzierbar aus.
26. Eine Freitextposition gelangt ohne `item_code` in die Quotation; vor Sales Order wird Item-Zuordnung oder bestätigte Item-Anlage erzwungen und Beschreibung, Menge, UOM und Preis bleiben erhalten.
27. Die kontrollierte Änderung eines eingereichten bzw. versendeten Angebots prüft Sonderrecht und Bestätigung, protokolliert vollständig, listet Folgebelege, verändert diese nicht und erzeugt bei Versand Kennzeichnung, Desk-Benachrichtigung und `ToDo` an beide Empfänger.
28. Eine optionale Vormerkung mit Pflichtintervall warnt bei Überschneidung und verlangt Bestätigung, blockiert aber eine zweite Vormerkung nicht.
29. Zwei parallele Sales-Order-Einreichungen für dieselbe Ressource und überlappende Intervalle führen zu genau einer verbindlichen Reservierung; der zweite Vorgang wird konfliktbegründet abgewiesen. Eine Einreichung ohne Vormerkung funktioniert bei freiem Zeitraum.
30. Sales-Order-Storno hebt die aktive Reservierung historisch auf; Amendment/Terminänderung prüft erneut und blockiert bei Konflikt; am Endzeitpunkt wird die Ressource frei.
31. Bei Ablauf, Ablehnung oder Annahme endet die Vormerkung nach den festgelegten Regeln und der Vormerker erhält genau die Desk-Benachrichtigung, aber kein zusätzliches ToDo oder E-Mail.
32. Fremdleistungslinks verwenden genaue Belegzeile und Zuordnungsbetrag; Teilrechnung und Aufteilung sind möglich, Doppelzählung oberhalb des Quellnettowerts innerhalb derselben Kalkulationsversion wird transaktional verhindert.
33. Nur eingereichte, aktive, gleichwährungs- und gleichcompanybezogene Einkaufszeilen zählen; Draft, Storno, ersetzter Ursprung, Retouren, Gutschrift und Fremdwährung werden ausgeschlossen. Der Nettowert ist nach Zeilenrabatt und vor Steuer.
34. Ein Duplikat für einen anderen Kunden übernimmt keine Angebote, Bestellungen, Rechnungen, Vormerkungen oder Reservierungen; ein Kundenasset wird entkoppelt und von kundenbezogenen Identifikationsdaten bereinigt.
35. Eine verknüpfte Kalkulation kann nicht gelöscht werden, bevor Live-Links bewusst entfernt wurden; Standardbelege und Transfer-Snapshots bleiben danach bestehen.
36. Nur Stufe A/B kann die interne Kalkulations-PDF erzeugen oder über eine direkte `File`-URL herunterladen; Rollenentzug sperrt auch eine zuvor erzeugte private PDF.
37. Bei ERPNext-Ausfall bleiben Eingaben nur im geöffneten Tab, verbindliche Aktionen sind blockiert; Neuladen/Logout verwirft den Entwurf. Bei Serverkonflikt gibt es Vergleich, Verwerfen oder manuelle Übernahme, aber keinen Blind-Overwrite.
38. Die Demodaten von hwos.ht-v.de werden nicht migriert; Tests bestätigen, dass keine Demo-Geschäftsdatensätze in die integrierte Site übernommen werden.
39. Desktop-Referenz ist mindestens 1366×768 in aktueller und vorheriger stabiler Chrome-/Edge-Version. Dashboard, Kalkulationsliste und Kalkulationsdetail bestehen einen visuellen Regressionstest gegen die freigegebenen HWERP-Referenzbilder; Tablet ab 768 px bleibt lesbar, darf aber funktionsreduziert sein.
40. Ein dokumentierter Staging-Lasttest mit 20 Hauptobjekten, 500 Positionen und 20 parallelen Nutzern erreicht nach Warm-up über 30 Läufe p95 ≤ 3 s für Öffnen, Speichern und Neuberechnen sowie p95 ≤ 5 s für Angebotsübertragung; Testhardware, Netzwerk und Datenmenge werden im Abnahmeprotokoll festgehalten.
41. Clean Install, Migration, Backup/Restore, Upgrade auf die unterstützte ERPNext-Version und Rollback werden auf Staging reproduzierbar erfolgreich durchgeführt.
42. Beim Speichern eines neuen `Item Price` wird die zentrale Standardpreisliste vorausgewählt; weicht die aktuelle Preisgruppen-Preisliste ab, werden beide sichtbar benannt und ohne ausdrückliche Auswahl wird nicht gespeichert.
43. Eine freie Fremdleistung mit Beschreibung, Menge, UOM und Netto-Einstandssatz kann ohne Supplier und Einkaufsbeleg freigegeben werden; fehlt eines der vier Pflichtfelder, wird Speichern bzw. Freigabe nachvollziehbar abgewiesen.
44. Vormerkung/Reservierung ist nur für die in Abschnitt 14 benannten Ressourcentypen mit eindeutiger ID und Pflichtintervall möglich; Kundenasset, allgemeines Item und Freitext-Mietposition werden über UI und API abgewiesen.
45. Änderung, Storno oder Amendment eines verknüpften Einkaufsbelegs erzeugt einen neuen Link-/Auditstand und berechnet die aktive Nettosumme neu, ohne den früheren Snapshot oder die freigegebene Kalkulation zu überschreiben.
46. Eine Teilnehmerbeschränkung wird bei Child-DocType, Snapshot, Audit, Report, Print und privatem File durchgesetzt; ein entfernter Teilnehmer verliert diese Zugriffe unmittelbar, ohne dass andere berechtigte Nutzer betroffen sind.
47. Rollenentzug, Sessionablauf oder Benutzerwechsel verwirft einen noch offenen Browserentwurf und verhindert, dass dessen geschützte Felder dem nächsten Nutzer angezeigt oder gespeichert werden.
48. Für jede Aktion der Matrix in Abschnitt 7.3 existiert mindestens ein positiver und ein negativer UI-/API-Test; insbesondere können Unberechtigte weder Preisgruppen/Regeln ändern, Teilnehmer verwalten noch eine aktive Reservierung manuell aufheben.

Die Werte in 39 und 40 sind technische Mindestbudgets für V1. Eine Abweichung erfordert vor Produktion eine ausdrücklich dokumentierte Abnahmeentscheidung.

## 27. Empfohlene Umsetzungsreihenfolge

1. Zielsystem und ERPNext-Version read-only prüfen.
2. Rollenmatrix, serverseitige Preisfilterung und API-Sicherheitskonzept festlegen.
3. Frappe-DocTypes für Kalkulation, Hauptobjekte, Positionen, Preisgruppen und Snapshots implementieren.
4. Serverseitige Berechnung mit Preislisten, Pricing Rules, Risiko, Marge und Audit implementieren.
5. React-Oberfläche an die Frappe-APIs anbinden und das bestehende HWERP-Design beibehalten.
6. Asset-/Mietmittel- und Vormerkungslogik implementieren.
7. Angebotsübertragung, Herkunftssnapshots und Abweichungsbehandlung implementieren.
8. Einkaufsverknüpfung und Netto-Abweichungsvergleich ergänzen.
9. Item-Anlage/-Zuordnung und Preislistenpflege ergänzen.
10. Interne PDF, Ausfallverhalten und Konfliktprüfung implementieren.
11. Rollen-, API-, Integrations-, Migrations-, Backup- und Upgrade-Tests auf Staging durchführen.
12. Produktion erst nach ausdrücklicher Freigabe, geprüftem Backup/Restore und Rollbackplan installieren.
