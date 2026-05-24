import './cache-control.js';
import { initI18n, t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage, ensureLanguageBundle } from './i18n.js?v=press-system-v3.4.50';
import { createEditorBootRuntime } from './editor-boot-runtime.js?v=press-system-v3.4.50';

const bootRuntime = createEditorBootRuntime();

function applyAttributeTranslation(el, target, value) {
  if (value == null) return;
  switch (target) {
    case 'text':
      el.textContent = value;
      break;
    case 'html':
      el.innerHTML = value;
      break;
    case 'placeholder':
      el.setAttribute('placeholder', value);
      if ('placeholder' in el) el.placeholder = value;
      break;
    case 'value':
      if ('value' in el) el.value = value;
      else el.setAttribute('value', value);
      break;
    default: {
      el.setAttribute(target, value);
      if (target === 'title' && el.title !== value) el.title = value;
      if (target === 'aria-label' && el.getAttribute('aria-label') !== value) el.setAttribute('aria-label', value);
      if (target.startsWith('data-')) {
        const dataKey = target.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        if (dataKey) el.dataset[dataKey] = value;
      }
      break;
    }
  }
}

function applyElementTranslations(root = null) {
  bootRuntime.setDocumentTitle(t('editor.pageTitle'));
  const elements = bootRuntime.getTranslationElements(root);
  elements.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const text = t(key);
      if (text != null) el.textContent = text;
    }
    Array.from(el.attributes).forEach((attr) => {
      if (!attr.name.startsWith('data-i18n-') || attr.name === 'data-i18n') return;
      const target = attr.name.slice('data-i18n-'.length);
      if (!target) return;
      const translated = t(attr.value);
      applyAttributeTranslation(el, target, translated);
    });
  });
}

function populateLanguageSelect() {
  const select = bootRuntime.getLanguageSelect();
  if (!select) return;
  const current = getCurrentLang();
  try { ensureLanguageBundle(current).catch(() => {}); } catch (_) {}
  const langs = getAvailableLangs();
  const prev = select.value;
  select.innerHTML = '';
  langs.forEach((code) => {
    const opt = bootRuntime.createOption();
    if (!opt) return;
    opt.value = code;
    opt.textContent = getLanguageLabel(code);
    select.appendChild(opt);
  });
  select.value = langs.includes(current) ? current : current || prev;
  if (!select.dataset.boundChange) {
    select.addEventListener('change', async () => {
      const value = select.value || 'en';
      try {
        await ensureLanguageBundle(value);
      } catch (_) {}
      switchLanguage(value);
    });
    select.dataset.boundChange = '1';
  }
}

bootRuntime.setPopulateLanguageSelect(populateLanguageSelect);
bootRuntime.onLanguageControlMounted(populateLanguageSelect);

function applyEditorLanguage() {
  applyElementTranslations();
  populateLanguageSelect();
  bootRuntime.emitLanguageApplied();
}

async function bootstrap() {
  await initI18n();
  applyEditorLanguage();
  bootRuntime.setSoftResetLanguage(async () => {
    await initI18n({ persist: false });
    applyEditorLanguage();
  });
}

bootRuntime.onI18nBundleLoaded((event) => {
  const detail = event && event.detail ? event.detail : {};
  const lang = (detail.lang || '').toLowerCase();
  if (!lang) return;
  const current = (getCurrentLang && getCurrentLang()) || '';
  if (lang && current && current.toLowerCase() === lang) {
    try { populateLanguageSelect(); } catch (_) {}
  }
});

bootRuntime.onDocumentReady(() => { bootstrap().catch(() => {}); });
