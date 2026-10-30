import React from 'react';
import { Download, RefreshCw, Check, LoaderCircle, ArrowUpRight, CircleAlert } from 'lucide-react';

export function UpdateNotice({ state, open }) {
  if (!state || !['available', 'downloading', 'downloaded'].includes(state.status)) return null;
  const text = state.status === 'downloaded' ? `Version ${state.version} ist bereit zum Installieren.` : state.status === 'downloading' ? `Update wird geladen · ${Math.round(state.progress)} %` : `Version ${state.version} ist verfügbar.`;
  return <div className="update-notice" role="status"><Download size={18}/><span>{text}</span><button className="text-button" onClick={open}>Update anzeigen <ArrowUpRight size={15}/></button></div>;
}

export function UpdateSettings({ state, run, onState, gameBusy }) {
  if (!state) return null;
  const pending = ['checking', 'downloading', 'installing'].includes(state.status);
  const ready = state.status === 'downloaded';
  const available = !!state.version && ['available', 'error'].includes(state.status);
  const text = {
    idle: 'Die automatische Update-Prüfung startet gleich.',
    disabled: 'Updates sind in diesem Test- oder Entwicklungsmodus deaktiviert.',
    checking: 'Neue Versionen werden gesucht …',
    current: 'Dein Launcher ist auf dem neuesten Stand.',
    available: `Version ${state.version} ist verfügbar.`,
    downloading: `Version ${state.version} wird heruntergeladen …`,
    downloaded: `Version ${state.version} ist bereit zum Installieren.`,
    installing: 'Der Installer wird geöffnet. Der Launcher startet danach neu.',
    error: state.error || 'Die Update-Prüfung ist fehlgeschlagen.'
  }[state.status];
  const invoke = method => run(async () => { const next = await window.carrot[method](); onState(next); });
  return <section className="settings-section" id="launcher-updates">
    <div className="settings-section-title"><RefreshCw size={20}/><div><h2>Launcher-Updates</h2><p>Neue Versionen von GitHub · Automatische Prüfung alle 60 Sekunden.</p></div></div>
    <div className="setting-block update-setting">
      <div className="update-version-line"><span className="badge">Installiert: v{state.currentVersion}</span>{state.version && <span className="badge">Neu: v{state.version}</span>}</div>
      <div className={`update-message ${state.status === 'error' ? 'failed' : ''}`} role="status">{pending ? <LoaderCircle className="spin" size={17}/> : state.status === 'error' ? <CircleAlert size={17}/> : ready || state.status === 'current' ? <Check size={17}/> : <Download size={17}/>}<span>{text}</span></div>
      {state.status === 'downloading' && <><div className="progress-track" role="progressbar" aria-label="Launcher-Update" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.progress)}><i style={{width:`${state.progress}%`}}/></div><p className="update-size">{(state.transferred / 1024 / 1024).toFixed(1)} / {(state.total / 1024 / 1024).toFixed(1)} MB · {Math.round(state.progress)} %</p></>}
      <div className="update-actions">
        <button className="button secondary compact" onClick={() => invoke('checkForUpdates')} disabled={!state.enabled || pending || ready}><RefreshCw size={15}/> Jetzt prüfen</button>
        {available && <button className="button primary compact" onClick={() => invoke('downloadUpdate')} disabled={pending}><Download size={15}/> Update herunterladen</button>}
        {ready && <button className="button primary compact" onClick={() => invoke('installUpdate')} disabled={gameBusy}><Download size={15}/> Update installieren</button>}
      </div>
      <p>{ready ? gameBusy ? 'Beende Minecraft und laufende Downloads, um das Update zu installieren.' : 'Das Update ist heruntergeladen. Erst „Update installieren“ startet die Installation.' : 'Herunterladen und Installieren sind getrennte Schritte. Beim Schließen wird nichts automatisch installiert.'}</p>
      {state.lastChecked && <small className="update-checked">Zuletzt geprüft: {new Date(state.lastChecked).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})}</small>}
    </div>
  </section>;
}
