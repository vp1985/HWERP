# Reproduzierbares HWERP-Image

Das Dockerfile erweitert das derzeit geprüfte ERPNext-/CRM-Image ausschließlich um die versionierte Frappe-App. Es verändert keinen laufenden Container.

Build aus dem Projektstamm:

```bash
docker build -t local/erpnext-hwerp:v16.30.0-hwerp0.1.0 .
```

Vor einem Einsatz:

1. Image in einer isolierten Compose-Testumgebung für Backend, Worker, Scheduler und alle weiteren Frappe-Dienste verwenden.
2. Testsite sichern beziehungsweise neu anlegen.
3. Im gemeinsam persistenten `sites`-Volume die App idempotent registrieren:

   ```bash
   grep -qxF hwerp sites/apps.txt || printf '%s\n' hwerp >> sites/apps.txt
   ```

   Das Image enthält diesen Eintrag bereits. Bei einem bestehenden, darüber gemounteten `sites`-Volume muss er dennoch vor der Installation ergänzt und anschließend mit `grep -xF hwerp sites/apps.txt` geprüft werden.
4. `bench --site <testsite> install-app hwerp` ausführen.
5. `bench --site <testsite> migrate` ausführen.
6. `bench --site <testsite> list-apps` prüfen und automatisierte App-, Rechte- und API-Tests ausführen.
7. Backup-/Restore und Rollback mit dem vorherigen Image prüfen.

Die bestehende Produktiv-Compose-Konfiguration und laufenden Container werden nicht automatisch geändert.
