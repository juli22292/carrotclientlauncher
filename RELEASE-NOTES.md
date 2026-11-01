## CarrotClientLauncher 0.0.5

Installationen bleiben jetzt bei der Instanz, aus der du sie gestartet hast. Ressourcenpakete und Shader lassen sich bei laufendem Minecraft hinzufügen; Mod-Änderungen benötigen weiterhin ein beendetes Spiel und werden beim nächsten Start geladen.

- **Keine doppelte Zielauswahl:** In der Instanzsuche und im Installationsdialog wird das aktuelle Profil fest angezeigt. Eine fehlende oder ungeeignete Instanz führt nicht zur Installation in einem anderen Profil.
- **Passende Version automatisch prüfen:** Die kompatible Datei und benötigte Abhängigkeiten werden beim Öffnen des Projekts geprüft. Danach genügt Jetzt installieren. Nach einem Verbindungsfehler ist ein erneuter Versuch im selben Dialog möglich.
- **Modpacks separat erstellen:** Die globale Modpack-Suche fragt nicht nach einer bestehenden Zielinstanz. Ein Dialog enthält Name, Paketversion, Minecraft-Version, Loader und optionale Client-Dateien. Eine stabile Paketversion wird bevorzugt. Nach der Installation öffnet sich direkt die neue Instanz.
- **Keine verschachtelten Modpacks:** Beim Hinzufügen von Inhalten zu einem bestehenden Profil werden Mods, Ressourcenpakete und Shader angeboten. Neue Modpacks haben einen eigenen Ablauf und eigene Spielordner.
- **Ressourcenpakete und Shader während des Spielens:** Installation und Dateiimport sind möglich, ohne Minecraft zu beenden. Die Inhalte werden anschließend im Spiel ausgewählt oder neu geladen. Enthält eine Installation eine erforderliche Mod, greift dafür der Mod-Schutz.
- **Gezielte Inhaltsbackups:** Automatische Sicherungen vor Inhaltsänderungen erfassen die betroffenen Ordner und deren Projektzuordnungen. Eine Inhaltswiederherstellung erhält aktuelle Welten, Einstellungen und andere Inhalte. Alte vollständige Sicherungen bleiben wiederherstellbar.
- **Kleine UI-Korrekturen:** Neue Modpacks sind als solche erkennbar und in der Bibliothek filterbar. Erfolgsmeldungen verdecken keine geöffneten Dialoge mehr.

### Geprüft

69 automatisierte Tests sowie native Oberflächentests für laufende Instanzen, feste Zielprofile, Mod-Abhängigkeiten, den gesamten Modpack-Ablauf, Wiederholung nach Verbindungsfehlern, Import, ältere Backups und kompakte Fenster. Die gebauten Windows-Anwendungen und der öffentliche Update-Kanal werden zusätzlich geprüft.

### Installation und Hinweise

carrotclientlaunchersetup.exe installiert weiterhin nach CarrotClientLauncherApp. Die Anwendung und die portable EXE heißen carrotclientlauncher.exe. Herunterladen und Installieren eines Launcher-Updates bleiben getrennte Schritte.

Mods können bei laufendem Minecraft nicht geändert werden. Ressourcenpakete und Shader müssen im Spiel ausgewählt oder neu geladen werden; Shader benötigen einen passenden Shader-Loader. Falls Minecraft eine bereits verwendete ZIP-Datei unter Windows sperrt, das Paket zuerst im Spiel deaktivieren und neu laden. Vollständige Sicherungen und Wiederherstellungen werden bei beendetem Spiel ausgeführt.

Tests verwenden getrennte Datenordner und kontrollierte Spielzustände. Ein echter Microsoft-Anmelde- und Spieltest mit einer Java-Lizenz auf dem Ziel-PC ist davon getrennt.
