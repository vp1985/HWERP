# Technische Zielsystemprüfung

Stand: 2026-08-07

## Ermittelt

- Deployment: Docker Compose, Projekt `erpnext`
- Backend-Image: `local/erpnext-crm:v16.30.0-crm1.81.0`
- Frappe: 16.29.0
- ERPNext: 16.30.0
- CRM: 1.81.0
- Persistente Volumes: `sites` und `logs`; App-Code ist Bestandteil des Images.

## Konsequenz

Die HWERP-App muss als versionierte Custom-App in ein eigenes Image eingebaut werden. Eine bloße Änderung im laufenden Container wäre nicht update-sicher und wird nicht vorgenommen.

## Vor Installation zwingend

1. vollständiges Site-Backup einschließlich privater Dateien,
2. Build eines reproduzierbaren Images mit `hwerp` als App,
3. Clean-Install-/Migrationstest auf einer isolierten Testsite,
4. automatisierte Rechte-, API- und DocType-Tests,
5. Rollbacktest,
6. gesonderter Go/No-Go-Test für kontrollierte Änderungen eingereichter Angebote.

Keine Zugangsdaten oder Site-Konfigurationen sind Bestandteil dieses Arbeitsverzeichnisses.
