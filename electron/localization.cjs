const messages = require('./locales/en.json');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = new Map();
function pattern(value) {
  const keys = []; let offset = 0, expression = '^';
  for (const match of value.matchAll(/\{(\d+)\}/g)) {
    expression += escape(value.slice(offset, match.index)) + '([\\s\\S]*?)';
    keys.push(match[1]); offset = match.index + match[0].length;
  }
  return { regex: new RegExp(expression + escape(value.slice(offset)) + '$'), keys };
}
const dynamic = Object.entries(messages).filter(([de,en])=>/\{\d+\}/.test(de)).map(([de,en])=>({de,en,source:pattern(de),translated:pattern(en)}));
const specificity = value => value.replace(/\{\d+\}/g,'').length;
const ordered = {de:[...dynamic].sort((a,b)=>specificity(b.de)-specificity(a.de)),en:[...dynamic].sort((a,b)=>specificity(b.en)-specificity(a.en))};
const reverse = new Map(Object.entries(messages).map(([de,en])=>[en,de]));
function translateMessage(value, language = 'de', values) {
  if (typeof value !== 'string') return value;
  const leading = value.match(/^\s*/)[0], trailing = value.match(/\s*$/)[0], source = value.trim();
  let result;
  if (values) {
    const template = language === 'en' ? messages[source] || source : reverse.get(source) || source;
    result = template.replace(/\{(\d+)\}/g, (match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
  } else if (language === 'en' && Object.hasOwn(messages,source)) result = messages[source];
  else if (language !== 'en' && Object.hasOwn(messages,source)) result = source;
  else if (language !== 'en' && reverse.has(source)) result = reverse.get(source);
  else {
    const cacheKey = language + ':' + source;
    if (compiled.has(cacheKey)) result = compiled.get(cacheKey);
    else {
      for (const entry of ordered[language === 'en' ? 'de' : 'en']) {
        const candidate = language === 'en' ? entry.source : entry.translated, match = candidate.regex.exec(source);
        if (!match) continue;
        const params = Object.fromEntries(candidate.keys.map((key,index)=>[key,match[index+1]]));
        result = (language === 'en' ? entry.en : entry.de).replace(/\{(\d+)\}/g,(_,key)=>params[key]); break;
      }
      result ??= source;
      if (compiled.size > 2000) compiled.clear();
      compiled.set(cacheKey,result);
    }
  }
  return leading + result + (source ? trailing : '');
}
module.exports = { translateMessage };
