# Minecraft-Anmeldung für CarrotClientLauncher 0.0.1

## Im Launcher bereits eingerichtet

- Öffentliche Microsoft-Anwendungs-ID deiner eigenen Registrierung: `2d4bee70-d128-4d81-9f2a-693b76ee6aab`.
- Microsoft-Anmeldung im Browser mit einem Code aus dem Launcher.
- Xbox-Anmeldung, Prüfung der Minecraft-Java-Lizenz und Laden des Java-Profils.
- Verschlüsselte Speicherung der Sitzung auf dem jeweiligen Windows-PC, automatische Erneuerung und Abmeldung.
- Im Microsoft-Modus setzt der Spielstart eine gültige Microsoft-Anmeldung voraus. Alternativ lässt sich unter Cracked / Offline ein eigenes Offline-Profil wählen.
- Bestehende Instanzen und Welten bleiben beim Update erhalten.

Offline-Profile sind für Einzelspieler und Server mit Offline-Modus vorgesehen und benötigen keine Microsoft-Anmeldung. Für Server mit Microsoft-Authentifizierung und Realms ist weiterhin das entsprechende Microsoft-Konto nötig.

Die Lizenz muss nicht auf dem Entwicklungs-PC eingerichtet werden. Der vollständige Anmelde- und Spieltest wird später auf dem gewünschten PC mit dem Microsoft-Konto durchgeführt, dem Minecraft: Java Edition gehört. Die EXE enthält keine Kontositzung und keine Zugangsdaten.

## Deine App-Registrierung

| Angabe | Wert |
| --- | --- |
| Anzeigename | CarrotClientLauncher |
| Anwendungs-ID (Client) | `2d4bee70-d128-4d81-9f2a-693b76ee6aab` |
| Objekt-ID | `eccdcb2b-a456-4d8d-8b28-9dc62395812a` |
| Verzeichnis-ID (Mandant) | `13651b2b-d08c-4bfe-b166-cb346e6b62fb` |
| Unterstützte Kontotypen | Persönliche Microsoft-Konten |

Für die Anmeldung verwendet der Launcher die Anwendungs-ID. Objekt- und Verzeichnis-ID werden im Microsoft-Portal zur Zuordnung benötigt; sie ersetzen den `consumers`-Anmelde-Endpunkt nicht. Gespeicherte Sitzungen einer anderen Client-ID werden nicht übernommen. Nach dem Wechsel ist eine erneute Anmeldung erforderlich.

## 1. Microsoft-App-Einstellungen prüfen

Öffne im [Microsoft-Entra-Portal](https://entra.microsoft.com/) die App-Registrierung mit der oben genannten **Anwendungs-ID**.

1. Die unterstützten Kontotypen müssen **persönliche Microsoft-Konten** einschließen. Sowohl „Nur persönliche Microsoft-Konten“ als auch eine Kombination mit Organisationskonten unterstützt diese Zielgruppe.
2. Unter **Authentifizierung → Erweiterte Einstellungen → Öffentliche Clientflows zulassen** die Einstellung **Ja** prüfen und gegebenenfalls speichern.
3. Für unseren Device-Code-Ablauf sind **kein Client-Geheimnis und keine Redirect-URI** erforderlich. Die Anwendung verwendet den `consumers`-Anmelde-Endpunkt und fordert `XboxLive.signin offline_access` an.

Referenz: [Microsoft: öffentliche Clientflows aktivieren](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration#enable-public-client-flow), [Microsoft: Device-Code-Verfahren](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code).

## 2. Minecraft-API-Zugriff beantragen beziehungsweise Freigabe abwarten

Neue Launcher-Anwendungs-IDs benötigen zusätzlich die Freigabe für Minecraft Services. Falls noch nicht erledigt, den Antrag unter [Mojangs App-ID-Prüfung](https://aka.ms/mce-reviewappid) für genau diese Client-ID ausfüllen. Einen bereits abgeschickten Antrag nicht mehrfach einreichen.

Halte App-Name, Client-ID, die Angaben deiner App-Registrierung und einen Projekt-/Webseitenlink bereit. Als sachliche Projektbeschreibung kannst du beispielsweise verwenden:

> CarrotClientLauncher is an independent Windows launcher for Minecraft: Java Edition. It signs users in through Microsoft's device authorization flow, exchanges Xbox Live and XSTS tokens with Minecraft Services, verifies Minecraft Java entitlements and loads the player's Java profile. Authentication tokens are encrypted locally using Windows-backed secure storage. The launcher starts the game only for an authenticated account with a verified Minecraft Java license.

Du prüfst die Angaben und Bedingungen im Formular und schickst den Antrag selbst ab. Microsoft-Anmeldung und Minecraft-API-Freigabe sind getrennte Schritte. Eine erfolgreiche Anmeldecode-Anfrage bestätigt noch keine Freigabe durch Mojang.

## 3. Auf dem gewünschten PC testen

1. `carrotclientlauncher.exe` auf den Ziel-PC kopieren und öffnen.
2. **Mit Microsoft anmelden** wählen. Der Launcher zeigt einen Code und öffnet Microsofts Anmeldeseite.
3. Den Code dort eingeben und mit dem Konto anmelden, dem **Minecraft: Java Edition** gehört. Den angezeigten App-Namen prüfen und die Anmeldung bestätigen.
4. Im Launcher müssen anschließend dein Minecraft-Spielername und die bestätigte Anmeldung erscheinen.
5. Eine Vanilla- oder Fabric-Instanz erstellen und starten. Minecraft und Java werden bei Bedarf automatisch heruntergeladen.

Bei **HTTP 403 beim Minecraft-Anmeldeschritt** die Freigabe für diese Client-ID prüfen. Bei **Öffentliche Clientflows zulassen** die Einstellung aus Schritt 1 kontrollieren. Meldungen zu fehlendem Java-Profil oder Xbox-/Familienfreigaben enthalten die erforderlichen nächsten Schritte für das betreffende Konto.

## Was geprüft wurde

36 automatisierte Hintergrundtests decken Anmeldung, Spielprozesse, Offline-UUIDs, Profilwechsel, Discord Rich Presence und Launcher-Updates ab. Der native Oberflächentest prüft zusätzlich Einstellungen, Instanzen und die Spielstart-Sperre. Die Microsoft-Anmeldeantworten sind in diesen Tests simuliert. Für die neue Client-ID wurde kein Live-Anmeldeversuch ausgeführt und kein echtes Minecraft-Benutzerkonto angemeldet. Die vollständige Live-Anmeldung und der anschließende Spielstart mit lizenziertem Konto stehen noch aus.
