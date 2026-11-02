import { t, getLocale } from "./i18n.js";
import React, { useEffect, useState } from 'react';
import { Download, FolderOpen, Upload, Box, LoaderCircle, Check } from 'lucide-react';
import { loaders, loaderName } from './loaders.js';
const api = window.carrot;
const errorText = e => e.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
const importError = value => {
  const separator = value.indexOf(': ');
  return separator < 0 ? t(value) : t(value.slice(0, separator)) + ': ' + t(value.slice(separator + 2));
};
const sources = [['modrinth', 'Modrinth'], ['laby', 'Laby Launcher'], ['lunar', 'Lunar Client'], ['norisk', 'NoRiskClient'], ['badlion', 'Badlion Client'], ['folder', 'Spielordner']];
export function ImportModal({
  Modal,
  close,
  versions,
  initialPack,
  onDone
}) {
  const [source, setSource] = useState('modrinth'),
    [result, setResult] = useState(null),
    [selected, setSelected] = useState(''),
    [version, setVersion] = useState(''),
    [manualLoader, setManualLoader] = useState('vanilla'),
    [pack, setPack] = useState(initialPack || null),
    [optional, setOptional] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = async fn => {
    setError('');
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (pack) return;
    let cancelled = false;
    setResult(null);
    setSelected('');
    setError('');
    api.scanImports(source).then(r => {
      if (!cancelled) setResult(r);
    }).catch(e => {
      if (!cancelled) setError(errorText(e));
    });
    return () => {
      cancelled = true;
    };
  }, [source, !!pack]);
  const profile = result?.profiles.find(p => p.id === selected);
  return <Modal title={t("Profile importieren")} subtitle={t("Übernimm Spielprofile oder importiere ein Modrinth-Modpack.")} wide close={() => {
    if (!busy) close();
  }} footer={<footer className="modal-footer"><span className="fine-print">{pack ? t("Das Paket wird als neue Instanz angelegt.") : t("Beende das Quellspiel, bevor du seine Spieldaten kopierst.")}</span><button className="button secondary" disabled={busy} onClick={close}>{t("Schließen")}</button></footer>}>
  <div className="import-intro"><Upload size={22} /><p>{t("Importiere eine ")}<strong>.mrpack-Datei</strong>{t(" oder kopiere Spieldaten aus einem anderen Launcher. Eine .mrpack-Datei kannst du auch ins Launcher-Fenster ziehen.")}</p><button className="button secondary compact" disabled={busy} onClick={() => run(async () => {
        const p = await api.chooseModpack();
        if (p) setPack(p);
      })}>{t("Modpack auswählen")}</button></div>
  {pack ? <div className="pack-preview"><h3>{pack.name}</h3><p>{pack.description}</p><span className="badge">{pack.version} · {loaderName(pack.loader)} {pack.loaderVersion} · {pack.files}{t(" Dateien")}</span>{pack.optional > 0 && <label className="checkbox-label"><input type="checkbox" checked={optional} onChange={e => setOptional(e.target.checked)} /> {pack.optional}{t(" optionale Client-Dateien mit installieren")}</label>}<div className="modal-row-actions"><button className="text-button" disabled={busy} onClick={() => setPack(null)}>{t("Andere Quelle wählen")}</button><button className="button primary compact" disabled={busy} onClick={() => run(async () => onDone(await api.importModpack({
          key: pack.key,
          optional
        })))}>{busy ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}{t(" Modpack importieren")}</button></div></div> : <>
   <div className="source-picker" aria-label={t("Quell-Launcher")}>{sources.map(([id, label]) => <button disabled={busy} key={id} className={source === id ? 'selected' : ''} onClick={() => setSource(id)}>{t(label)}</button>)}</div>
   <div className="tool-line"><p>{t("Automatische Suche in den üblichen Windows-Verzeichnissen.")}</p><button className="button secondary compact" disabled={busy} onClick={() => run(async () => {
          const r = await api.chooseImportFolder(source);
          if (r) {
            setResult(r);
            setSelected('');
          }
        })}><FolderOpen size={15} />{t(" Ordner auswählen")}</button></div>
   <div className="import-profiles">{!result ? <p>{t("Profile werden gesucht …")}</p> : !result.profiles.length ? <p>{t("Kein Profil automatisch gefunden. Wähle den Spielordner des Profils. Bei Laby: Modpack-Manager → „Open Fabric Directory“. Bei Lunar: Profil als Modrinth-Paket oder Minecraft-Ordner exportieren. Bei Badlion liegen gemeinsame Spieldaten normalerweise in .minecraft.")}</p> : result.profiles.map(p => <button disabled={busy} key={p.id} className={selected === p.id ? 'selected' : ''} onClick={() => {
          setSelected(p.id);
          setVersion('');
          setManualLoader(p.loader);
        }}><Box size={19} /><span><strong>{p.name}</strong><small>{p.version || t("Version auswählen")} · {p.loaderDetected ? p.loader : t("Loader auswählen")} {p.loaderVersion}</small><code>{p.path}</code></span>{selected === p.id && <Check size={17} />}</button>)}</div>
   {!!result?.errors.length && <div className="form-error">{result.errors.map(importError).join(' · ')}</div>}
   {profile && <div className="import-review"><h3>{t("Übernahme prüfen")}</h3><p>{t("Welten, Screenshots, kompatible Mods, Packs und Spieleinstellungen werden in eine neue Carrot-Instanz kopiert. Anmeldedaten und Java-Startbefehle werden nicht übernommen.")}</p>{profile.warnings.map((w, n) => <p className="import-warning" key={n}>{t(w)}</p>)}{!profile.version && <label className="field">{t("Minecraft-Version")}<select aria-label={t("Import Minecraft-Version")} value={version} onChange={e => setVersion(e.target.value)}><option value="">{t("Bitte passend zum Original auswählen")}</option>{versions?.versions.filter(v => v.type === 'release').map(v => <option key={v.id}>{v.id}</option>)}</select></label>}{!profile.loaderDetected && <label className="field">{t("Modloader bestätigen")}<select aria-label={t("Import Modloader")} value={manualLoader} onChange={e => setManualLoader(e.target.value)}>{loaders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}<p className="fine-print">{t("Carrot unterstützt Vanilla, Fabric, Forge, NeoForge und Quilt für jeweils verfügbare Minecraft-Versionen ab 1.16. Client-eigene Oberflächen und Cosmetics werden nicht nachgebildet; übertragbare Einstellungen bleiben gegebenenfalls als Referenz in imported-client-settings erhalten.")}</p><button className="button primary" disabled={busy || !loaders.map(l => l.id).includes(profile.loader) || !profile.version && !version} onClick={() => run(async () => onDone(await api.importProfile({
          id: selected,
          version,
          loader: manualLoader
        })))}>{busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{t(" Dieses Profil importieren")}</button></div>}
  </>}
  {error && <p className="form-error" role="alert">{t(error)}</p>}

 </Modal>;
}
export { default as InstancePage } from './InstancePage.jsx';
export { default as InstallProjectModal } from './InstallProjectModal.jsx';
