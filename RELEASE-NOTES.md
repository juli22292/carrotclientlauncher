## CarrotClientLauncher 0.0.1

Die erste Versionsnummer wurde auf **0.0.1** gesetzt. Der Funktionsumfang des bisherigen Stands bleibt erhalten.

## Windows-Installer und Launcher-Updates

Mit `carrotclientlaunchersetup.exe` den Launcher installieren. Der Programmordner heißt standardmäßig `CarrotClientLauncherApp`; die Anwendung startet über `carrotclientlauncher.exe`.

- Automatische Update-Prüfung beim Start und danach alle 60 Sekunden über die öffentlichen GitHub Releases.
- Download und Installation werden getrennt gestartet: Unter **Einstellungen → Launcher-Updates** zuerst **Update herunterladen**, danach **Update installieren**.
- Heruntergeladene Updates werden beim normalen Schließen nicht automatisch installiert.
- Minecraft und laufende Downloads vor einer Update-Installation beenden. Instanzen und Spielstände bleiben im bisherigen Datenordner erhalten.
- Microsoft-Anmeldung und ausdrücklich auswählbare Offline-Profile, Vanilla und Fabric sowie Discord Rich Presence sind enthalten.

Die Microsoft-Anmeldung bei Minecraft Services benötigt weiterhin die Freigabe der eigenen App-ID durch Mojang. Der vollständige Anmelde- und Spieltest mit einem lizenzierten Konto steht noch aus.

Die portable `carrotclientlauncher.exe` liegt ebenfalls bei. Für die reguläre Installation und weitere Updates wird der Setup-Installer empfohlen.

Die Versionsnummer wurde von 0.4.0 auf 0.0.1 zurückgesetzt. Bestehende 0.4.0-Installationen bitte einmal mit diesem Setup aktualisieren; der automatische Updater bietet absichtlich keine niedrigeren Versionsnummern an. Danach laufen weitere Updates wieder über den Launcher.
