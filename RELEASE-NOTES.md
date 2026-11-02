## CarrotClientLauncher 0.0.6

Die Oberfläche wurde überarbeitet und lässt sich jetzt vollständig zwischen Deutsch und Englisch umschalten. Die Auswahl steht oben rechts sowie in den Einstellungen und wird für den nächsten Start gespeichert.

- **Einheitliche Darstellung:** Überarbeitete Tabs, Suchfelder, Abstände und Schriftgrößen in Bibliothek, Instanzen und Entdecken. Eingabefelder teilen sich den verfügbaren Platz korrekt mit Symbolen und Schaltflächen.
- **Loader-Kacheln korrigiert:** Eine alte Breitenvorgabe wurde entfernt. Die Kacheln füllen ihre Rasterspalten und ordnen sich bei wenig Platz passend an.
- **Übersichtliche Dialoge:** Titel und Aktionsknöpfe bleiben sichtbar; lange Inhalte haben einen eigenen scrollbaren Bereich. Formulare und Tastaturbedienung funktionieren weiterhin.
- **Kleine Fenster:** Das Startfenster berücksichtigt den verfügbaren Bildschirmbereich. Bei schmaleren Fenstern wird die Navigation zur Symbolleiste mit Beschriftungen beim Darüberfahren.
- **Deutsch und Englisch:** Navigation, Einstellungen, Profilwahl, Anmeldedialoge, Import, Installationen, Sicherungen, Hinweise, Update-Anzeigen, launcher-eigene Fehlermeldungen und Dateidialogtitel sind übersetzt. Zahlen und Datumsangaben folgen der Sprache.
- **Discord und Diagnose:** Die Discord-Aktivität und launcher-eigene Diagnosehinweise verwenden ebenfalls die ausgewählte Sprache.
- **Entdecken:** Klar erkennbare Auswahl des Inhaltstyps, getrenntes Suchfeld, beschriftete Kategorien und Bedienung der Tabs mit Pfeiltasten, Pos1 und Ende.
- **Bestehende Abläufe erhalten:** Innerhalb einer Instanz bleibt das Installationsziel fest. Neue Modpacks erhalten eine eigene Instanz. Ressourcenpakete und Shader können weiterhin bei laufendem Spiel hinzugefügt werden; Mods benötigen ein beendetes Spiel.

### Prüfung

73 automatisierte Tests prüfen unter anderem Sprachspeicherung und Migration, Platzhalter in allen Übersetzungen, Discord, Diagnoseexport, Profile, Installationen und Sicherungen. Native Oberflächentests prüfen beide Sprachen, Dialoge, Tastaturbedienung, unveränderte Profilnamen, Fehlerantworten und Fensterbreiten von 900 bis 1440 Pixeln. Installer, portable EXE und Update-Dateien werden vor der Veröffentlichung zusätzlich geprüft.

### Windows-Dateien

carrotclientlaunchersetup.exe installiert weiterhin nach CarrotClientLauncherApp. Die Anwendung und die portable EXE heißen carrotclientlauncher.exe. Herunterladen und Installieren von Launcher-Updates bleiben getrennte Schritte.

Instanznamen, Dateinamen, Mod-/Modpacktitel und Beschreibungen der Community bleiben in ihrer Originalfassung. Die Sprache systemeigener Windows-Bedienelemente richtet sich nach Windows.

Die Prüfungen verwenden getrennte Datenordner und kontrollierte Anmelde- und Spielzustände. Ein echter Spielstart mit einem lizenzierten Microsoft-Konto ist davon getrennt.
