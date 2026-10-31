# CarrotClientLauncher

Ein eigenständiger Minecraft-Java-Launcher für Windows 10/11 (64 Bit), mit deutscher Oberfläche, eigener Instanzbibliothek, Modrinth-Installation und Profilimport. Aktuelle Version: **0.0.2**.

## Öffnen

**[Windows-Installer herunterladen](https://github.com/juli22292/carrotclientlauncher/releases/latest/download/carrotclientlaunchersetup.exe)** und `carrotclientlaunchersetup.exe` öffnen. Der Standardordner heißt `%LOCALAPPDATA%\Programs\CarrotClientLauncherApp`. Die Anwendung startet über die Verknüpfung **CarrotClientLauncher** oder über `carrotclientlauncher.exe` im Programmordner. Eine Installation für alle Benutzer ist im Assistenten ebenfalls möglich.

Zusätzlich liegt `release/carrotclientlauncher.exe` als portable Variante bei. Bestehende Instanzen und Profile bleiben im bisherigen Datenordner erhalten.

Auf der Startseite **Profil wählen** öffnen. Unter **Microsoft** die Anmeldung auf Microsofts Webseite abschließen oder unter **Cracked / Offline** einen Spielernamen wählen und **Offline-Profil verwenden** drücken. Anschließend **Neue Instanz** wählen, einen Namen, eine Minecraft-Version und Vanilla oder Fabric auswählen. Mit dem Play-Button werden Minecraft und bei Bedarf die passende Java-Laufzeit geladen. Eine Internetverbindung ist dafür nötig. Heruntergeladene Spieldateien und Java werden zwischen Instanzen wiederverwendet.

## Enthalten

- Eigene Instanzen mit Namen, vier Farben, Vanilla oder Fabric; Versionen ab Minecraft 1.16.
- Installation aus den offiziellen Minecraft- und Fabric-Metadaten, parallele Downloads, Prüfsummen, Wiederverwendung bereits geprüfter Dateien und Abbrechen von Downloads.
- Automatische, versionsgerechte Java-Laufzeit über Eclipse Temurin oder manuelle Auswahl von `java.exe`.
- Microsoft-Anmeldung mit Lizenz- und Profilprüfung, automatisch erneuerter Sitzung und Abmeldung; alternativ ein ausdrücklich gewähltes Offline-Profil mit Spielernamen und passender Offline-UUID.
- Das bereitgestellte Flussbild als Standardbild für Instanzen, Seitenleiste und Instanzdialoge.
- Arbeitsspeicher, Startauflösung, Snapshot-Auswahl und Minimierung beim Spielen.
- Discord Rich Presence: Hauptmenü im Launcher, Modloader und Minecraft-Version beim Spielen und ein Schalter zum Abschalten.
- Updates über die öffentlichen GitHub Releases: automatische Prüfung alle 60 Sekunden, Download und Installation getrennt per Schaltfläche.
- Live-Suche und direkte Installation von Modrinth-Mods, Shadern und Ressourcenpaketen mit Versionsprüfung und erforderlichen Abhängigkeiten; Mod-Updates und Aktivieren/Deaktivieren.
- `.mrpack`-Modpackimport über Dateiauswahl, Drag-and-drop oder die Modrinth-Suche, einschließlich passender Fabric-Version und Client-Overrides.
- Profilimport für Modrinth, Laby, Lunar, NoRisk und Badlion über erkannte Formate bzw. Spielordner/Standardexporte. Formatgrenzen stehen in [IMPORT-FORMATS.md](IMPORT-FORMATS.md).
- Eigene Instanzbilder und Symbole, Beschreibungen, Favoriten und zuletzt gespielte Instanz.
- Automatische Backups vor Mod- und Versionsänderungen, manuelle Sicherungen und Wiederherstellung mit zusätzlichem Rettungsbackup.
- Verständliche Absturzhinweise und bereinigter Diagnoseexport ohne automatischen Upload.
- Eigene Spielordner, gespeicherte Spielzeit, Spielprotokolle und Archivieren von Instanzen mit Erhalt der Welten.

## Profile, Mods und Sicherungen

**Profile importieren** öffnet die Auswahl der Quell-Launcher. Ein gefundenes Profil auswählen und vor dem Kopieren Version, Loader und Einschränkungen prüfen. Für verschobene Installationen **Ordner auswählen** nutzen. Alternativ eine `.mrpack` auswählen oder ins Fenster ziehen. Die Quelle bleibt erhalten. Kopiert werden unterstützte Spieldaten, keine fremden Anmeldesitzungen oder Java-Startbefehle. Client-eigene Oberflächen und Cosmetics werden nicht konvertiert. Vanilla und Fabric ab Minecraft 1.16 werden gestartet; weitere Loader und ältere Versionen werden abgewiesen.

Unter **Entdecken** ein Projekt öffnen, eine Zielinstanz wählen und **Installation prüfen** drücken. Erst **Jetzt installieren** übernimmt die angezeigten Dateien und erforderlichen Abhängigkeiten. Modpacks erhalten eine eigene neue Instanz. In der Instanzverwaltung findest du **Mods**, **Backups** und **Fehler & Logs** sowie eigene Bilder, Beschreibungen und den Versionswechsel.

**Einstellungen → Sicherungen → Automatische Backups** ist standardmäßig aktiv. Die letzten fünf automatischen Sicherungen werden behalten; manuelle Sicherungen werden nicht automatisch entfernt. Sicherungen liegen im Launcher-Datenordner unter `backups`. Ein Backup auf demselben Laufwerk ersetzt keine separate Sicherung gegen Laufwerksausfall. Diagnoseprotokolle vor dem Weitergeben trotz Filterung auf weitere private Inhalte prüfen.

## Launcher-Updates

Die Updatequelle ist ausschließlich das öffentliche Repository [juli22292/carrotclientlauncher](https://github.com/juli22292/carrotclientlauncher). Der installierte Launcher prüft beim Start und anschließend alle 60 Sekunden auf eine neuere stabile Version. Prüfungen überlappen nicht; während eines laufenden Update-Downloads oder bei einem bereits installationsbereiten Update wird kein zweiter Vorgang gestartet.

1. Der Hinweis auf eine neue Version öffnet **Einstellungen → Launcher-Updates**.
2. **Update herunterladen** lädt den Installer und prüft seine SHA-512-Prüfsumme anhand der Release-Metadaten.
3. **Update installieren** beendet den Launcher und startet den Installationsassistenten. Minecraft und laufende Installationsjobs müssen vorher beendet werden.

Herunterladen und Installieren sind ausdrücklich getrennt. Das normale Schließen installiert keine Updates automatisch. Der Launcher enthält keinen GitHub-Token; öffentliche Release-Dateien sind ohne Anmeldung abrufbar. Ein Downloadfehler kann erneut versucht werden. Der Standardinstaller erhält bestehende Profile, Instanzen und Spielstände.

## Microsoft-Anmeldung

Im Microsoft-Modus wird ein Microsoft-Konto mit aktiver Berechtigung für Minecraft: Java Edition und einem eingerichteten Java-Profil benötigt. Ohne ein ausdrücklich gewähltes Microsoft- oder Offline-Profil wird kein Spiel gestartet.

Die öffentliche Anwendungs-ID deiner eigenen App-Registrierung ist fest in `electron/config.cjs` hinterlegt: `2d4bee70-d128-4d81-9f2a-693b76ee6aab`. Sie ist kein Client-Geheimnis; Nutzer müssen keine eigene ID eintragen. Die Registrierung unterstützt persönliche Microsoft-Konten. Unter **Authentifizierung → Erweiterte Einstellungen → Öffentliche Clientflows zulassen** muss der Device-Code-Flow erlaubt sein. Für diesen Ablauf werden kein Client-Geheimnis und keine Redirect-URI benötigt. Die Objekt- und Verzeichnis-ID der Registrierung dienen der Zuordnung im Portal; die Anmeldung verwendet weiterhin den für persönliche Konten vorgesehenen `consumers`-Endpunkt.

1. Auf **Mit Microsoft anmelden** klicken. Microsofts Anmeldeseite öffnet sich im Standardbrowser.
2. Den im Launcher angezeigten Code kopieren und auf Microsofts Webseite eingeben.
3. Mit dem Konto anmelden, dem Minecraft gehört, und die Anmeldung für CarrotClientLauncher bestätigen.
4. Der Launcher prüft über Xbox und Minecraft Services die Java-Lizenz und das Profil. Erst danach wird das Konto verbunden.

Refresh- und Zugriffstokens werden nur lokal mit Electron `safeStorage` über den Windows-Schlüsselspeicher verschlüsselt gespeichert und nicht an die Oberfläche gegeben. Beim Spielen wird eine ablaufende Sitzung erneuert und die Berechtigung erneut geprüft. Abmelden entfernt die gespeicherte Sitzung. Ältere lokale Profilnamen und konfigurierbare Anwendungs-IDs werden bei der Migration entfernt; Instanzen und Welten bleiben erhalten.

### Noch erforderliche Freigabe und Prüfung

Die Konfiguration und der Anmeldeablauf werden mit kontrollierten Testantworten geprüft. Für die neue eigene Client-ID wurde kein Live-Anmeldeversuch ausgeführt. Die vollständige Kontobestätigung und die nachfolgenden Xbox-/Minecraft-Schritte erfordern die interaktive Anmeldung des Kontoinhabers auf dem gewünschten PC und stehen noch aus.

Neue Launcher-IDs benötigen zusätzlich eine Freigabe für Minecraft Services. Falls nach der Browser-Anmeldung die Meldung **„Minecraft verweigert dieser Launcher-App den Zugriff … HTTP 403“** erscheint, prüfe den Antrag für genau diese Client-ID unter [Mojangs App-ID-Prüfung](https://aka.ms/mce-reviewappid). Ein Microsoft-Anmeldecode allein bestätigt diese Freigabe noch nicht. Die Genehmigung ist ein externer Schritt; der Launcher kann sie nicht selbst erteilen.

## Cracked / Offline

Im Profildialog den Tab **Cracked / Offline** öffnen, einen Spielernamen mit 3 bis 16 Buchstaben, Ziffern oder Unterstrichen eingeben und **Offline-Profil verwenden** wählen. Das Profil wird gespeichert und beim nächsten Öffnen wieder ausgewählt. Seine Offline-UUID lässt sich im Dialog kopieren. Sie wird nach Minecraft-Konvention als UUID Version 3 aus `OfflinePlayer:<Spielername>` berechnet. Name und Groß-/Kleinschreibung bestimmen die UUID; Änderungen führen zu einer anderen Spieleridentität.

Diese Profile verwenden keine Microsoft-Zugriffstokens und keine Online-UUID. Sie eignen sich für Einzelspieler und Server, die Offline-Profile akzeptieren. Server mit aktivierter Microsoft-Authentifizierung und Realms benötigen weiterhin eine gültige Microsoft-Sitzung. Der Offline-Modus wird ausdrücklich ausgewählt; bei einer fehlgeschlagenen Microsoft-Anmeldung erfolgt kein automatischer Wechsel. Über den Tab **Microsoft** lässt sich zurückwechseln. Ein bereits gespeichertes Microsoft-Konto bleibt beim Moduswechsel erhalten; **Abmelden** entfernt beide gespeicherten Profile.

Für den ersten Download von Minecraft und Java ist auch mit Offline-Profil eine Internetverbindung erforderlich. Die separate Mojang-Freigabe betrifft weiterhin die Anmeldung bei Minecraft Services mit der eigenen Client-ID.

## Discord-Aktivität

Die eigene Discord-Anwendung **CarrotClientLauncher** mit der öffentlichen Application ID `1565491737235947671` ist bereits hinterlegt. Der Launcher verbindet sich lokal mit der laufenden Discord-Desktop-App. Bot-Token, Client Secret oder eine zusätzliche Discord-Anmeldung im Launcher werden nicht benötigt.

- Launcher geöffnet, ohne laufendes Spiel: **Aktiv im Hauptmenü**.
- Minecraft-Prozess gestartet: **Spielt {Loader} {Version}**, beispielsweise **Spielt Vanilla 1.21.1** oder **Spielt Fabric 1.21.1**.
- Spiel beendet oder abgestürzt: zurück zum Hauptmenü. Bei mehreren laufenden Spielen wird die zuletzt gestartete, noch laufende Instanz angezeigt.
- Launcher geschlossen oder **Einstellungen → Spiel & Launcher → Discord-Aktivität anzeigen** ausgeschaltet: Die Launcher-Aktivität wird entfernt.

Downloads und das Öffnen eines Instanzdialogs gelten noch nicht als Spielstart. Die Anzeige enthält keine Spielernamen, Instanznamen, Serveradressen oder Anmeldedaten. Das bereits hinterlegte Discord-App-Icon wird als Bild verwendet. Die Verbindung wird nach einem Discord-Neustart oder beim späteren Öffnen von Discord automatisch wiederhergestellt. Ohne Discord funktioniert der Launcher weiter.

In Discord muss das Teilen der Aktivität erlaubt sein; die Sichtbarkeit richtet sich nach den dortigen Privatsphäre-Einstellungen. Änderungen können einige Sekunden benötigen. Referenzen: [Discord Rich Presence](https://github.com/discord/discord-api-docs/blob/main/developers/discord-social-sdk/development-guides/setting-rich-presence.mdx), [Aktivitätseinstellungen](https://support.discord.com/hc/en-us/articles/7931156448919-Activity-Sharing-on-Discord-FAQ).

## Speicherort

`%APPDATA%\CarrotClientLauncher`

Unter **Einstellungen → Deine Dateien → Ordner öffnen** erreichbar. Jede Instanz besitzt `saves`, `mods`, `resourcepacks`, `shaderpacks` und `launcher-game.log`. Fabric-Instanzen benötigen für viele Mods zusätzlich die zur Spielversion passende Fabric API. Mods werden in dieser Version manuell in `mods` abgelegt. Welten archivierter Instanzen bleiben im Unterordner `archive` erhalten.

## Entwicklung

Node.js 22.12 oder neuer wird benötigt; getestet mit Node.js 24.

```powershell
npm install
npm run dev
```

Falls die lokale npm-Konfiguration den Electron-Installationsschritt blockiert:

```powershell
node node_modules/electron/install.js
```

```powershell
npm test                 # Anmeldung, Lizenzprüfung, Instanzen, Spielprozesse und Discord-IPC
node scripts/smoke.cjs    # Native UI mit kontrollierten Anmeldeantworten, ohne echte Kontoanmeldung
node scripts/portable-test.cjs # Die gebaute Windows-EXE prüfen
npm run dist             # Setup, portable EXE und Update-Metadaten bauen
node scripts/verify-release.cjs # Dateien und Prüfsummen des Releases prüfen
```

Die Tests verwenden getrennte temporäre Datenordner und verändern keine Benutzerinstanzen. Die Authentifizierungstests verwenden kontrollierte Antworten der Microsoft-, Xbox- und Minecraft-Dienste, um Erfolg, fehlende Berechtigung, Ablehnung, Ablauf, Abbruch und Token-Erneuerung zu prüfen. Auch der native UI-Test verwendet standardmäßig kontrollierte Microsoft-Antworten und öffnet keinen externen Browser. Mit `CARROT_LIVE_LOGIN_TEST=1` kann optional die echte Erstellung eines Microsoft-Anmeldecodes geprüft werden; auch dabei wird kein Konto angemeldet. Ein vollständiger Live-Test mit lizenziertem Konto und Spielstart steht bis zur interaktiven Anmeldung aus. Offline-Namensprüfung, UUID-Berechnung, Speichern und Wechsel der Profile sowie die tatsächlichen Startargumente werden mit kontrollierten Spielprozessen geprüft.

Die Discord-Tests verwenden einen eigenen lokalen IPC-Testserver und kontrollierte Spielprozesse. Sie prüfen Statuswechsel einschließlich Absturz und paralleler Instanzen, verspäteten Discord-Start, Wiederverbindung, fragmentierte Nachrichten, Fehler, Zeitüberschreitungen und das Entfernen der Aktivität. Die UI- und EXE-Tests deaktivieren Discord über `CARROT_DISABLE_DISCORD=1`, damit diese Tests keine Aktivität im echten Discord-Konto veröffentlichen.

Die Update-Tests prüfen den Minutentakt, getrennte Download-/Installationsaktionen, Fehler und Wiederholungen sowie die Sperre bei laufendem Spiel. UI- und EXE-Tests verwenden `CARROT_DISABLE_UPDATES=1`; der UI-Test simuliert die Update-Schaltflächen ohne einen echten Installer zu starten.

## Neue Version veröffentlichen

Die GitHub-Actions-Datei `.github/workflows/release.yml` läuft bei einem Push auf `main`. Für jede noch nicht veröffentlichte stabile Versionsnummer aus `package.json` werden Tests, Installer und portable EXE auf Windows gebaut. Die Release-Dateien und Prüfsummen werden zuerst hochgeladen; erst danach wird das Release öffentlich und als neueste Version markiert. Bereits veröffentlichte Versionen werden nicht überschrieben.

Für ein weiteres Update die Änderungen committen, die Versionsnummer erhöhen und pushen:

```powershell
npm version patch
git push origin main --follow-tags
```

Vor dem Versionsschritt muss der Arbeitsbaum sauber sein. Neue Funktionen können mit `npm version minor` eine neue Minor-Version bekommen. Der Workflow veröffentlicht `carrotclientlaunchersetup.exe`, `carrotclientlauncher.exe`, `carrotclientlaunchersetup.exe.blockmap`, `latest.yml` und `SHA256SUMS.txt`. GitHub stellt zusätzlich den Quellcode des Release-Tags als ZIP und TAR bereit. Der Workflow nutzt nur den temporären GitHub-Actions-Token mit `contents: write`.

Für Version 0.2.2 hat zusätzlich die installierte Discord-Desktop-App die Hauptmenü-Aktivität mit der eigenen Application ID und dem konfigurierten Bild bestätigt. Die Anzeige beim Spielen wurde mit kontrollierten Spielprozessen geprüft; ein echter Minecraft-Start benötigt weiterhin das lizenzierte Konto auf dem Ziel-PC.

## Gestaltung und Technik

Electron, React und Vite, mit isoliertem Renderer und schmaler IPC-Schnittstelle. Das Startseitenbanner verwendet den bereitgestellten Minecraft-Screenshot (`public/home-landscape.png`), der proportional auf die vorhandene Bannergröße zugeschnitten wird. Das neue Flussbild für Instanzen liegt unter `public/instance-landscape.png`. Das Karottenlogo ist eine eigene SVG-Grafik. Inter und Space Grotesk liegen lokal bei; die Oberfläche benötigt keinen externen Font-Dienst. Logo und Icon lassen sich mit `node scripts/art.cjs` und `node scripts/icon.cjs` neu generieren. Das Icon-Skript benötigt `sharp` (in der Codex-Umgebung mitgeliefert).

Unabhängiges Community-Projekt. Nicht mit Mojang, Microsoft oder Modrinth verbunden. Minecraft wird nicht mitgeliefert.
