import { t, getLocale } from "./i18n.js";
import React, { useEffect, useRef, useState } from 'react';
import { Box, Layers3, CheckCircle2, LoaderCircle } from 'lucide-react';
import { loaders, loaderName } from './loaders.js';
export default function LoaderPicker({
  gameVersion,
  loader,
  loaderVersion = '',
  onChange,
  onAvailability
}) {
  const [versions, setVersions] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const callbacks = useRef();
  callbacks.current = {
    onChange,
    onAvailability
  };
  useEffect(() => {
    let active = true;
    setVersions([]);
    setError('');
    if (loader === 'vanilla') {
      setLoading(false);
      callbacks.current.onAvailability?.(true);
      return;
    }
    if (!gameVersion) {
      callbacks.current.onAvailability?.(false);
      return;
    }
    setLoading(true);
    callbacks.current.onAvailability?.(false);
    window.carrot.getLoaderVersions(loader, gameVersion).then(list => {
      if (!active) return;
      setVersions(list);
      const selected = loaderVersion || list[0]?.version || '';
      if (!list.length) setError(t("Für Minecraft {0} ist keine {1}-Version verfügbar.", {
        0: gameVersion,
        1: loaderName(loader)
      }));else if (!list.some(v => v.version === selected)) setError(t("Die bisherige Loader-Version ist nicht verfügbar. Bitte eine Version auswählen."));else {
        callbacks.current.onChange(loader, selected);
        callbacks.current.onAvailability?.(true);
      }
    }).catch(e => {
      if (active) setError(e.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [gameVersion, loader, retry]);
  return <div className="loader-picker">
    <span className="field-label">Modloader</span>
    <div className="loader-options loader-grid">{loaders.map(item => <button type="button" key={item.id} aria-pressed={loader === item.id} className={loader === item.id ? 'selected' : ''} onClick={() => callbacks.current.onChange(item.id, '')}>
      {item.id === 'vanilla' ? <Box size={21} /> : <Layers3 size={21} />}<strong>{t(item.name)}</strong><small>{t(item.description)}</small>{loader === item.id && <CheckCircle2 size={15} />}
    </button>)}</div>
    {loader !== 'vanilla' && <label className="field">{loaderName(loader)}{t("-Version ")}<select aria-label={t("Loader-Version")} disabled={loading || !versions.length} value={loaderVersion} onChange={e => {
        setError('');
        callbacks.current.onChange(loader, e.target.value);
        callbacks.current.onAvailability?.(true);
      }}>
        {!versions.length && <option value="">{loading ? t("Versionen werden geladen …") : t("Keine passende Version verfügbar")}</option>}
        {loaderVersion && !versions.some(v => v.version === loaderVersion) && <option value={loaderVersion}>{loaderVersion}{t(" · nicht verfügbar")}</option>}
        {versions.map((v, n) => <option key={v.version} value={v.version}>{v.version}{n === 0 ? t(" · Neueste passende Version") : ''}{!v.stable ? t(" · Vorabversion") : ''}</option>)}
      </select>
    </label>}
    {loading && <p className="tool-working"><LoaderCircle size={14} className="spin" />{t(" Kompatibilität wird geprüft …")}</p>}
    {error && <div className="form-error" role="alert">{t(error)} <button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>{t("Erneut prüfen")}</button></div>}
  </div>;
}
