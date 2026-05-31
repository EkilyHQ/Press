export function createCommitFileCollector() {
  const files = [];
  const seenPaths = new Set();

  function addFile(entry) {
    if (!entry || !entry.path) return;
    const key = String(entry.path || '').replace(/\\+/g, '/');
    if (seenPaths.has(key)) return;
    seenPaths.add(key);
    const next = { ...entry, path: key };
    if (entry.plaintextContent) {
      Object.defineProperty(next, 'plaintextContent', {
        value: String(entry.plaintextContent || ''),
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
    files.push(next);
  }

  return {
    addFile,
    getFiles: () => files.slice()
  };
}

function safeString(value) {
  return value == null ? '' : String(value);
}

function redactWarningMessage(value) {
  return safeString(value)
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,})\b/g, '[redacted]')
    .replace(/([?&#][^=&#\s]*(?:token|secret|password|grant|code)[^=&#\s]*=)[^&#\s]+/gi, '$1[redacted]')
    .slice(0, 320);
}

export function normalizeStagingWarning(warning, provider = {}) {
  const source = warning && typeof warning === 'object' ? warning : {};
  const providerId = safeString(source.providerId || provider.id || 'unknown').trim() || 'unknown';
  const message = redactWarningMessage(
    source.message
      || source.reason
      || (typeof warning === 'string' ? warning : '')
      || 'Optional staging provider did not complete.'
  );
  const out = {
    providerId,
    code: safeString(source.code || source.name || 'staging-warning').trim() || 'staging-warning',
    message
  };
  if (source.kind) out.kind = safeString(source.kind);
  if (source.path) out.path = safeString(source.path).replace(/\\+/g, '/').replace(/^\/+/, '');
  return out;
}

function normalizeProviderEntries(entries, provider) {
  return (Array.isArray(entries) ? entries : [])
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => {
      const next = {
        ...entry,
        providerId: entry.providerId || provider.id
      };
      if (Object.prototype.hasOwnProperty.call(entry, 'plaintextContent')) {
        Object.defineProperty(next, 'plaintextContent', {
          value: String(entry.plaintextContent || ''),
          enumerable: false,
          configurable: true,
          writable: true
        });
      }
      return next;
    });
}

export function createStagingRegistry() {
  const providers = [];

  function registerStagingProvider(provider) {
    if (!provider || !provider.id) return null;
    const existingIndex = providers.findIndex(item => item && item.id === provider.id);
    if (existingIndex >= 0) providers.splice(existingIndex, 1, provider);
    else providers.push(provider);
    return provider;
  }

  function getSummaryEntries(context = {}) {
    const entries = [];
    providers.forEach((provider) => {
      if (!provider || typeof provider.getSummaryEntries !== 'function') return;
      entries.push(...normalizeProviderEntries(provider.getSummaryEntries(context), provider));
    });
    return entries;
  }

  async function getCommitFiles(context = {}) {
    const files = [];
    const warnings = [];
    for (const provider of providers) {
      if (!provider || typeof provider.getCommitFiles !== 'function') continue;
      try {
        const result = await provider.getCommitFiles(context);
        if (Array.isArray(result)) {
          files.push(...normalizeProviderEntries(result, provider));
        } else if (result && typeof result === 'object') {
          files.push(...normalizeProviderEntries(result.files, provider));
          if (Array.isArray(result.warnings)) {
            warnings.push(...result.warnings.map(warning => normalizeStagingWarning(warning, provider)));
          }
        }
      } catch (err) {
        if (provider.required) throw err;
        warnings.push(normalizeStagingWarning(err, provider));
      }
    }
    return { files, warnings };
  }

  function clearCommittedFiles(files = [], context = {}) {
    const committedProviderIds = new Set(
      (Array.isArray(files) ? files : [])
        .map(file => file && file.providerId)
        .filter(Boolean)
    );
    const cleared = new Set();
    providers.forEach((provider) => {
      if (!provider || !committedProviderIds.has(provider.id) || typeof provider.clear !== 'function') return;
      provider.clear(context);
      cleared.add(provider.id);
    });
    return cleared;
  }

  return {
    registerStagingProvider,
    getSummaryEntries,
    getCommitFiles,
    clearCommittedFiles
  };
}
