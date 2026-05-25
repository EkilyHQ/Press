import { createSafeHighlightFragment as defaultCreateSafeHighlightFragment, detectLanguage as defaultDetectLanguage } from './syntax-highlight.js?v=press-system-v3.4.52';

const CODE_LANGUAGE_OPTIONS = [
  '', 'plain', 'text', 'raw', 'none', 'nohighlight',
  'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',
  'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',
  'objectivec', 'perl', 'php', 'php-template', 'plaintext', 'python',
  'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',
  'typescript', 'vbnet', 'wasm', 'xml', 'yaml',
  'html', 'yml', 'robots'
];
const CODE_PLAIN_LANGUAGES = new Set(['plain', 'text', 'none', 'raw', 'nohighlight', 'plaintext']);
const CODE_LANGUAGE_ALIASES = new Map([
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['sh', 'bash'],
  ['zsh', 'bash'],
  ['html', 'xml'],
  ['htm', 'xml'],
  ['yml', 'yaml'],
  ['md', 'markdown']
]);
const CODE_HIGHLIGHT_LANGUAGES = new Set(CODE_LANGUAGE_OPTIONS
  .map(value => CODE_LANGUAGE_ALIASES.get(value) || value)
  .filter(value => value && !CODE_PLAIN_LANGUAGES.has(value)));

function noop() {}

function blockData(block) {
  return block && block.data && typeof block.data === 'object' ? block.data : {};
}

function translation(runtime, text, key, fallback) {
  if (typeof text === 'function') return text(key, fallback);
  if (runtime && typeof runtime.translate === 'function') return runtime.translate(key, fallback);
  return fallback;
}

function resolveCodeHighlightLanguage(language, codeText, detectLanguage = defaultDetectLanguage) {
  const raw = String(language || '').trim();
  const normalized = raw.toLowerCase();
  const resolved = CODE_LANGUAGE_ALIASES.get(normalized) || normalized;
  if (CODE_PLAIN_LANGUAGES.has(normalized)) {
    return { language: 'plain', label: 'PLAIN', highlight: false };
  }
  if (CODE_HIGHLIGHT_LANGUAGES.has(resolved)) {
    return { language: resolved, label: resolved.toUpperCase(), highlight: true };
  }
  if (!normalized) {
    const detected = String(detectLanguage(String(codeText || '')) || '').toLowerCase();
    const detectedResolved = CODE_LANGUAGE_ALIASES.get(detected) || detected;
    if (CODE_HIGHLIGHT_LANGUAGES.has(detectedResolved)) {
      return { language: detectedResolved, label: detectedResolved.toUpperCase(), highlight: true };
    }
  }
  return { language: 'plain', label: 'PLAIN', highlight: false };
}

