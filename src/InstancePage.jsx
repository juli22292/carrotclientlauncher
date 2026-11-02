import { t, getLocale } from "./i18n.js";
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Box, Check, Download, FolderOpen, Image, LoaderCircle, Package, Play, Plus, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Star, Trash2, WandSparkles, X, FileText, Clock3 } from 'lucide-react';
import { loaderName } from './loaders.js';
import LoaderPicker from './LoaderPicker.jsx';
const api = window.carrot;
const labels = {
  mod: 'Mod',
  resourcepack: 'Ressourcenpaket',
  shader: 'Shader'
};
const icons = {
  mod: Box,
  resourcepack: Package,
  shader: WandSparkles
};
const date = value => new Date(value).toLocaleString(getLocale());
const errorText = e => e.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
const size = n => n >= 1048576 ? `${(n / 1048576).toLocaleString(getLocale(), {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
export default function InstancePage({
  instance: i,
  versions,
  busy: gameBusy,
  close,
  launch,
  archive,
  discover,
  install,
  notify,
  Modal,
  initialTab = 'mods',
  onTabChange,
  account,
  running
}) {
  const [tab, setTab] = useState(initialTab),
    [name, setName] = useState(i.name),
    [description, setDescription] = useState(i.description || '');
  const [version, setVersion] = useState(i.version),
    [loader, setLoader] = useState(i.loader),
    [loaderVersion, setLoaderVersion] = useState(i.loaderVersion || ''),
    [loaderReady, setLoaderReady] = useState(true);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [type, setType] = useState('all'),
    [sort, setSort] = useState('name');
  const [content, setContent] = useState([]),
    [backups, setBackups] = useState([]),
    [logs, setLogs] = useState(null),
    [updates, setUpdates] = useState([]);
  const [confirm, setConfirm] = useState(null),
    [importType, setImportType] = useState(i.loader === 'vanilla' ? 'resourcepack' : 'mod');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  const localBusy = useRef(false);
  const blocked = gameBusy || busy || running;
  const mutationBlocked = type => gameBusy || busy || running && type === 'mod';
  const confirmBlocked = gameBusy || busy || running && (confirm?.kind === 'import' ? importType === 'mod' : confirm?.kind === 'remove' ? confirm.item.type === 'mod' : true);
  const tabs = [['mods', t("Inhalte"), Box], ['overview', t("Einstellungen"), Settings], ['backups', t('Sicherungen'), ShieldCheck], ['logs', t("Fehler & Logs"), FileText]];
  useEffect(() => {
    setVersion(i.version);
    setLoader(i.loader);
    setLoaderVersion(i.loaderVersion || '');
  }, [i.version, i.loader, i.loaderVersion]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const request = tab === 'mods' ? api.getContent(i.id) : tab === 'backups' ? api.listBackups(i.id) : tab === 'logs' ? api.getDiagnostics(i.id) : Promise.resolve(null);
    request.then(value => {
      if (!active) return;
      if (tab === 'mods') setContent(value);
      if (tab === 'backups') setBackups(value);
      if (tab === 'logs') setLogs(value);
    }).catch(e => {
      if (active) setError(errorText(e));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tab, i, reload]);
  const run = async fn => {
    if (localBusy.current) return;
    localBusy.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
      setReload(n => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      localBusy.current = false;
      setBusy(false);
    }
  };
  const changeTab = value => {
    setTab(value);
    onTabChange?.(value);
    setError('');
  };
  const shown = content.filter(m => (type === 'all' || m.type === type) && (filter === 'all' || m.enabled === (filter === 'enabled')) && `${m.name} ${m.file} ${m.version}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'size' ? b.size - a.size : a.name.localeCompare(b.name, getLocale()) * (sort === 'name-desc' ? -1 : 1));
  const updateFor = m => updates.find(u => u.file === m.file);
  const confirmTitle = confirm?.kind === 'restore' ? t("Sicherung wiederherstellen?") : confirm?.kind === 'version' ? t("Minecraft-Version wechseln?") : confirm?.kind === 'remove' ? t("Datei entfernen?") : confirm?.kind === 'import' ? t("Dateien hinzufügen") : t("Mod-Update installieren?");
  return <section className="instance-page instance-workspace" aria-label={t("Instanzverwaltung")}>
    <div className="instance-back"><button className="text-button" onClick={close}><ArrowLeft size={16} />{t(" Zurück zur Bibliothek")}</button><span>{account ? `${account.type === 'offline' ? 'Offline' : 'Microsoft'} · ${account.name}` : t("Zum Spielen ein Profil wählen")}</span></div>
    <header className="instance-heading-bar">
      <img className="instance-heading-image" src={i.icon || i.cover || './instance-landscape.png'} alt="" />
      <div className="instance-heading-copy"><div className="eyebrow">{i.modpack ? t("MODPACK") : t("INSTANZ")}</div><h1>{i.name}<span className="heading-dot">.</span></h1><div className="instance-meta"><span><Box size={14} />{loaderName(i.loader)} {i.version}</span><span><Clock3 size={14} />{i.playtime >= 3600 ? t("{0} Std.", {
              0: Math.floor(i.playtime / 3600)
            }) : t("{0} Min.", {
              0: Math.floor((i.playtime || 0) / 60)
            })}{t(" gespielt")}</span><span className={running ? 'ready-label' : ''}>{running ? t("Minecraft läuft") : i.installed ? t("Bereit zum Spielen") : t("Download beim ersten Start")}</span></div></div>
      <div className="instance-primary-actions"><button className={`icon-button ${i.favorite ? 'is-favorite' : ''}`} disabled={busy} aria-label={i.favorite ? t("Aus Favoriten entfernen") : t("Als Favorit markieren")} onClick={() => run(() => api.updateInstance(i.id, {
          favorite: !i.favorite
        }))}><Star size={19} fill={i.favorite ? 'currentColor' : 'none'} /></button><button className="button primary" disabled={blocked} onClick={launch}>{gameBusy ? <LoaderCircle size={17} className={running ? '' : 'spin'} /> : <Play size={17} />} {running ? t("Spiel läuft") : gameBusy ? t("Bitte warten") : account ? t("Spielen") : t("Profil wählen")}</button></div>
    </header>
    {i.description && <p className="instance-description">{i.description}</p>}
    <div className="tool-tabs workspace-tabs" role="tablist" aria-label={t("Instanzverwaltung")}>{tabs.map(([id, title, Icon], index) => <button id={`instance-tab-${id}`} aria-controls="instance-panel" key={id} role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} disabled={busy} className={tab === id ? 'active' : ''} onClick={() => changeTab(id)} onKeyDown={e => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          changeTab(tabs[next][0]);
          document.getElementById(`instance-tab-${tabs[next][0]}`)?.focus();
        }
      }}><Icon size={16} />{t(title)}{id === 'mods' && tab === 'mods' && !loading && <span>{content.length}</span>}</button>)}</div>
    {error && <div className="form-error workspace-error" role="alert">{t(error)}<button className="text-button" onClick={() => setReload(n => n + 1)}>{t("Erneut laden")}</button></div>}
    <div className="tool-panel" id="instance-panel" role="tabpanel" aria-labelledby={`instance-tab-${tab}`} aria-busy={busy || loading}>
      {tab === 'mods' && <>
        <div className="content-toolbar"><div className="search-field"><Search size={18} /><input aria-label={t("Installierte Inhalte suchen")} value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Name, Version oder Datei suchen …")} />{query && <button className="icon-button tiny" aria-label={t("Inhaltssuche löschen")} onClick={() => setQuery('')}><X size={15} /></button>}</div><button className="button secondary compact" disabled={gameBusy || busy || running && type === 'mod'} onClick={() => {
            setImportType(type === 'all' ? i.loader === 'vanilla' || running ? 'resourcepack' : 'mod' : type);
            setConfirm({
              kind: 'import'
            });
          }}><Plus size={16} />{t(" Dateien hinzufügen")}</button><button className="button primary compact" onClick={() => discover(type === 'all' ? 'mod' : type)}><Search size={16} />{t(" Inhalte entdecken")}</button></div>
        {running && <p className="runtime-content-note">{t("Minecraft läuft. Ressourcenpakete und Shader kannst du hinzufügen und im Spiel auswählen. Beende das Spiel, bevor du Mods änderst.")}</p>}<div className="content-filters"><div className="filter-pills" aria-label={t("Inhaltstyp")}>{[['all', t("Alle")], ['mod', 'Mods'], ['resourcepack', t("Ressourcenpakete")], ['shader', 'Shader']].map(([id, label]) => <button key={id} aria-pressed={type === id} className={type === id ? 'active' : ''} onClick={() => setType(id)}>{t(label)}</button>)}</div><select aria-label={t("Inhaltsstatus filtern")} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{t("Alle Zustände")}</option><option value="enabled">{t("Aktiviert")}</option><option value="disabled">{t("Deaktiviert")}</option></select><select aria-label={t("Inhalte sortieren")} value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="size">{t("Größe")}</option></select></div>
        <div className="content-summary"><span>{loading ? t("Dateien werden gelesen …") : t("{0} von {1} Dateien · {2} aktiviert", {
              0: shown.length,
              1: content.length,
              2: content.filter(m => m.enabled).length
            })}</span><div><button className="text-button" disabled={blocked || !content.some(m => m.type === 'mod')} onClick={() => run(async () => {
              setUpdates(await api.getModUpdates(i.id));
              notify('Suche nach kompatiblen Mod-Updates abgeschlossen.');
            })}><RefreshCw size={14} />{t(" Updates suchen")}</button><button className="icon-button" aria-label={t("Inhalte neu einlesen")} disabled={busy} onClick={() => setReload(n => n + 1)}><RotateCcw size={16} /></button></div></div>
        {loading && !content.length ? <p className="tool-working" role="status"><LoaderCircle size={16} className="spin" />{t(" Inhalte werden geladen …")}</p> : !shown.length ? <div className="content-empty"><Box size={32} /><h3>{content.length ? t("Keine passenden Dateien") : t("Hier erscheinen deine Mods und Pakete")}</h3><p>{content.length ? t("Ändere den Suchbegriff oder setze die Filter zurück.") : t("Installiere Inhalte von Modrinth oder füge vorhandene JAR- und ZIP-Dateien hinzu.")}</p>{content.length ? <button className="button secondary compact" onClick={() => {
            setQuery('');
            setType('all');
            setFilter('all');
          }}>{t("Filter zurücksetzen")}</button> : <button className="button primary compact" onClick={() => discover(type === 'all' ? 'mod' : type)}>{t("Inhalte entdecken")}</button>}</div> : <div className="content-table" role="table" aria-label={t("Installierte Inhalte")}><div className="content-table-head" role="row"><span role="columnheader">{t("Inhalt")}</span><span role="columnheader">{t("Version / Größe")}</span><span role="columnheader">{t("Aktionen")}</span></div>{shown.map(m => {
            const Icon = icons[m.type],
              update = updateFor(m);
            return <div role="row" key={`${m.folder}/${m.file}`} className={`content-row ${m.enabled ? '' : 'disabled-content'}`}><div className="content-name" role="cell"><div className="content-file-icon"><Icon size={22} />{m.iconUrl?.startsWith('https://cdn.modrinth.com/') && <img src={m.iconUrl} alt="" loading="lazy" onError={e => {
                    e.currentTarget.style.display = 'none';
                  }} />}</div><div><strong>{m.name}</strong><small title={m.file}>{m.file}</small><span className="content-kind">{t(labels[m.type])}{!m.enabled && t(" · deaktiviert")}</span></div></div><div className="content-version" role="cell"><strong>{m.version || t("Lokale Datei")}</strong><small>{size(m.size)}</small></div><div className="content-actions" role="cell">{update && <button className="icon-button update-available" aria-label={t("{0} aktualisieren", {
                  0: m.name
                })} title={t("Update auf {0}", {
                  0: update.versionNumber
                })} disabled={mutationBlocked(m.type)} onClick={() => run(async () => setConfirm({
                  kind: 'mod',
                  plan: await api.planProject(i.id, update.projectId, update.versionId),
                  update
                }))}><Download size={17} /></button>}<button role="switch" aria-label={t("{0} aktivieren", {
                  0: m.name
                })} aria-checked={m.enabled} className={`toggle ${m.enabled ? 'on' : ''}`} disabled={mutationBlocked(m.type)} onClick={() => run(() => api.toggleContent(i.id, m.folder, m.file))}><span /></button><button className="icon-button" aria-label={t("{0} entfernen", {
                  0: m.name
                })} title={t("Datei entfernen")} disabled={mutationBlocked(m.type)} onClick={() => setConfirm({
                  kind: 'remove',
                  item: m
                })}><Trash2 size={17} /></button></div></div>;
          })}</div>}
        <p className="content-help">{t("Ressourcenpakete und Shader wählst du anschließend im Spiel aus. Ordner und weitere Dateien erreichst du über „Instanzordner“.")}</p>
      </>}
      {tab === 'overview' && <div className="instance-overview-grid"><section className="instance-settings-card"><h3>{t("Name und Darstellung")}</h3><label className="field">{t("Name der Instanz")}<input maxLength={40} value={name} onChange={e => setName(e.target.value)} /></label><label className="field">{t("Beschreibung")}<textarea maxLength={300} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder={t("Zum Beispiel: Survival mit Freunden")} /></label><div className="modal-row-actions"><button className="button secondary compact" disabled={busy || !name.trim() || name === i.name && description === (i.description || '')} onClick={() => run(async () => {
              await api.updateInstance(i.id, {
                name,
                description
              });
              notify('Instanz gespeichert.');
            })}><Check size={15} />{t(" Speichern")}</button><button className="button secondary compact" disabled={busy} onClick={() => run(() => api.chooseInstanceImage(i.id, 'cover'))}><Image size={15} />{t(" Eigenes Bild")}</button><button className="button secondary compact" disabled={busy} onClick={() => run(() => api.chooseInstanceImage(i.id, 'icon'))}><Image size={15} />{t(" Eigenes Symbol")}</button>{(i.cover || i.icon) && <button className="text-button" disabled={busy} onClick={() => run(() => api.updateInstance(i.id, {
              cover: '',
              icon: ''
            }))}>{t("Bilder zurücksetzen")}</button>}</div></section><section className="version-editor instance-settings-card"><h3>{t("Version & Modloader")}</h3><p>{t("Vor dem Wechsel wird bei aktivierten automatischen Backups eine Sicherung angelegt. Prüfe danach, ob deine Mods zur neuen Version passen. Öffne neuere Welten nicht mit einer älteren Minecraft-Version.")}</p><label className="field">{t("Minecraft-Version")}<select aria-label={t("Neue Minecraft-Version")} value={version} onChange={e => {
              setVersion(e.target.value);
              setLoaderVersion('');
            }}>{!versions && <option value={version}>{version}</option>}{versions?.versions.map(v => <option key={v.id}>{v.id}</option>)}</select></label><LoaderPicker gameVersion={version} loader={loader} loaderVersion={loaderVersion} onChange={(l, v) => {
            setLoader(l);
            setLoaderVersion(v);
          }} onAvailability={setLoaderReady} /><button className="button secondary compact" disabled={blocked || !loaderReady || version === i.version && loader === i.loader && loaderVersion === (i.loaderVersion || '')} onClick={() => setConfirm({
            kind: 'version'
          })}>{t("Versionswechsel vorbereiten")}</button></section></div>}
      {tab === 'backups' && <><div className="tool-line"><p>{t("Die letzten fünf automatischen Backups bleiben erhalten. Manuelle Sicherungen werden nicht automatisch gelöscht.")}</p><button className="button secondary compact" disabled={blocked} onClick={() => run(async () => {
            await api.createBackup(i.id);
            notify('Sicherung erstellt.');
          })}><ShieldCheck size={16} />{t(" Backup erstellen")}</button></div><div className="tool-list">{loading ? <p className="tool-empty">{t("Sicherungen werden gelesen …")}</p> : !backups.length ? <p className="tool-empty">{t("Noch kein Backup vorhanden. Erstelle eine erste Sicherung deiner Instanz.")}</p> : backups.map(b => <div className="mod-row" key={b.id}><ShieldCheck size={18} /><span><strong>{t(b.reason)}</strong><small>{b.folders ? b.folders.map(f => ({
                  mods: 'Mods',
                  resourcepacks: t("Ressourcenpakete"),
                  shaderpacks: 'Shader'
                })[f]).join(', ') : t("Komplette Spieldaten")} · {date(b.createdAt)} · {b.version} / {loaderName(b.loader)}</small></span><button className="button secondary compact" disabled={blocked} onClick={() => setConfirm({
              kind: 'restore',
              backup: b
            })}><RotateCcw size={15} />{t(" Wiederherstellen")}</button></div>)}</div></>}
      {tab === 'logs' && (loading ? <p className="tool-working">{t("Protokoll wird gelesen …")}</p> : logs && <><h3>{t(logs.title)}</h3><p className="diagnosis-help">{t(logs.help)}</p><p className="fine-print">{t("Das Protokoll wird vor dem Export um bekannte persönliche Daten bereinigt. Prüfe es trotzdem vor dem Weitergeben. Es wird nichts hochgeladen.")}</p><pre className="log-preview">{logs.text}</pre><button className="button secondary compact" disabled={busy} onClick={() => run(async () => {
          if (await api.exportDiagnostics(i.id)) notify('Bereinigtes Protokoll gespeichert.');
        })}><FileText size={15} />{t(" Bereinigtes Protokoll speichern")}</button></>)}
      {busy && <p className="tool-working" role="status"><LoaderCircle className="spin" size={16} />{t(" Änderung wird ausgeführt …")}</p>}
    </div>
    <footer className="instance-workspace-footer"><button className="text-button" onClick={() => run(() => api.openFolder(i.id))}><FolderOpen size={16} />{t(" Instanzordner")}</button><span>{i.importedFrom ? t("Importiert aus {0}", {
          0: i.importedFrom
        }) : t("Eigener Spielordner")}</span><div>{!i.installed && <button className="text-button" disabled={blocked} onClick={install}><Download size={15} />{t(" Nur installieren")}</button>}<button className="text-button danger" disabled={blocked} onClick={archive}>{t("Instanz archivieren")}</button></div></footer>
    {confirm && <Modal title={confirmTitle} close={() => {
      if (!busy) setConfirm(null);
    }} footer={<footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>{t("Abbrechen")}</button><button className="button primary" disabled={confirmBlocked} onClick={() => run(async () => {
        if (confirm.kind === 'restore') {
          await api.restoreBackup(i.id, confirm.backup.id);
          notify('Sicherung wiederhergestellt.');
        }
        if (confirm.kind === 'version') {
          await api.changeInstanceVersion(i.id, {
            version,
            loader,
            loaderVersion
          });
          setUpdates([]);
          notify('Minecraft-Version geändert.');
        }
        if (confirm.kind === 'remove') {
          await api.removeContent(i.id, confirm.item.folder, confirm.item.file);
          setUpdates(u => u.filter(v => v.file !== confirm.item.file));
          notify('Datei entfernt.');
        }
        if (confirm.kind === 'import') {
          const count = await api.chooseContentFiles(i.id, importType);
          if (count) notify(`${count} ${count === 1 ? t('Datei hinzugefügt') : t('Dateien hinzugefügt')}. ${importType === 'mod' ? t('Mods werden beim nächsten Spielstart geladen.') : t('Im Spiel auswählen oder neu laden; kein Neustart nötig.')}`);
        }
        if (confirm.kind === 'mod') {
          await api.installProject(confirm.plan.key);
          setUpdates(u => u.filter(v => v.file !== confirm.update.file));
          notify('Mod aktualisiert.');
        }
        setConfirm(null);
      })}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} {confirm.kind === 'import' ? t("Dateien auswählen") : t("Bestätigen")}</button></footer>}>
      {confirm.kind === 'restore' ? <p className="modal-paragraph">{confirm.backup.folders ? t("Nur die gesicherten Inhaltsordner werden wiederhergestellt; deine Welten bleiben erhalten.") : t("Die Instanz wird auf den gesicherten Stand zurückgesetzt.")}{t(" Backup vom ")}{date(confirm.backup.createdAt)}{t(". Der aktuelle Stand wird vorher zusätzlich gesichert.")}</p> : confirm.kind === 'version' ? <p className="modal-paragraph">{loaderName(i.loader)} {i.version} → {loaderName(loader)} {version}{t(". Mods und Spielstände müssen zur neuen Version passen.")}</p> : confirm.kind === 'remove' ? <p className="modal-paragraph">„{confirm.item.name}{t("“ wird aus dieser Instanz entfernt. Bei aktivierten automatischen Backups wird vorher eine Sicherung erstellt.")}</p> : confirm.kind === 'import' ? <><label className="field">{t("Welche Dateien möchtest du hinzufügen?")}<select aria-label={t("Dateityp hinzufügen")} value={importType} onChange={e => setImportType(e.target.value)}><option value="mod" disabled={i.loader === 'vanilla' || running}>{t("Mods (.jar)")}</option><option value="resourcepack">{t("Ressourcenpakete (.zip)")}</option><option value="shader">{t("Shader (.zip)")}</option></select></label><p className="modal-paragraph">{t("Wähle Dateien für Minecraft ")}{i.version}{i.loader !== 'vanilla' ? t(" und {0}", {
            0: loaderName(i.loader)
          }) : ''}{t(". Bereits vorhandene Dateien werden nicht überschrieben. Ressourcenpakete und Shader aktivierst du anschließend im Spiel.")}</p></> : <div className="install-plan"><h3>{t("Diese Dateien werden installiert")}</h3><ul>{confirm.plan.files.map(f => <li key={f.projectId}><strong>{f.title}</strong><span>{f.versionNumber}</span></li>)}</ul></div>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}

    </Modal>}
  </section>;
}
