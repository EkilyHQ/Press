import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  PRESS_THEME_CONTRACT,
  getDefaultThemeStyles,
  getOptionalThemeViews,
  getRequiredThemeComponents,
  getRequiredThemeContentShapes,
  getRequiredThemeManifestFields,
  getRequiredThemeRegions,
  getRequiredThemeViews
} from '../assets/js/theme-contract-surface.mjs';

const root = process.cwd();
const themesDir = path.join(root, 'assets', 'themes');
const schemaPath = path.join(root, 'assets', 'schema', 'theme.json');
const failures = [];

const REQUIRED_VIEWS = [...getRequiredThemeViews(), ...getOptionalThemeViews()];
const REQUIRED_REGIONS = getRequiredThemeRegions();
const REQUIRED_CONTENT_SHAPES = getRequiredThemeContentShapes();
const REQUIRED_COMPONENTS = getRequiredThemeComponents();
const REQUIRED_MANIFEST_FIELDS = getRequiredThemeManifestFields();
const DEFAULT_THEME_STYLES = getDefaultThemeStyles();
const REQUIRED_STYLE_TOKENS = ['--press-color-text', '--press-color-surface', '--press-font-body', '--press-radius-card', '--press-space-page'];
const STRING_LITERAL_PATTERN = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
const ROUTE_QUERY_PATTERN = /[?&](?:tab|id)\s*=/g;
const URL_SEARCH_PARAMS_LITERAL_PATTERN = /\bnew\s+URLSearchParams\s*\(\s*(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\)/g;
const STATIC_ROUTE_SEARCH_PARAM_PATTERN = /\bsearchParams\s*\.\s*(?:set|append)\(\s*(['"`])(?:tab|id)\1\s*,/;
const FORMER_DOM_IDS = [
  ['main', 'view'],
  ['toc', 'view'],
  ['search', 'Input'],
  ['tabs', 'Nav'],
  ['tag', 'view']
].map(parts => parts.join(''));
const FORBIDDEN_SOURCE_PATTERNS = [
  { label: 'global theme adapter', re: new RegExp('__press_' + 'themeHooks') },
  { label: 'manifest compatibility object reads', re: new RegExp('manifest\\.' + 'contract\\b') },
  { label: 'theme manifest compatibility object', re: new RegExp('["\\\']' + 'contract' + '["\\\']\\s*:') },
  { label: 'adapter binding function', re: new RegExp('bindLegacy' + 'HookAdapters') },
  { label: 'adapter view conversion', re: new RegExp('viewsFrom' + 'Hooks') },
  { label: 'region alias table', re: new RegExp('REGION_' + 'ALIASES') },
  { label: 'selector-based lightbox root fallback', re: new RegExp('root' + 'Selector') },
  ...FORMER_DOM_IDS.flatMap((id) => [
    { label: `legacy DOM id selector #${id}`, re: new RegExp(`#${escapeRe(id)}\\b`) },
    { label: `legacy DOM id assignment ${id}`, re: new RegExp(`\\bid\\s*=\\s*['"]${escapeRe(id)}['"]`) },
    { label: `legacy DOM id registration ${id}`, re: new RegExp(`register\\(\\s*['"]${escapeRe(id)}['"]`) }
  ])
];
const CORE_RUNTIME_FILES = [
  'assets/main.js',
  'assets/js/dom-utils.js',
  'assets/js/i18n.js',
  'assets/js/lightbox.js',
  'assets/js/search.js',
  'assets/js/tags.js',
  'assets/js/theme.js',
  'assets/js/toc.js'
];

function fail(message) {
  failures.push(message);
}

function rel(file) {
  return path.relative(root, file);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (err) {
    fail(`${rel(file)} is not valid JSON: ${err.message}`);
    return null;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function uniqueList(items, label, file) {
  if (!Array.isArray(items)) {
    fail(`${file} ${label} must be an array`);
    return [];
  }
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) {
      fail(`${file} ${label} contains an empty value`);
      return;
    }
    if (seen.has(value)) {
      fail(`${file} ${label} repeats "${value}"`);
      return;
    }
    seen.add(value);
    out.push(value);
  });
  return out;
}

function requireObject(value, label, file) {
  const object = asObject(value);
  if (!object) fail(`${file} ${label} must be an object`);
  return object || {};
}

function requireList(owner, key, label, file) {
  if (!Object.prototype.hasOwnProperty.call(owner || {}, key)) {
    fail(`${file} is missing ${label}`);
    return [];
  }
  return uniqueList(owner[key], label, file);
}

function modulePathIsSafe(entry, extension) {
  return entry
    && !entry.startsWith('.')
    && !entry.startsWith('/')
    && !entry.includes('..')
    && !entry.includes('\\')
    && entry.endsWith(extension);
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isExternalUrlPrefix(value) {
  const prefix = String(value || '').trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(prefix) || prefix.startsWith('//');
}

function routeCandidatePrefix(content, queryIndex) {
  const before = String(content || '').slice(0, queryIndex);
  const boundaries = ['"', "'", '`', ' ', '\n', '\r', '\t', '(', '[', '{', '=', '>'];
  let boundary = -1;
  boundaries.forEach((candidate) => {
    const index = before.lastIndexOf(candidate);
    if (index > boundary) boundary = index;
  });
  return before.slice(boundary + 1).trim();
}

function containsRelativePressRouteLiteral(content) {
  const value = String(content || '');
  ROUTE_QUERY_PATTERN.lastIndex = 0;
  let match = ROUTE_QUERY_PATTERN.exec(value);
  while (match) {
    const queryIndex = match[0].startsWith('?')
      ? match.index
      : value.lastIndexOf('?', match.index);
    const prefix = queryIndex >= 0 ? routeCandidatePrefix(value, queryIndex) : '';
    if (!isExternalUrlPrefix(prefix)) return true;
    match = ROUTE_QUERY_PATTERN.exec(value);
  }
  return false;
}

function containsForbiddenRouteLiteral(source) {
  const text = String(source || '');
  STRING_LITERAL_PATTERN.lastIndex = 0;
  let match = STRING_LITERAL_PATTERN.exec(text);
  while (match) {
    if (containsRelativePressRouteLiteral(match[2])) return true;
    match = STRING_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function containsForbiddenUrlSearchParamsLiteral(source) {
  const text = String(source || '');
  URL_SEARCH_PARAMS_LITERAL_PATTERN.lastIndex = 0;
  let match = URL_SEARCH_PARAMS_LITERAL_PATTERN.exec(text);
  while (match) {
    if (/(?:^|[?&])(?:tab|id)\s*=/i.test(match[2])) return true;
    match = URL_SEARCH_PARAMS_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function containsForbiddenV4RouteConstruction(source) {
  const text = String(source || '');
  return containsForbiddenRouteLiteral(text)
    || containsForbiddenUrlSearchParamsLiteral(text)
    || STATIC_ROUTE_SEARCH_PARAM_PATTERN.test(text);
}

function sourceMentionsRegion(source, key) {
  const escaped = escapeRe(key);
  return new RegExp(`\\b${escaped}\\b`).test(source);
}

function declaredViewHandler(viewDecl = {}) {
  const module = typeof viewDecl.module === 'string' ? viewDecl.module.trim() : '';
  const handler = typeof viewDecl.handler === 'string' ? viewDecl.handler.trim() : '';
  return { module, handler };
}

function collectFiles(dir) {
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.isFile()) out.push(full);
  });
  return out;
}

const schema = readJson(schemaPath);
if (!schema) fail('assets/schema/theme.json must be readable');

const componentSource = read(path.join(root, 'assets', 'js', 'components.js'));
const themeRegionsSource = read(path.join(root, 'assets', 'js', 'theme-regions.js'));
const themeLayoutSource = read(path.join(root, 'assets', 'js', 'theme-layout.js'));
const themeManagerSource = read(path.join(root, 'assets', 'js', 'theme-manager.js'));
const themePackageCoreSource = read(path.join(root, 'assets', 'js', 'theme-package-core.js'));
const mainSource = read(path.join(root, 'assets', 'main.js'));
const editorPreviewRuntimeSource = read(path.join(root, 'assets', 'js', 'editor-preview-runtime.js'));
const contentModelSource = read(path.join(root, 'assets', 'js', 'content-model.js'));
const themeContractSource = read(path.join(root, 'wwwroot', 'post', 'theme-contract', 'theme-contract_en.md'));

if (PRESS_THEME_CONTRACT.schemaVersion !== 1 || PRESS_THEME_CONTRACT.type !== 'press-theme-contract') {
  fail('assets/js/theme-contract-surface.mjs must declare the press-theme-contract surface');
}
if (PRESS_THEME_CONTRACT.contractVersion !== 4) {
  fail('assets/js/theme-contract-surface.mjs must declare contractVersion 4 as the current theme contract');
}
if (JSON.stringify(PRESS_THEME_CONTRACT.supportedContractVersions) !== JSON.stringify([3, 4])) {
  fail('the v4 transition release must support theme contract versions 3 and 4');
}
if (PRESS_THEME_CONTRACT.manifestSchemaPath !== 'assets/schema/theme.json') {
  fail('theme contract surface must point at assets/schema/theme.json');
}
if (JSON.stringify(schema.properties && schema.properties.contractVersion && schema.properties.contractVersion.enum) !== JSON.stringify(PRESS_THEME_CONTRACT.supportedContractVersions)) {
  fail('assets/schema/theme.json supported contract versions must match the shared theme contract surface');
}
if (JSON.stringify(schema.required || []) !== JSON.stringify(REQUIRED_MANIFEST_FIELDS)) {
  fail('assets/schema/theme.json required fields must match the shared theme contract surface');
}
if (JSON.stringify(PRESS_THEME_CONTRACT.manifest.defaultStyles || []) !== JSON.stringify(DEFAULT_THEME_STYLES)) {
  fail('theme contract surface default styles helper must match the declared manifest default styles');
}
const schemaRequiredViews = schema.properties && schema.properties.views && schema.properties.views.required;
if (JSON.stringify(schemaRequiredViews || []) !== JSON.stringify(getRequiredThemeViews())) {
  fail('assets/schema/theme.json required views must match the shared theme contract surface');
}
const schemaContentShapes = schema.$defs && schema.$defs.contentShapeList && schema.$defs.contentShapeList.items && schema.$defs.contentShapeList.items.enum;
if (JSON.stringify(schemaContentShapes || []) !== JSON.stringify(REQUIRED_CONTENT_SHAPES)) {
  fail('assets/schema/theme.json content shape enum must match the shared theme contract surface');
}
if (!themeLayoutSource.includes('theme-contract-surface.mjs') || !themePackageCoreSource.includes('theme-contract-surface.mjs')) {
  fail('theme runtime and Theme Manager package core must import the shared theme contract surface');
}
if (!themeManagerSource.includes('theme-package-core.js')) {
  fail('Theme Manager must consume theme contract rules through the shared package core');
}
if (!themeLayoutSource.includes('getDefaultThemeStyles') || !themePackageCoreSource.includes('getDefaultThemeStyles')) {
  fail('theme runtime and Theme Manager package core must read default theme styles from the shared theme contract surface');
}

REQUIRED_COMPONENTS.forEach((component) => {
  const localName = component.replace(/^press-/, '');
  const className = `Press${localName.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
  if (!componentSource.includes(`defineElement('${component}'`) || !componentSource.includes(`class ${className}`)) {
    fail(`assets/js/components.js must define shared component ${component}`);
  }
});

['createThemeRegionRegistry', 'registerMany', 'value(name)'].forEach((needle) => {
  if (!themeRegionsSource.includes(needle)) {
    fail(`assets/js/theme-regions.js must expose region registry support for ${needle}`);
  }
});

['getThemeApiHandler', 'EFFECT_VIEW_NAMES', 'applyManifestStyles'].forEach((needle) => {
  if (!themeLayoutSource.includes(needle)) {
    fail(`assets/js/theme-layout.js must expose theme API support for ${needle}`);
  }
});
['createThemeI18nContext', 'switchLanguage', 'ensureLanguageBundle', 'getAvailableLangs', 'getLanguageLabel'].forEach((needle) => {
  if (!themeLayoutSource.includes(needle)) {
    fail(`assets/js/theme-layout.js must expose theme i18n context support for ${needle}`);
  }
});
if (!/const direct = \([\s\S]*asObject\(mod\.effects\)[\s\S]*\) \? mod : null;/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must merge pure API objects returned from mount(ctx)');
}
if (!/i18n:\s*createThemeI18nContext\(\)/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must inject ctx.i18n into theme mount context');
}
if (!/router:\s*options\.router \|\| null/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must inject ctx.router into theme mount context');
}

['createContentModel', 'blocks', 'tocTree', 'headings', 'assets', 'links'].forEach((needle) => {
  if (!contentModelSource.includes(needle)) {
    fail(`assets/js/content-model.js must provide content model field ${needle}`);
  }
});

if (!mainSource.includes('getThemeApiHandler')) {
  fail('assets/main.js must route theme calls through getThemeApiHandler');
}
if (!/i18n:\s*createThemeI18nContext\(\)/.test(mainSource)) {
  fail('assets/main.js must pass the standard ctx.i18n shape to theme view handlers');
}
[
  ['getHomeSlug', /function createThemeRouterContext\(\)[\s\S]*getHomeSlug:\s*\(\)\s*=>\s*getHomeSlug\(\)/],
  ['getHomeLabel', /function createThemeRouterContext\(\)[\s\S]*getHomeLabel:\s*\(\)\s*=>\s*getHomeLabel\(\)/],
  ['postsEnabled', /function createThemeRouterContext\(\)[\s\S]*postsEnabled:\s*\(\)\s*=>\s*postsEnabled\(\)/],
  ['searchEnabled', /function createThemeRouterContext\(\)[\s\S]*searchEnabled:\s*\(\)\s*=>\s*searchEnabled\(\)/],
  ['getHomeHref', /function createThemeRouterContext\(\)[\s\S]*getHomeHref/],
  ['getTabHref', /function createThemeRouterContext\(\)[\s\S]*getTabHref/],
  ['getPostHref', /function createThemeRouterContext\(\)[\s\S]*getPostHref/],
  ['getPostsHref', /function createThemeRouterContext\(\)[\s\S]*getPostsHref/],
  ['getSearchHref', /function createThemeRouterContext\(\)[\s\S]*getSearchHref/],
  ['withLangParam', /function createThemeRouterContext\(\)[\s\S]*withLangParam/]
].forEach(([name, re]) => {
  if (!re.test(mainSource)) fail(`assets/main.js must expose ctx.router.${name} for contract v4 themes`);
});
if (!/router:\s*createThemeRouterContext\(\)/.test(mainSource)) {
  fail('assets/main.js createThemeRuntimeContext must use the shared v4 router helper context');
}
if (!/function renderSiteIdentity[\s\S]*\bctx,?[\s\S]*getHomeSlug:\s*\(\)\s*=>\s*getHomeSlug\(\)[\s\S]*postsEnabled:\s*\(\)\s*=>\s*postsEnabled\(\)[\s\S]*searchEnabled:\s*\(\)\s*=>\s*searchEnabled\(\)/.test(mainSource)) {
  fail('assets/main.js renderSiteIdentity must pass v3 home/posts/search helpers to theme effects');
}
[
  ['getHomeSlug', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getHomeSlug:\s*\(\)\s*=>\s*getPreviewHomeSlug\(payload,\s*features\)/],
  ['getHomeLabel', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getHomeLabel:\s*\(\)\s*=>\s*getPreviewHomeLabel\(payload,\s*features\)/],
  ['postsEnabled', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*postsEnabled:\s*\(\)\s*=>\s*previewPostsEnabled\(features\)/],
  ['searchEnabled', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*searchEnabled:\s*\(\)\s*=>\s*previewSearchEnabled\(features\)/],
  ['getHomeHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getHomeHref/],
  ['getTabHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getTabHref/],
  ['getPostHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getPostHref/],
  ['getPostsHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getPostsHref/],
  ['getSearchHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getSearchHref/]
].forEach(([name, re]) => {
  if (!re.test(editorPreviewRuntimeSource)) fail(`assets/js/editor-preview-runtime.js must expose ctx.router.${name} for contract v4 themes`);
});
if (!/renderPostView[\s\S]*content,[\s\S]*rawMarkdown/.test(mainSource)) {
  fail('assets/main.js must pass the structured content model into post view rendering');
}
if (!/parseFrontMatter/.test(mainSource) || !/frontMatterMetadata[\s\S]*postMetadata\s*=\s*\{[\s\S]*\.\.\.frontMatterMetadata[\s\S]*location:\s*postname/.test(mainSource)) {
  fail('assets/main.js must merge the current post front matter into legacy post metadata before theme rendering');
}
if (!/renderStaticTabView[\s\S]*content,[\s\S]*rawMarkdown/.test(mainSource)) {
  fail('assets/main.js must pass the structured content model into tab view rendering');
}

CORE_RUNTIME_FILES.forEach((file) => {
  const source = read(path.join(root, file));
  FORMER_DOM_IDS.forEach((id) => {
    const directId = new RegExp(`getElementById\\(\\s*['"]${escapeRe(id)}['"]\\s*\\)`);
    const directSelector = new RegExp(`querySelector(?:All)?\\(\\s*['"]#[^'"]*${escapeRe(id)}`);
    if (directId.test(source) || directSelector.test(source)) {
      fail(`${file} directly depends on legacy DOM id "${id}" instead of the region registry`);
    }
  });
});

['contractVersion', 'engines', 'press', 'regions', 'views', 'components', 'scrollContainer', 'configSchema', 'content', 'shapes', 'handler'].forEach((needle) => {
  if (!themeContractSource.includes(needle)) {
    fail(`wwwroot/post/theme-contract/theme-contract_en.md must document manifest field ${needle}`);
  }
});

[
  path.join(root, 'assets', 'js'),
  path.join(root, 'assets', 'themes'),
  path.join(root, 'assets', 'schema'),
  path.join(root, 'wwwroot', 'post', 'theme-contract'),
  path.join(root, 'scripts')
].flatMap((dir) => collectFiles(dir))
  .concat([path.join(root, 'index.html'), path.join(root, 'index_editor.html')])
  .filter((file) => path.basename(file) !== 'test-theme-contracts.js')
  .forEach((file) => {
    const source = read(file);
    FORBIDDEN_SOURCE_PATTERNS.forEach(({ label, re }) => {
      if (re.test(source)) fail(`${rel(file)} contains removed theme compatibility residue: ${label}`);
    });
  });

const themeNames = fs.readdirSync(themesDir)
  .filter((name) => fs.statSync(path.join(themesDir, name)).isDirectory())
  .sort();

themeNames.forEach((themeName) => {
  const themeDir = path.join(themesDir, themeName);
  const manifestPath = path.join(themeDir, 'theme.json');
  const relManifest = rel(manifestPath);
  const manifest = readJson(manifestPath);
  if (!manifest) return;

  if (manifest.$schema !== '../../schema/theme.json') {
    fail(`${relManifest} must declare "$schema": "../../schema/theme.json"`);
  }
  if (!manifest.name) fail(`${relManifest} must declare name`);
  if (!manifest.version) fail(`${relManifest} must declare version`);
  if (!PRESS_THEME_CONTRACT.supportedContractVersions.includes(manifest.contractVersion)) {
    fail(`${relManifest} contractVersion must be supported by the shared theme contract surface`);
  }
  if (!manifest.engines || typeof manifest.engines.press !== 'string' || !manifest.engines.press.trim()) {
    fail(`${relManifest} must declare engines.press`);
  }

  const styles = requireList(manifest, 'styles', 'styles', relManifest);
  let styleSource = '';
  styles.forEach((entry) => {
    if (!modulePathIsSafe(entry, '.css')) {
      fail(`${relManifest} has unsafe style path "${entry}"`);
      return;
    }
    const stylePath = path.join(themeDir, entry);
    if (!fs.existsSync(stylePath)) {
      fail(`${relManifest} references missing style "${entry}"`);
      return;
    }
    styleSource += `\n${read(stylePath)}`;
  });
  if (themeName === 'native') {
    const basePath = path.join(themeDir, 'base.css');
    if (fs.existsSync(basePath)) styleSource += `\n${read(basePath)}`;
  }
  REQUIRED_STYLE_TOKENS.forEach((token) => {
    if (!styleSource.includes(token)) fail(`${relManifest} styles must expose ${token}`);
  });

  const modules = requireList(manifest, 'modules', 'modules', relManifest);
  if (!modules.length) fail(`${relManifest} modules must not be empty`);
  modules.forEach((entry) => {
    if (!modulePathIsSafe(entry, '.js')) {
      fail(`${relManifest} has unsafe module path "${entry}"`);
      return;
    }
    if (!fs.existsSync(path.join(themeDir, entry))) {
      fail(`${relManifest} references missing module "${entry}"`);
    }
  });

  const moduleSource = modules
    .map((entry) => {
      const modulePath = path.join(themeDir, entry);
      return fs.existsSync(modulePath) ? read(modulePath) : '';
    })
    .join('\n');
  if (
    /from\s+['"][^'"]*js\/i18n\.js(?:\?[^'"]*)?['"]/.test(moduleSource)
    || /import\s*\([^)]*js\/i18n\.js/.test(moduleSource)
  ) {
    fail(`${relManifest} theme modules must read i18n from ctx.i18n instead of importing js/i18n.js directly`);
  }
  if (Number(manifest.contractVersion) >= 4 && containsForbiddenV4RouteConstruction(moduleSource)) {
    fail(`${relManifest} contract v4 theme modules must use ctx.router href helpers instead of public route construction`);
  }
  FORMER_DOM_IDS.forEach((id) => {
    const directId = new RegExp(`getElementById\\(\\s*['"]${escapeRe(id)}['"]\\s*\\)`);
    const directSelector = new RegExp(`querySelector(?:All)?\\(\\s*['"]#[^'"]*${escapeRe(id)}`);
    if (directId.test(moduleSource) || directSelector.test(moduleSource)) {
      fail(`${relManifest} theme modules must not query removed DOM id "${id}"`);
    }
  });
  if (Object.prototype.hasOwnProperty.call(manifest, 'contract')) {
    fail(`${relManifest} must omit removed compatibility contract`);
  }
  if (!/return\s*\{[\s\S]*(views|effects)[\s\S]*components/.test(moduleSource)) {
    fail(`${relManifest} modules must return an explicit theme API object with views/effects and components`);
  }
  if (!/export\s+default\s+\{[\s\S]*mount[\s\S]*views[\s\S]*components[\s\S]*effects/.test(moduleSource)) {
    fail(`${relManifest} modules must export a default theme API object`);
  }

  const views = requireObject(manifest.views, 'views', relManifest);
  REQUIRED_VIEWS.forEach((view) => {
    if (!asObject(views[view])) fail(`${relManifest} views must include "${view}"`);
  });

  const regions = requireObject(manifest.regions, 'regions', relManifest);
  REQUIRED_REGIONS.forEach((region) => {
    const declaration = asObject(regions[region]);
    if (!declaration) {
      fail(`${relManifest} regions must include "${region}"`);
      return;
    }
    const aliases = Array.isArray(declaration.aliases) ? declaration.aliases.map(String) : [];
    const candidates = [region, ...aliases];
    if (!candidates.some((candidate) => sourceMentionsRegion(moduleSource, candidate))) {
      fail(`${relManifest} declares region "${region}" but no module source mentions it or its aliases`);
    }
  });

  const components = requireList(manifest, 'components', 'components', relManifest);
  REQUIRED_COMPONENTS.forEach((component) => {
    if (!components.includes(component)) {
      fail(`${relManifest} components must include "${component}"`);
    }
  });

  if (!Object.prototype.hasOwnProperty.call(manifest, 'scrollContainer')) {
    fail(`${relManifest} must declare scrollContainer`);
  }
  requireObject(manifest.configSchema, 'configSchema', relManifest);
  const content = requireObject(manifest.content, 'content', relManifest);
  const shapes = requireList(content, 'shapes', 'content.shapes', relManifest);
  REQUIRED_CONTENT_SHAPES.forEach((shape) => {
    if (!shapes.includes(shape)) fail(`${relManifest} content.shapes must include "${shape}"`);
  });

  Object.entries(views).forEach(([view, declaration]) => {
    const declared = declaredViewHandler(declaration);
    if (!declared.module || !declared.handler) {
      fail(`${relManifest} views.${view} must declare module and handler`);
    }
    if (Object.prototype.hasOwnProperty.call(declaration, 'hook') || Object.prototype.hasOwnProperty.call(declaration, 'hooks')) {
      fail(`${relManifest} views.${view} must use module/handler, not removed adapter keys`);
    }
  });
});

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Theme contract check passed for ${themeNames.length} theme packs.`);
