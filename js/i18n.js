import { DATA } from './data.js';
let currentLang = 'ja';
export function setLanguage(lang){ currentLang = DATA.translations[lang] ? lang : 'en'; document.documentElement.lang = currentLang; }
export function t(key){ return DATA.translations[currentLang]?.[key] || DATA.translations.en[key] || key; }
export function applyI18n(){ document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); }); }
export function lang(){ return currentLang; }
