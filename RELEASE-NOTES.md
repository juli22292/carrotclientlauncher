## CarrotClientLauncher 0.0.3

Instanzen haben jetzt eine eigene große Verwaltungsseite im Hauptbereich des Launchers. Die bisherigen Farben, Schriften und Bedienelemente bleiben erhalten.

- **Mehr Platz:** Übersicht, Mods, Backups und Fehlerprotokolle nutzen den verfügbaren Inhaltsbereich. Über Seitenleiste und Bibliothek direkt zwischen Instanzen wechseln.
- **Klarere Mod-Verwaltung:** Installierte Mods durchsuchen und nach aktiviert/deaktiviert filtern. Die Listen verwenden den Platz der Seite statt eines kleinen Dialogs.
- **Entdecken mit Kontext:** „Mods entdecken“ in einer Instanz filtert nach deren Minecraft-Version und Loader. Die Zielinstanz ist beim Installieren vorausgewählt; ein Zurück-Link führt zur Instanzverwaltung.
- **Fünf Spielvarianten:** Vanilla, Fabric, Forge, NeoForge und Quilt. Verfügbare Loader-Versionen werden für die gewählte Minecraft-Version geladen, geprüft und fest übernommen. Nicht verfügbare Kombinationen erhalten eine Meldung.
- **Offizielle Installation:** Forge/NeoForge werden mit den geprüften offiziellen Installer-JARs installiert, einschließlich ihrer Patch-Prozessoren. Quilt verwendet seine offiziellen Metadaten.
- **Durchgängige Unterstützung:** Neue Loader auch für Modrinth-Installationen und -Updates, `.mrpack`- und Profilimport, Versionswechsel, Backups, Bibliotheksfilter und Discord-Aktivität.
- **Mod-Namen:** Auch Quilt-Metadaten und Forge-/NeoForge-TOML werden in der Modliste erkannt.
- **Startkorrekturen:** Generierte Loader-Bibliotheken bleiben im Klassenpfad. Der ursprüngliche Minecraft-JAR wird bei Forge-/NeoForge-Modulscans korrekt ausgeschlossen.

### Geprüft

- Automatisierte Tests für Persistenz, Kataloge, Versionszuordnung, Installer-Metadaten, Klassenpfade, Modpacks, Mod-Metadaten und bestehende Funktionen.
- Native Electron-Tests für die große Instanzseite, kompakte Fenster, Suche/Filter, kontextbezogenes Entdecken, Loader-Auswahl und Sicherungen.
- Echte Installation und Initialisierung bis zur Spieloberfläche: Forge 52.1.20, NeoForge 21.1.265 und Quilt 0.30.2 auf Minecraft 1.21.1; zusätzlich Forge 47.4.28 auf Minecraft 1.20.1. Java 21 bzw. 17 werden passend verwaltet. Die Prüfungen verwenden isolierte Testinstanzen.

### Installation und Grenzen

`carrotclientlaunchersetup.exe` installiert nach **CarrotClientLauncherApp**. Der Launcher startet weiterhin als `carrotclientlauncher.exe`; die portable EXE liegt ebenfalls bei. Bestehende 0.0.1-/0.0.2-Installationen erhalten das Update über GitHub. **Herunterladen** und **Installieren** bleiben getrennte Schritte.

Unterstützt werden Minecraft-Versionen ab 1.16, soweit der jeweilige Loader dafür tatsächlich verfügbar ist. Mods müssen ausdrücklich zur gewählten Minecraft-/Loader-Version passen. Ein vorhandener Forge-Mod wird nicht automatisch zu einer NeoForge- oder Quilt-Mod konvertiert. Eigene HUDs, Cosmetics und Konten fremder Clients bleiben an deren Client gebunden.

Die externe Freigabe der eigenen Microsoft-App-ID für Minecraft Services bleibt erforderlich. Die Spielstartprüfungen ersetzen keinen vollständigen Live-Anmeldetest mit einem lizenzierten Microsoft-Konto.