export function createEditorBlocksCodeSession({
  documentRef = null,
  runtime = null,
  editableSession = null,
  text = null,
  selectionSession = null,
  codeEditableText = () => '',
  insertCodeEditableTextAtSelection = () => '',
  removeEmptyBlockWithBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false,
  updateFromControl = noop,
  setActive = noop,
  activateEditableFromPointer = noop,
  detectHighlightLanguage = defaultDetectLanguage,
  createHighlightFragment = defaultCreateSafeHighlightFragment
} = {}) {
  if (!documentRef) return null;

  const t = (key, fallback) => translation(runtime, text, key, fallback);

  const createLanguageInput = (block) => {
    const data = blockData(block);
    const lang = documentRef.createElement('select');
    lang.className = 'blocks-code-language';
    lang.title = t('codeLanguage', 'Language');
    lang.setAttribute('aria-label', t('codeLanguage', 'Language'));
    const currentLang = String(data.lang || '').trim();
    const normalizedLang = currentLang.toLowerCase();
    const resolvedLang = CODE_LANGUAGE_ALIASES.get(normalizedLang) || normalizedLang;
    const labels = new Map([
      ['', 'Auto / blank'],
      ['plain', 'plain']
    ]);
    const appendOption = (value, label, unsupported = false) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = label || value || 'Auto / blank';
      if (unsupported) {
        option.disabled = true;
        option.dataset.unsupported = 'true';
      }
      lang.appendChild(option);
    };
    CODE_LANGUAGE_OPTIONS.forEach((value) => appendOption(value, labels.get(value) || value));
    if (currentLang && !CODE_LANGUAGE_OPTIONS.includes(normalizedLang) && !CODE_LANGUAGE_OPTIONS.includes(resolvedLang)) {
      appendOption(currentLang, `Unsupported: ${currentLang}`, true);
    }
    lang.value = CODE_LANGUAGE_OPTIONS.includes(normalizedLang)
      ? normalizedLang
      : (CODE_LANGUAGE_OPTIONS.includes(resolvedLang) ? resolvedLang : currentLang);
    lang.addEventListener('change', () => updateFromControl(block, { lang: lang.value }, true));
    return lang;
  };

  const renderGutter = (gutter, value) => {
    if (!gutter) return;
    const lineCount = Math.max(1, String(value == null ? '' : value).split('\n').length);
    if (gutter.childElementCount !== lineCount) {
      const frag = documentRef.createDocumentFragment();
      for (let line = 1; line <= lineCount; line += 1) {
        const span = documentRef.createElement('span');
        span.textContent = String(line);
        frag.appendChild(span);
      }
      gutter.replaceChildren(frag);
    } else {
      Array.from(gutter.children).forEach((span, index) => {
        const label = String(index + 1);
        if (span.textContent !== label) span.textContent = label;
      });
    }
  };

  const createLanguageLabel = (getCodeText) => {
    const label = documentRef.createElement('div');
    label.className = 'syntax-language-label blocks-code-language-label';
    label.dataset.lang = 'PLAIN';
    label.textContent = 'PLAIN';
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-label', t('code.copyAria', 'Copy code'));

    const restoreLabel = () => {
      label.textContent = label.dataset.lang || 'PLAIN';
    };
    const copyCode = async () => {
      const rawText = typeof getCodeText === 'function' ? String(getCodeText() || '') : '';
      const ok = !!(runtime && typeof runtime.writeClipboardText === 'function' && await runtime.writeClipboardText(rawText));
      const old = label.dataset.lang || 'PLAIN';
      label.classList.add('is-copied');
      label.textContent = ok ? t('code.copied', 'Copied').toUpperCase() : t('code.failed', 'Failed').toUpperCase();
      const setTimer = runtime && typeof runtime.setTimer === 'function' ? runtime.setTimer : (() => 0);
      setTimer(() => {
        label.classList.remove('is-copied');
        label.textContent = old;
      }, 1200);
    };

    label.addEventListener('mouseenter', () => {
      label.classList.add('is-hover');
      label.textContent = t('code.copy', 'Copy').toUpperCase();
    });
    label.addEventListener('mouseleave', () => {
      label.classList.remove('is-hover');
      restoreLabel();
    });
    label.addEventListener('click', copyCode);
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyCode();
      }
    });
    return label;
  };

  const renderHighlight = (highlight, label, value, language) => {
    if (!highlight || !label) return;
    const raw = String(value == null ? '' : value);
    const meta = resolveCodeHighlightLanguage(language, raw, detectHighlightLanguage);
    highlight.className = `blocks-code-highlight language-${meta.language}`;
    highlight.replaceChildren(createHighlightFragment(raw, meta.highlight ? meta.language : 'plain'));
    label.dataset.lang = meta.label || 'PLAIN';
    if (!label.classList.contains('is-hover') && !label.classList.contains('is-copied')) {
      label.textContent = label.dataset.lang;
    }
  };

  const renderBlock = (body, block, index) => {
    if (!body || !block) return;
    const data = blockData(block);
    const pre = documentRef.createElement('pre');
    pre.className = 'blocks-code-preview';
    const scroll = documentRef.createElement('div');
    scroll.className = 'blocks-code-scroll';
    const gutter = documentRef.createElement('div');
    gutter.className = 'blocks-code-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    const surface = documentRef.createElement('div');
    surface.className = 'blocks-code-surface';
    const highlight = documentRef.createElement('code');
    highlight.className = 'blocks-code-highlight language-plain';
    highlight.setAttribute('aria-hidden', 'true');
    const code = documentRef.createElement('code');
    code.className = 'blocks-code-editable';
    code.contentEditable = 'true';
    code.spellcheck = false;
    code.textContent = data.text || '';
    const languageLabel = createLanguageLabel(() => codeEditableText(code));

    const refresh = (value = codeEditableText(code)) => {
      renderGutter(gutter, value);
      renderHighlight(highlight, languageLabel, value, blockData(block).lang || '');
    };
    refresh(data.text || '');

    const sync = () => {
      const value = codeEditableText(code);
      updateFromControl(block, { text: value });
      refresh(value);
    };
    if (editableSession && typeof editableSession.registerEditable === 'function') {
      editableSession.registerEditable(code, sync);
    }
    code.addEventListener('input', sync);
    code.addEventListener('keydown', (event) => {
      if (removeEmptyBlockWithBackspace(event, block, index, code, sync)) return;
      if (handleCrossBlockArrowNavigation(event, index, code)) return;
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      event.preventDefault();
      const value = insertCodeEditableTextAtSelection(code, '\n', selectionSession);
      updateFromControl(block, { text: value });
      refresh(value);
    });
    code.addEventListener('focus', () => setActive(index, code, sync));
    code.addEventListener('pointerdown', (event) => {
      if (event && event.button === 0 && event.isPrimary !== false) {
        activateEditableFromPointer(index, code, sync);
      }
    });

    surface.append(highlight, code);
    scroll.append(gutter, surface);
    pre.appendChild(scroll);
    pre.appendChild(languageLabel);
    body.appendChild(pre);
  };

  return {
    createLanguageInput,
    renderBlock
  };
}
