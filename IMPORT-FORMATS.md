# Profilimport in 0.0.3

Formatrecherche: 31. Oktober 2026. Die Adapter sind eigenständig implementiert; fremder Launcher-Code wird nicht eingebunden.

## Unterstützte Wege

| Quelle | Erkennung und Übernahme | Grenze / manueller Weg |
| --- | --- | --- |
| Modrinth | `%APPDATA%/ModrinthApp` und `com.modrinth.theseus`; `app.db`/`theseus.db` mit älterer `profiles`-Tabelle bzw. `instances` + `instance_content_sets`; JSON-Profile und `.mrpack` | Benutzerdefinierten Datenordner auswählen. Datenbank ausschließlich lesend; keine Kontotabellen. |
| NoRiskClient | `%APPDATA%/norisk/NoRiskClientV3` bzw. `noriskclientv3`; `profiles.json`/`meta/profiles.json`; `meta/app.db` mit `profiles`/`profile_mods`; Spielordner und unterstützte Mods | Eigene NoRisk-Pakete und Oberflächen werden nicht als Fabric-Ersatz ausgeführt. Fehlende Mods benötigen eine zulässige Quelle mit Prüfsumme oder müssen im Quell-Launcher einmal installiert werden. |
| Laby Launcher | Laby-Einträge in `launcher_profiles.json` bzw. `launcher_profiles_microsoft_store.json`, Basisversion über lokale Versionsdefinition; manueller Spiel-/Fabric-Modordner | Kein stabiler öffentlicher Austauschvertrag für alle internen Daten dokumentiert. Den im Modpack-Manager angebotenen Fabric-Ordner auswählen; Version und gegebenenfalls Fabric bestätigen. Laby-HUD/Addons werden nicht nachgebildet. |
| Lunar Client | Erkannte `profile.json`-/`instance.json`-Spielordner unter `.lunarclient/profiles`; `.mrpack` und normale exportierte Minecraft-Spielordner; passende verschachtelte Fabric-Modordner | Bei nicht erkanntem internem Datenbankformat den Spielordner oder Standardexport auswählen. Eine beliebige interne Lunar-Datenbank wird nicht als gesichert kompatibel ausgegeben. Proprietäre Einstellungen bleiben nur als Referenz erhalten. |
| Badlion Client | Gemeinsamer `.minecraft`-Spielordner und bekannte Launcher-Profile; `BLClient-Mod-Profiles` als inaktive Einstellungsreferenz | Badlion-Mod-Profile sind HUD-/Client-Einstellungen und keine Fabric-Modpacks. Spielversion/Loader gegebenenfalls ausdrücklich wählen. Die Badlion-Oberfläche wird nicht nachgebaut. |

Alle Wege erstellen eine **neue Instanz**. Quellen werden nicht geändert. Übernommen werden erkannte Spielinhalte wie `saves`, `mods`, `config`, `resourcepacks`, `shaderpacks`, Screenshots und Minecraft-Optionen. Authentifizierungsdateien, fremde Java-Argumente, Konten, Runtime-Installer und Launcher-Bibliotheken gehören nicht dazu. Symbolische Verknüpfungen werden mit einer Meldung abgewiesen, statt außerhalb des Spielordners zu folgen.

Carrot startet **Vanilla, Fabric, Forge, NeoForge und Quilt ab 1.16**, soweit die gewählte Spielversion vom jeweiligen Loader unterstützt wird. Ein nicht unterstützter Loader wird nicht stillschweigend durch Vanilla ersetzt. Für proprietäre Client-Funktionen wird keine gleichwertige Konvertierung versprochen. Welten aus neueren Minecraft-Versionen dürfen nicht ohne geeignete Sicherung in älteren Versionen geöffnet werden.

## Modrinth-Modpacks

Unterstützt wird Formatversion 1 mit `modrinth.index.json`. Der Import prüft Pfade, Dateigrößen, zulässige HTTPS-Quellen und SHA-1/SHA-512-Prüfsummen. `overrides` wird vor `client-overrides` angewendet; `server-overrides` und clientseitig nicht unterstützte Dateien werden ausgelassen. Optionale Client-Dateien werden nur auf Wunsch installiert. Die Loader-Version aus `dependencies.fabric-loader`, `forge`, `neoforge` oder `quilt-loader` wird beibehalten. Pakete mit mehreren gleichzeitig deklarierten Loadern werden abgewiesen.

Es gelten 1 GB für das Archiv, 2 GB entpackt und 256 MB pro Eintrag. Download-Hosts stehen in `electron/network.cjs`. Pakete mit anderen Quellen werden mit einer Meldung abgewiesen. Die Vorbereitung erfolgt im Arbeitsverzeichnis; eine Instanz erscheint erst nach abgeschlossener Übernahme.

## Quellen der Formatprüfung

- [Modrinth: offizielles .mrpack-Format](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack).
- [Modrinth: Umstellung auf Instanzen und Content-Sets](https://github.com/modrinth/code/blob/main/packages/app-lib/migrations/20260619120000_finish-instance-profile-migration.sql). Zusätzlich lesend an einer installierten Modrinth-App geprüft.
- [Modrinth API: kompatible Versionen, Dateien und Abhängigkeiten](https://docs.modrinth.com/api/operations/getprojectversions/).
- [NoRisk: Profilstruktur](https://github.com/NoRiskClient/noriskclient-launcher/blob/v3/src-tauri/src/state/profile_state.rs), [SQLite-Schema](https://github.com/NoRiskClient/noriskclient-launcher/blob/v3/src-tauri/migrations/0002_profiles.sql), [Standardpfade](https://github.com/NoRiskClient/noriskclient-launcher/blob/v3/src-tauri/src/config.rs).
- [Laby: offizieller Support, Modpack-Manager und Öffnen des Fabric-/Forge-Verzeichnisses](https://laby.net/support).
- [Lunar: offizieller Profil- und Importleitfaden](https://support.lunarclient.com/solutions/how-to-create-a-lunar-client-profile). Er unterscheidet Minecraft-Version, Loader und optionale Lunar-Funktionen; daraus wird kein universelles natives Austauschformat abgeleitet.
- [Badlion: Mod-Profile und Speicherort](https://www.badlion.net/forum/thread/230088), [gemeinsame Mod-Profile](https://www.badlion.net/forum/thread/242813).

## Verifikation

`npm test` enthält Dateisystem- und Formatfixtures für alle fünf Quellen, aktuelle und ältere SQLite-/JSON-Strukturen, Client-/Server-Overrides, Abhängigkeiten, unzulässige Pfade und Backup-Wiederherstellung. `node scripts/library-smoke.cjs` prüft die Oberfläche in Electron einschließlich SQLite, `.mrpack`, Bildern, Favoriten, Wiederherstellung, Modrinth-Installation und Diagnoseexport. Diese Tests ersetzen keinen Test jeder real existierenden Version aller fünf Launcher.
