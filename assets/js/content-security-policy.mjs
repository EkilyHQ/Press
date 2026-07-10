const COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES = Object.freeze([
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' data: blob: http: https:",
  "font-src 'self' data: blob: http: https:"
]);

const REMOTE_CONNECT_SOURCES = "'self' https: http://localhost:* http://127.0.0.1:*";

export const EDITOR_INLINE_SCRIPT_SHA256_SOURCES = Object.freeze([
  'sha256-7fumrKYNuNbU1bMOp1lfrFwq59C4I7qICkA4xSNfefQ=',
  'sha256-78pVE5dzddjfImBn8Dh7Xu8/uUk4AqWtBgr0ofkwahs='
]);

function buildContentSecurityPolicy({ connectSources, frameSources, inlineScriptSources = [] }) {
  const scriptSources = ["'self'", ...inlineScriptSources.map((source) => `'${source}'`)].join(' ');
  return [
    COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES[0],
    COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES[1],
    COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES[2],
    `script-src ${scriptSources}`,
    ...COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES.slice(3),
    `connect-src ${connectSources}`,
    `frame-src ${frameSources}`,
    "worker-src 'none'",
    "form-action 'self'"
  ].join('; ');
}

export const PUBLIC_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  connectSources: REMOTE_CONNECT_SOURCES,
  frameSources: "'none'"
});

export const EDITOR_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  connectSources: REMOTE_CONNECT_SOURCES,
  frameSources: "'self'",
  inlineScriptSources: EDITOR_INLINE_SCRIPT_SHA256_SOURCES
});

export const EDITOR_PREVIEW_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  connectSources: "'self'",
  frameSources: "'none'"
});

export const MATERIALIZED_CONTENT_SECURITY_POLICIES = Object.freeze({
  'index.html': PUBLIC_CONTENT_SECURITY_POLICY,
  'index_editor.html': EDITOR_CONTENT_SECURITY_POLICY,
  'index_editor_preview.html': EDITOR_PREVIEW_CONTENT_SECURITY_POLICY
});
