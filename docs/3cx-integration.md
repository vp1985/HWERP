# 3CX-Anbindung für HWERP

## Umfang dieser ersten Ausbaustufe

Der Feature-Branch bereitet die Anbindung einer gehosteten 3CX-Anlage vor,
ohne Zugangsdaten oder PBX-Adressen in den Quellcode aufzunehmen:

- sichere Normalisierung eingehender und vom Nutzer ausgewählter Telefonnummern,
- ein validiertes, providerneutrales Ereignisformat für künftige Anrufjournale,
- ein authentifizierter HWERP-Endpunkt für Click-to-Call über den angemeldeten
  3CX-Webclient.

Kunden, Ansprechpartner und Leads werden weiterhin ausschließlich in ERPNext
geführt. Eine 3CX-Anbindung legt keinen parallelen Kunden- oder Kontaktstamm an.

## Konfiguration je Frappe-Site

Ein Systemadministrator setzt ausschließlich auf der Zielsite diese Konfiguration:

```json
{
  "hwerp_3cx_dial_url_template": "https://<PBX-FQDN>/webclient/#/call?phone={number}"
}
```

`{number}` ist verpflichtend und wird von HWERP URL-codiert durch die
normalisierte Telefonnummer ersetzt. Das tatsächliche URL-Format ist vor der
Produktivsetzung mit der konkreten Hosted-3CX-Instanz zu bestätigen; nur dann
wird die Vorlage gesetzt.

Der Endpunkt ist für angemeldete Frappe-Benutzer bestimmt und wird ausschließlich
per POST aufgerufen:

```
/api/method/hwerp.api.v1.threecx.click_to_call
```

Parameter:

```json
{ "phone": "+493012345" }
```

Antwort:

```json
{ "message": { "launch_url": "https://…" } }
```

Das Frontend öffnet `launch_url` nur nach einer bewussten Benutzeraktion. Der
Endpunkt kontaktiert die Telefonanlage nicht und enthält keine Secrets.

## Noch vor Live-Schaltung erforderlich

Die Hosted-3CX-Verwaltung muss freigeben, welcher Integrationsweg für die
konkrete Instanz zulässig ist:

1. API-/OAuth-Integration oder CRM-Template für eingehende Ereignisse,
2. Ereignisformat und Signaturverfahren für Webhooks,
3. erlaubte PBX-FQDN und endgültiges Click-to-Call-URL-Format,
4. Datenschutz- und Aufbewahrungsregel für Anrufjournal und Aufzeichnungen.

Erst mit diesen Angaben wird die nächste Ausbaustufe aktiviert: signaturgeprüfte
Webhooks, Kontakt-/Kundenauflösung über ERPNext-Standarddaten und ein
unveränderbares, berechtigtes Anrufjournal.
