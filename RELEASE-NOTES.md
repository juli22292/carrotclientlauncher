## CarrotClientLauncher 0.0.2

Mods direkt installieren, vorhandene Welten mitnehmen und Änderungen mit Backups absichern.

- **Modrinth-Installation:** Mods, Ressourcenpakete und Shader direkt einer Instanz zuordnen. Minecraft-/Loader-Versionen und erforderliche Mod-Abhängigkeiten werden vorab geprüft. Mods aktivieren, deaktivieren und auf kompatible Updates prüfen.
- **Modpacks:** `.mrpack` über die Dateiauswahl, per Drag-and-drop oder aus der Modrinth-Suche als neue Instanz importieren. Fabric-Versionen, Client-Overrides sowie optionale bzw. ausschließlich für Server bestimmte Dateien werden berücksichtigt.
- **Profile importieren:** Auswahl für Modrinth, Laby Launcher, Lunar Client, NoRiskClient und Badlion Client. Automatische Suche und manuelle Ordnerauswahl mit Prüfung vor der Übernahme. Modrinth unterstützt die aktuelle SQLite-Struktur und ältere JSON-Profile; NoRisk unterstützt JSON und SQLite. Laby/Lunar verwenden erkannte Profile bzw. deren Spielordner oder `.mrpack`-Exporte. Badlion-Spieldaten werden kopiert und Client-Einstellungen als Referenz aufbewahrt.
- **Backups:** Standardmäßig vor Mod-Änderungen und Versionswechseln sichern. Die letzten fünf automatischen Backups und alle manuellen Backups bleiben erhalten. Beim Wiederherstellen zuerst den aktuellen Stand sichern.
- **Instanzen:** Eigene Bilder und Symbole, Beschreibungen, Favoriten und schneller Einstieg in die zuletzt gespielte Instanz. Minecraft-Version und Loader mit Bestätigung ändern.
- **Fehlerhilfe:** Hinweise zu häufigen Java-, Mod-, Speicher- und Grafikfehlern. Protokolle vor dem Teilen ansehen und bereinigt als Textdatei exportieren; kein automatischer Upload.
- **Startfortschritt:** Minecraft-Start als eigener Schritt zusätzlich zu den Download- und Java-Phasen.

### Beim Import beachten

Unterstützt werden **Vanilla und Fabric ab Minecraft Java 1.16**. Forge, NeoForge, Quilt und ältere Spielversionen werden ausdrücklich abgewiesen. Client-eigene HUDs, Cosmetics, Anmeldekonten, Java-Startbefehle und proprietäre Laufzeiten lassen sich nicht als gleichwertige Vanilla-/Fabric-Funktionen übernehmen. Nicht erkannte Spielversionen bzw. Loader müssen im Importdialog bestätigt werden. Die Originalordner werden nicht verändert.

Formatvarianten, Quellen und Grenzen: [IMPORT-FORMATS.md](https://github.com/juli22292/carrotclientlauncher/blob/main/IMPORT-FORMATS.md). Eine universelle Kompatibilität mit jeder vergangenen oder künftigen Launcher-Version wird nicht zugesagt.

### Installation und Update

`carrotclientlaunchersetup.exe` installiert im Ordner **CarrotClientLauncherApp**. Die Anwendung heißt weiterhin `carrotclientlauncher.exe`. Eine portable EXE liegt ebenfalls bei.

Bestehende 0.0.1-Installationen erhalten das Update über GitHub Releases. Im Launcher zuerst **Update herunterladen**, danach **Update installieren**. Beide Schritte bleiben getrennt. Bestehende Instanzen bleiben erhalten.

Für Installationen aus der früheren 0.4.0-Versionsreihe ist eine einmalige manuelle Installation nötig, da ein automatisches Downgrade nicht angeboten wird.

Die Freigabe der eigenen Microsoft-App-ID für Minecraft Services ist weiterhin ein externer Schritt. Der vollständige Spieltest mit einem lizenzierten Microsoft-Konto steht aus.
