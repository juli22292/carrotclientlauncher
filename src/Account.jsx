import { t, getLocale } from "./i18n.js";
import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Copy, ExternalLink, LoaderCircle, LogIn, LogOut, ShieldCheck, UserRound, WifiOff } from 'lucide-react';
const api = window.carrot;
const message = error => error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
function MicrosoftMark() {
  return <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path fill="#f25022" d="M1 1h8v8H1z" /><path fill="#7fba00" d="M11 1h8v8h-8z" /><path fill="#00a4ef" d="M1 11h8v8H1z" /><path fill="#ffb900" d="M11 11h8v8h-8z" /></svg>;
}
export function AccountSettings({
  data,
  onAccount
}) {
  const offline = data.account?.type === 'offline';
  return <section className="settings-section">
    <div className="settings-section-title"><UserRound size={20} /><div><h2>{t("Dein Spielprofil")}</h2><p>{t("Microsoft-Konto oder Cracked / Offline auswählen.")}</p></div></div>
    <div className="setting-block account-setting">
      <div className="account-setting-icon"><UserRound size={23} /></div>
      <div><h3>{data.account?.name || t("Noch kein Profil ausgewählt")}</h3><p>{offline ? t("Cracked / Offline · Namensbasierte UUID") : data.account ? t("Microsoft · Minecraft: Java Edition · Lizenz geprüft") : t("Mit Microsoft anmelden oder einen Offline-Spielernamen wählen.")}</p></div>
      <button className="button secondary compact" onClick={onAccount}>{t("Profil wählen")}<ArrowRight size={15} /></button>
    </div>
  </section>;
}
export function AccountModal({
  Modal,
  data,
  close,
  notify
}) {
  const [login, setLogin] = useState(data.authState || {
    state: 'idle'
  });
  const [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState(data.account?.type === 'offline' ? 'offline' : 'microsoft');
  const [offlineName, setOfflineName] = useState(data.offlineProfile?.name || '');
  const [offlineError, setOfflineError] = useState('');
  const microsoft = data.microsoftAccount || (data.account?.type !== 'offline' ? data.account : null);
  useEffect(() => api.on('auth', setLogin), []);
  useEffect(() => {
    if (login.state !== 'waiting') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [login.state]);
  const begin = async () => {
    setBusy(true);
    try {
      await api.cancelLogin();
      const device = await api.beginLogin();
      setLogin(device);
      setNow(Date.now());
      try {
        await api.openExternal(device.url);
      } catch {
        notify(t("Die Microsoft-Seite konnte nicht automatisch geöffnet werden. Nutze die Schaltfläche im Dialog."), true);
      }
    } catch (error) {
      setLogin({
        state: 'error',
        error: message(error)
      });
    } finally {
      setBusy(false);
    }
  };
  const open = async () => {
    try {
      await api.openExternal(login.url);
    } catch (error) {
      notify(message(error), true);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(login.code);
      notify(t("Anmeldecode kopiert."));
    } catch {
      notify(t("Der Code konnte nicht kopiert werden. Du kannst ihn auf der Microsoft-Seite von Hand eingeben."), true);
    }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await api.logout();
      close();
      notify(t("Du bist abgemeldet."));
    } catch (error) {
      notify(message(error), true);
    } finally {
      setBusy(false);
    }
  };
  const chooseMode = async value => {
    if (value === mode) return;
    setBusy(true);
    try {
      await api.cancelLogin();
      if (value === 'microsoft' && data.account?.type === 'offline') await api.useMicrosoft();
      setMode(value);
      setLogin({
        state: 'idle'
      });
      setOfflineError('');
    } catch (error) {
      notify(message(error), true);
    } finally {
      setBusy(false);
    }
  };
  const saveOffline = async event => {
    event.preventDefault();
    setBusy(true);
    setOfflineError('');
    try {
      await api.useOffline(offlineName);
    } catch (error) {
      setOfflineError(message(error));
    } finally {
      setBusy(false);
    }
  };
  const copyUuid = async () => {
    try {
      await navigator.clipboard.writeText(data.offlineProfile.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'));
      notify(t("Offline-UUID kopiert."));
    } catch {
      notify(t("Die UUID konnte nicht kopiert werden."), true);
    }
  };
  const seconds = Math.max(0, Math.ceil((login.expiresAt - now) / 1000));
  const expired = login.state === 'waiting' && seconds === 0;
  const waiting = login.state === 'waiting' && !expired;
  const checking = login.state === 'verifying' || login.state === 'starting';
  return <Modal title={data.account ? t("Dein Spielprofil") : t("Willkommen bei CarrotClient")} subtitle={t("Wähle, mit welchem Profil du spielen möchtest.")} close={close} footer={mode === 'offline' ? <footer className="modal-footer"><button type="button" className="button secondary" onClick={data.account?.type === 'offline' ? logout : close} disabled={busy}>{data.account?.type === 'offline' ? t("Abmelden") : t("Schließen")}</button><button type="submit" className="button primary" disabled={busy || !/^[A-Za-z0-9_]{3,16}$/.test(offlineName.trim())}>{busy ? <LoaderCircle className="spin" size={16} /> : <UserRound size={16} />}{t(" Offline-Profil verwenden")}</button></footer> : microsoft && !waiting && !checking && login.state !== 'error' ? <footer className="modal-footer"><button className="button secondary" onClick={logout} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}{t(" Abmelden")}</button><button className="button primary" onClick={close}>{t("Alles klar ")}<Check size={16} /></button></footer> : waiting ? <footer className="modal-footer"><button className="button secondary" onClick={close}>{t("Abbrechen")}</button><button className="button primary" onClick={open}>{t("Microsoft-Seite öffnen ")}<ExternalLink size={16} /></button></footer> : checking ? <footer className="modal-footer"><button className="button secondary" onClick={close}>{t("Abbrechen")}</button></footer> : <footer className="modal-footer"><button className="button secondary" onClick={close}>{t("Schließen")}</button><button className="button primary microsoft-button" onClick={begin} disabled={busy}><MicrosoftMark />{login.state === 'error' || expired ? t("Erneut versuchen") : t("Mit Microsoft anmelden")}<LogIn size={16} /></button></footer>} form={mode === 'offline' ? {
    onSubmit: saveOffline
  } : undefined}>
    <div className="account-modes" role="tablist" aria-label={t("Anmeldeart")}>
      <button type="button" role="tab" aria-selected={mode === 'microsoft'} aria-controls="microsoft-panel" id="microsoft-tab" className={mode === 'microsoft' ? 'selected' : ''} onClick={() => chooseMode('microsoft')} disabled={busy}><MicrosoftMark /> Microsoft</button>
      <button type="button" role="tab" aria-selected={mode === 'offline'} aria-controls="offline-panel" id="offline-tab" className={mode === 'offline' ? 'selected' : ''} onClick={() => chooseMode('offline')} disabled={busy}><WifiOff size={16} /> Cracked / Offline</button>
    </div>
    {mode === 'offline' ? <div id="offline-panel" role="tabpanel" aria-labelledby="offline-tab">
      <div className="login-intro offline-intro"><div className="login-intro-icon"><WifiOff size={26} /></div><h3>{t("Offline-Profil")}</h3><p>{t("Wähle einen Spielernamen für dein Offline-Profil.")}</p></div>
      <>
        <label className="field">{t("Offline-Spielername")}<input value={offlineName} onChange={e => setOfflineName(e.target.value)} minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" placeholder={t("Zum Beispiel: CarrotPlayer")} required autoComplete="off" spellCheck={false} /></label>
        <p className="offline-name-hint">{t("3–16 Zeichen · Buchstaben, Zahlen und Unterstriche")}</p>
        {data.offlineProfile && <div className="offline-uuid"><span>{t("UUID für ")}{data.offlineProfile.name}</span><div><code>{data.offlineProfile.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')}</code><button type="button" className="icon-button tiny" onClick={copyUuid} aria-label={t("Offline-UUID kopieren")}><Copy size={15} /></button></div></div>}
        <div className="info-note"><WifiOff size={18} /><p>{t("Für Einzelspieler und Server mit Offline-Modus. Server mit Microsoft-Authentifizierung benötigen ein Microsoft-Konto. Ein anderer Name oder eine andere Schreibweise erhält eine andere UUID.")}</p></div>
        {offlineError && <div className="login-error" role="alert"><CircleAlert size={18} /><p>{t(offlineError)}</p></div>}

      </>
    </div> : <div id="microsoft-panel" role="tabpanel" aria-labelledby="microsoft-tab">
    {microsoft && !waiting && !checking && login.state !== 'error' ? <>
      <div className="account-modal-profile"><div className="avatar large"><span /><i /><b /></div><div><h3>{microsoft.name}</h3><p>{t("Microsoft-Konto · Minecraft: Java Edition")}</p></div><ShieldCheck size={23} /></div>
      <div className="account-verified"><Check size={15} />{t(" Minecraft-Lizenz und Java-Profil geprüft")}</div>
      <p className="modal-paragraph">{t("Deine Microsoft-Anmeldung wird beim Spielen automatisch erneuert.")}</p>

    </> : waiting ? <>
      <div className="login-step"><span>1</span><div><h3>{t("Kopiere deinen Anmeldecode")}</h3><p>{t("Dieser Code verbindet ausschließlich deine aktuelle Anmeldung.")}</p></div></div>
      <button className="device-code" onClick={copy} aria-label={t("Anmeldecode kopieren")}>{login.code}<Copy size={18} /></button>
      <div className="login-step"><span>2</span><div><h3>{t("Bei Microsoft anmelden")}</h3><p>{t("Gib den Code auf der geöffneten Microsoft-Seite ein und bestätige die Anmeldung für CarrotClientLauncher.")}</p></div></div>
      <div className="login-wait" role="status"><LoaderCircle className="spin" size={16} />{t(" Warten auf deine Anmeldung … ")}<span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>

    </> : checking ? <>
      <div className="login-checking"><LoaderCircle className="spin" size={30} /><h3>{login.state === 'starting' ? t("Anmeldung wird vorbereitet …") : t("Dein Minecraft-Konto wird geprüft …")}</h3><p>{t("Das dauert einen kleinen Moment.")}</p></div>

    </> : <>
      <div className="login-intro"><div className="login-intro-icon"><UserRound size={32} /></div><h3>{t("Mit Microsoft anmelden")}</h3><p>{t("Melde dich mit deinem Microsoft-Konto an, dem Minecraft: Java Edition gehört.")}</p></div>
      {(login.state === 'error' || expired) && <div className="login-error" role="alert"><CircleAlert size={19} /><p>{expired ? t("Der Code ist abgelaufen. Starte eine neue Anmeldung.") : t(login.error)}</p></div>}
      <div className="info-note"><ShieldCheck size={18} /><p>{t("Du meldest dich direkt bei Microsoft im Browser an. Anschließend prüfen wir deine Minecraft-Lizenz und laden dein Java-Profil.")}</p></div>

    </>}
    </div>}
  </Modal>;
}
