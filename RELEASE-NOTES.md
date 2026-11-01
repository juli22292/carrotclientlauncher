## CarrotClientLauncher 0.0.4

Instanzen öffnen jetzt direkt ihre Inhalte. Mods, Ressourcenpakete und Shader stehen in einer gemeinsamen Liste mit Namen, Datei, Version, Größe und Schaltern. Farben, Schriften und Bilder bleiben im Carrot-Stil.

- **Inhalte verwalten:** Nach Name, Dateiname und Version suchen, nach Inhaltstyp und Aktivierung filtern und die Liste sortieren. Verfügbare Mod-Updates erscheinen direkt an der jeweiligen Datei. Zugeordnete Modrinth-Projekte können ihr Projektsymbol anzeigen.
- **Eigene Dateien hinzufügen:** JAR-Mods und ZIP-Pakete über die Dateiauswahl in eine Instanz übernehmen. Die Quelldateien bleiben erhalten; vorhandene Dateien werden nicht überschrieben. Entfernen erfordert eine Bestätigung. Automatische Backups werden entsprechend der bestehenden Einstellung erstellt.
- **Übersichtlicher entdecken:** Listen- und Kachelansicht, 20 oder 40 Ergebnisse pro Seite und Sortierung nach Downloads, Relevanz, Aktualisierung oder Veröffentlichungsdatum. Suche und Filter bleiben beim Wechsel zur Instanz erhalten. Strg+F fokussiert die Suche.
- **Installationsstatus sehen:** Bekannte Modrinth-Projekte werden als installiert oder deaktiviert markiert und können aus der Suche ausgeblendet werden. Lokal hinzugefügte Dateien ohne Projektzuordnung werden nicht als beliebige Modrinth-Projekte erkannt.
- **Passende Zielinstanz:** Minecraft-Version und Modloader sind sichtbar an die Instanz gebunden. Mod-Installationen bieten nur Instanzen mit Modloader an. Modpacks werden weiterhin als eigene Instanz importiert; Vanilla verhindert nicht mehr die Suche nach passenden Modpacks.
- **Klarere Bedienung:** Spielen und Profilwahl stehen am Instanzkopf. Darstellung und Versionswechsel sind im Tab Einstellungen, Sicherungen und Protokolle in eigenen Tabs. Wechsel zwischen den Tabs funktioniert auch per Pfeiltasten. Die Startseite bietet den direkten Start eines vorhandenen Profils.

### Geprüft

- 62 automatisierte Tests, einschließlich Dateiimport, Kollisionsschutz, Sicherung/Wiederherstellung, verknüpfter Verzeichnisse und Suchparameter.
- Native Electron-Abläufe für Profilimport, Anmeldung mit kontrollierten Antworten, Instanzverwaltung, Inhaltssuche, Dateiimport, Bestätigungen, Installiert-Markierungen, Seitenwechsel, verzögerte Suchantworten und kompakte Fenster.
- Windows-Build mit Installer, portabler EXE und Update-Dateien; Prüfsummenprüfung und separate Prüfung der gebauten Anwendung.

### Installation

`carrotclientlaunchersetup.exe` installiert nach **CarrotClientLauncherApp**. Die Anwendung startet als `carrotclientlauncher.exe`; eine portable EXE liegt ebenfalls bei. Das Update wird über das öffentliche GitHub-Repository angeboten. Herunterladen und Installieren bleiben getrennte Schritte. Bestehende Instanzen und Spielstände bleiben erhalten.

Vanilla, Fabric, Forge, NeoForge und Quilt werden ab Minecraft 1.16 unterstützt, soweit der jeweilige Loader für die gewählte Version verfügbar ist. Eigene JAR- und ZIP-Dateien müssen zur Instanz passen. Ein vollständiger Live-Test mit einem lizenzierten Microsoft-Konto auf dem Ziel-PC bleibt vom automatisierten Test getrennt.
