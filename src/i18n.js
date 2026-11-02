import { useSyncExternalStore } from 'react';
import messages from '../electron/locales/en.json';

let language = 'de';
const listeners = new Set();
export const getLocale = () => language;
export function setLocale(value) {
  const next = value === 'en' ? 'en' : 'de';
  document.documentElement.lang = next;
  if (next === language) return;
  language = next; listeners.forEach(listener=>listener());
}
export const useLocale = () => useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getLocale);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pattern(value) {
  const keys = []; let offset = 0, expression = '^';
  for (const match of value.matchAll(/\{(\d+)\}/g)) { expression += escape(value.slice(offset,match.index))+'([\\s\\S]*?)'; keys.push(match[1]); offset=match.index+match[0].length; }
  return { regex:new RegExp(expression+escape(value.slice(offset))+'$'),keys };
}
const reverse = new Map(Object.entries(messages).map(([de,en])=>[en,de]));
const dynamic = Object.entries(messages).filter(([de])=>/\{\d+\}/.test(de)).map(([de,en])=>({de,en,source:pattern(de),translated:pattern(en)}));
const specificity=value=>value.replace(/\{\d+\}/g,'').length;
const ordered={de:[...dynamic].sort((a,b)=>specificity(b.de)-specificity(a.de)),en:[...dynamic].sort((a,b)=>specificity(b.en)-specificity(a.en))};
export function t(value, values) {
  if (typeof value !== 'string') return value;
  const leading=value.match(/^\s*/)[0],trailing=value.match(/\s*$/)[0],source=value.trim();
  let result;
  if (values) result=(language==='en'?messages[source]||source:source).replace(/\{(\d+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
  else if(language==='en'&&Object.hasOwn(messages,source))result=messages[source];
  else if(language==='de'&&Object.hasOwn(messages,source))result=source;
  else if(language==='de'&&reverse.has(source))result=reverse.get(source);
  else {
    for(const entry of ordered[language==='en'?'de':'en']){const candidate=language==='en'?entry.source:entry.translated,match=candidate.regex.exec(source);if(!match)continue;const params=Object.fromEntries(candidate.keys.map((key,index)=>[key,match[index+1]]));result=(language==='en'?entry.en:entry.de).replace(/\{(\d+)\}/g,(_,key)=>params[key]);break;}
    result??=source;
  }
  return leading+result+(source?trailing:'');
}
