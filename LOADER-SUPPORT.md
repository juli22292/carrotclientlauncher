# Loader-Unterstützung ab 0.0.3

Instanzen speichern Minecraft-Version, Loader und dessen genaue Version getrennt. Die Verfügbarkeit wird vor einer neuen Instanz bzw. vor dem Versionswechsel geprüft. Importierte Pakete behalten ihre deklarierte Loader-Version; ein fehlender oder inkompatibler Build wird bei der Installation mit einer Meldung abgewiesen.

| Loader | Versionskatalog | Installation |
| --- | --- | --- |
| Vanilla | Offizielles Minecraft-Manifest | Offizielle Client-, Bibliotheks-, Asset- und Java-Metadaten |
| Fabric | `meta.fabricmc.net/v2/versions/loader/{minecraft}` | Offizielles Loader-Profil, Bibliotheken und Minecraft-Vererbung |
| Quilt | `meta.quiltmc.org/v3/versions/loader/{minecraft}` | Offizielles Profil über `/profile/json`, Quilt-Maven und Minecraft-Vererbung |
| Forge | `maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml` | Passender Installer mit veröffentlichter SHA-1-Prüfsumme, Ausführung mit `--installClient` im Carrot-Datenordner |
| NeoForge | NeoForged-Maven-Versions-API; für 1.20.1 die frühere `net.neoforged:forge`-Reihe | Passender offizieller Installer mit Prüfsumme und Client-Prozessoren |

Stabile Versionen werden bevorzugt und Versionsnummern numerisch sortiert. Eine bewusst gewählte Vorabversion ist gekennzeichnet. Eine nicht verfügbare Kombination wird nicht durch einen anderen Loader ersetzt. NeoForge-Versionen werden nach dem Schema der offiziellen Downloadseite der exakten Minecraft-Version zugeordnet, einschließlich des 26.x-Schemas.

Forge und NeoForge führen ihre vorgesehenen Patch-Prozessoren über die offizielle Installer-JAR aus. Der Launcher liefert eine eigene Launcher-Profildatei in seinem Datenverzeichnis und verwendet die zur Minecraft-Version passende Java-Generation. Er ändert keine fremde `.minecraft`-Installation. Die Ausführung ist abbrechbar, zeitlich begrenzt und schreibt ein lokales Installationsprotokoll. Generierte Bibliotheken ohne Download-URL werden geprüft und in den Startklassenpfad aufgenommen.

Bei der Vererbung ersetzen Loader-Bibliotheken gleichnamige Basisbibliotheken. JVM- und Spielargumente bleiben erhalten. Bei Forge-/NeoForge-Modulscans wird der tatsächlich verwendete Dateiname des ursprünglichen Minecraft-JARs der Ausschlussliste hinzugefügt; dadurch wird das Spiel nicht zugleich als ursprüngliches und als gepatchtes Java-Modul geladen.

Modrinth-Abfragen verwenden die genaue Minecraft-/Loader-Kombination. Forge, NeoForge, Fabric und Quilt werden nicht pauschal als austauschbar behandelt. Die Metadaten eines Mods müssen die Kombination unterstützen.

## Primärquellen

- [Forge: offizieller Client-Installationsablauf](https://github.com/MinecraftForge/Installer/blob/2.0/src/main/java/net/minecraftforge/installer/actions/ClientInstall.java) und [CLI](https://github.com/MinecraftForge/Installer/blob/2.0/src/main/java/net/minecraftforge/installer/SimpleInstaller.java).
- [NeoForged: Client-Installation](https://docs.neoforged.net/user/docs/client/), [offizielle Downloadseite](https://neoforged.net/) und [deren Versionszuordnung](https://neoforged.net/js/neoforge.js).
- [Quilt: offizieller Metadaten-Dienst](https://meta.quiltmc.org/index.html).
- [Fabric: offizieller Metadaten-Dienst](https://github.com/FabricMC/fabric-meta).

## Prüfung

`npm test` prüft Kataloge, Minecraft-Zuordnung, gepinnte Builds, Installer-Metadaten, Profilvererbung, generierte Bibliotheken, Modul-Ausschlüsse, Mod-Metadaten und Backups. `node scripts/instance-page-smoke.cjs` prüft die native Oberfläche.

Der bewusst separat gestartete Integrationstest `node scripts/loaders-live.cjs --launch` lädt und startet echte Loader in `test-results/loader-live`. Er verwendet ein ausdrücklich gewähltes Offline-Testprofil und beendet die Testprozesse nach erfolgreicher Initialisierung. Er liest keine fremden Konten oder Spielstände und ist wegen Downloads und Grafikfenstern kein Teil von `npm test`.

Geprüfte Kombinationen: Forge 52.1.20, NeoForge 21.1.265 und Quilt 0.30.2 auf Minecraft 1.21.1 (Java 21) sowie Forge 47.4.28 auf Minecraft 1.20.1 (Java 17). Andere Versionen werden anhand der offiziellen Kataloge angeboten; dies ist kein Einzeltest jedes angebotenen Builds.
