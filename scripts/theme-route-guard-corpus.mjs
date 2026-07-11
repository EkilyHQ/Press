import { createHash } from 'node:crypto';

export const THEME_ROUTE_GUARD_CORPUS_LOCK = Object.freeze({
  cases: 349,
  reject: 262,
  allow: 87,
  labelContentSha256: '8a19013fe4179c31d062f40871cb5e521f8baa1bd1fe8bdd5dc457aa72c572d1'
});

export const THEME_ROUTE_GUARD_CASES = Object.freeze(
  [
    [
      'assigned URLSearchParams route builder',
      'let params; params = new URLSearchParams({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'parenthesized URLSearchParams route builder',
      'const params = (new URLSearchParams({ id: post.location })); return "?" + params;',
      true
    ],
    [
      'URLSearchParams toString alias route builder',
      'const params = new URLSearchParams({ id: post.location }); const qs = params.toString(); return "?" + qs;',
      true
    ],
    ['route query alias public href', 'const qs = "id=" + post.location; return "?" + qs;', true],
    ['parenthesized route query alias public href', 'const qs = ("id=" + post.location); return "?" + qs;', true],
    ['static question mark alias public href', 'const qm = "?"; const href = qm + "id=" + post.location;', true],
    ['static equals alias public href', 'const eq = "="; const href = "?id" + eq + post.location;', true],
    [
      'conditional string route query alias public sink',
      'const qs = enabled ? "id=" + post.location : ""; location.search = qs;',
      true
    ],
    [
      'bound URL.searchParams route mutator',
      'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); return url.href;',
      true
    ],
    [
      'bound URL.searchParams delete route mutator',
      'const url = new URL(location.href); const remove = url.searchParams.delete.bind(url.searchParams); remove("id"); return url.href;',
      true
    ],
    [
      'multi declarator route key alias',
      'const unused = 1, key = "id"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true
    ],
    [
      'escaped route key alias',
      'const key = "\\u0069d"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true
    ],
    [
      'member route key alias',
      'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys.post, post.location); return url.href;',
      true
    ],
    [
      'escaped member route key alias',
      'const routeKeys = { post: "\\u0069d" }; const url = new URL(location.href); url.searchParams.set(routeKeys.post, post.location); return url.href;',
      true
    ],
    [
      'bracket member route key alias',
      'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys["post"], post.location); return url.href;',
      true
    ],
    [
      'optional bracket member route key alias',
      'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys?.["post"], post.location); return url.href;',
      true
    ],
    [
      'namespace imported route key alias',
      'import * as config from "./config.js"; const url = new URL(location.href); url.searchParams.set(config.key, post.location); return url.href;',
      true,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }
    ],
    ['escaped JS public route literal', 'export const href = "?\\u0069d=post.md";', true],
    [
      'URL.searchParams alias route mutation',
      'const url = new URL(location.href); const params = url.searchParams; params.set("id", post.location); return url.href;',
      true
    ],
    [
      'location.search route query alias',
      'const routeKey = "id"; const qs = routeKey + "=" + post.location; location.search = qs;',
      true
    ],
    ['location.search multiline route query assignment', 'location.search =\n  "id=" + post.location;', true],
    [
      'location.search URLSearchParams route query assignment',
      'location.search = new URLSearchParams({ id: post.location });',
      true
    ],
    [
      'location object alias route query sink',
      'const loc = location; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs;',
      true
    ],
    [
      'destructured location alias route query sink',
      'const { location: loc } = window; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs;',
      true
    ],
    [
      'location bracket route query sink',
      'const routeKey = "id"; window.location["search"] = routeKey + "=" + post.location;',
      true
    ],
    [
      'member URLSearchParams route builder',
      'state.params = new URLSearchParams({ id: post.location }); return "?" + state.params;',
      true
    ],
    [
      'Object.entries URLSearchParams route builder',
      'const params = new URLSearchParams(Object.entries({ id: post.location })); return "?" + params;',
      true
    ],
    [
      'Map URLSearchParams route builder',
      'const params = new URLSearchParams(new Map([["id", post.location]])); return "?" + params;',
      true
    ],
    [
      'String-wrapped URLSearchParams route builder',
      'const params = new URLSearchParams({ id: post.location }); return "?" + String(params);',
      true
    ],
    [
      'inline URL searchParams alias builder',
      'const params = new URL(location.href).searchParams; params.set("id", post.location); return "?" + params;',
      true
    ],
    [
      'parenthesized URL.searchParams alias mutation',
      'const url = new URL(location.href); const params = (url.searchParams); params.set("id", post.location); return url.href;',
      true
    ],
    [
      'destructured URL.searchParams alias mutation',
      'const url = new URL(location.href); const { searchParams } = url; searchParams.set("id", post.location); return url.href;',
      true
    ],
    [
      'computed destructured URL.searchParams alias mutation',
      'const url = new URL(location.href); const { ["searchParams"]: params } = url; params.set("id", post.location); return url.href;',
      true
    ],
    [
      'inline computed destructured URL.searchParams alias mutation',
      'const { ["searchParams"]: params } = new URL(location.href); params.set("id", post.location); return "?" + params;',
      true
    ],
    [
      'destructured URL.searchParams mutator alias dispatch',
      'const url = new URL(location.href); const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); return url.href;',
      true
    ],
    [
      'destructured URL.searchParams mutator alias bracket dispatch',
      'const url = new URL(location.href); const { set } = url.searchParams; set["call"](getTarget(a, b), "id", post.location); return url.href;',
      true
    ],
    [
      'computed destructured URL.searchParams mutator alias',
      'const url = new URL(location.href); const { ["append"]: appendParam } = url.searchParams; appendParam("tab", "posts"); return url.href;',
      true
    ],
    [
      'bracket URL.searchParams route key mutation',
      'const url = new URL(location.href); url.searchParams["set"]("id", post.location); return url.href;',
      true
    ],
    [
      'optional URL.searchParams route key mutation',
      'const url = new URL(location.href); url.searchParams?.set("tab", "posts"); return url.href;',
      true
    ],
    [
      'optional bracket URL.searchParams route key mutation',
      'const url = new URL(location.href); url["searchParams"]?.["append"]("id", post.location); return url.href;',
      true
    ],
    [
      'optional call URL.searchParams route key mutation',
      'const url = new URL(location.href); url.searchParams.set?.("id", post.location); return url.href;',
      true
    ],
    [
      'URL.search route key assignment',
      'const key = "id"; const url = new URL(location.href); url.search = key + "=" + post.location; return url.href;',
      true
    ],
    [
      'URL.search operator line continuation',
      'const key = "id"; const url = new URL(location.href); url.search = key +\n  "=" + post.location; return url.href;',
      true
    ],
    [
      'URL.search URLSearchParams route assignment',
      'const url = new URL(location.href); url.search = new URLSearchParams({ id: post.location }); return url.href;',
      true
    ],
    ['split route literal with assembled static key', 'return "?" + ("i" + "d" + "=" + post.location);', true],
    [
      'route URL member assignment',
      'state.url = new URL(location.href); state.url.searchParams.set("id", post.location); return state.url.href;',
      true
    ],
    [
      'route URL bracket member assignment',
      'state["url"] = new URL(location.href); state["url"].searchParams.set("id", post.location); return state["url"].href;',
      true
    ],
    [
      'route URL factory helper result',
      'function currentUrl() { return new URL(location.href); } const url = currentUrl(); url.searchParams.set("id", post.location); return url.href;',
      true
    ],
    [
      'route URL function expression factory result',
      'const currentUrl = function() { return new URL(location.href); }; const url = currentUrl(); url.searchParams.set("id", post.location); return url.href;',
      true
    ],
    [
      'direct route URL factory helper mutation',
      'function currentUrl() { return new URL(location.href); } currentUrl().searchParams.set("id", post.location);',
      true
    ],
    [
      'window URLSearchParams route builder',
      'const params = new window.URLSearchParams({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'URLSearchParams constructor alias route builder',
      'const Params = URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'globalThis URLSearchParams constructor alias route builder',
      'const Params = globalThis.URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'destructured URLSearchParams constructor alias route builder',
      'const { URLSearchParams: Params } = window; const params = new Params({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'conditional URLSearchParams route builder',
      'const params = enabled ? new URLSearchParams({ id: post.location }) : new URLSearchParams(); return "?" + params;',
      true
    ],
    [
      'URL.searchParams delete route key',
      'const url = new URL(location.href); url.searchParams.delete("id"); return url.href;',
      true
    ],
    [
      'URL.searchParams call route key mutation',
      'const url = new URL(location.href); url.searchParams.set.call(url.searchParams, "id", post.location); return url.href;',
      true
    ],
    [
      'URL.searchParams call route key mutation with comma receiver',
      'const url = new URL(location.href); url.searchParams.set.call(getTarget(a, b), "id", post.location); return url.href;',
      true
    ],
    [
      'URL.searchParams bracket call route key mutation',
      'const url = new URL(location.href); url.searchParams.set["call"](url.searchParams, "id", post.location); return url.href;',
      true
    ],
    [
      'URL.searchParams apply route key mutation',
      'const url = new URL(location.href); url.searchParams.set.apply(url.searchParams, ["id", post.location]); return url.href;',
      true
    ],
    [
      'bracket optional call URL.searchParams route key mutation',
      'const url = new URL(location.href); url.searchParams["append"]?.("tab", "posts"); return url.href;',
      true
    ],
    [
      'bracket URL.searchParams alias route key mutation',
      'const url = new URL(location.href); const params = url.searchParams; params["append"]("tab", "posts"); return url.href;',
      true
    ],
    [
      'bracket URL.searchParams alias collection route key mutation',
      'const url = new URL(location.href); const params = url["searchParams"]; params.set("id", post.location); return url.href;',
      true
    ],
    [
      'optional URL.searchParams alias collection route key mutation',
      'const url = new URL(location.href); const params = url?.searchParams; params.set("id", post.location); return url.href;',
      true
    ],
    [
      'inline bracket URL.searchParams alias route key mutation',
      'const params = new URL(location.href)["searchParams"]; params.set("id", post.location); return "?" + params;',
      true
    ],
    [
      'direct chained URL.searchParams route key mutation',
      'new URL(location.href).searchParams.set("id", post.location);',
      true
    ],
    [
      'helper mutates route URL route key',
      'function mutate(url) { url.searchParams.set("id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'helper mutates route URL searchParams alias route key',
      'function mutate(url) { const params = url.searchParams; params.set("id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'bound helper mutates route URL route key',
      'function mutate(url) { url.searchParams.set("id", post.location); } const bound = mutate.bind(null, new URL(location.href)); bound();',
      true
    ],
    [
      'Object.assign helper mutates route URL route key',
      'const helpers = {}; Object.assign(helpers, { mutate(url) { url.searchParams.set("id", post.location); } }); helpers.mutate(new URL(location.href));',
      true
    ],
    [
      'Reflect.set helper mutates route URL route key',
      'const helpers = {}; Reflect.set(helpers, "mutate", function(url) { url.searchParams.set("id", post.location); }); helpers.mutate(new URL(location.href));',
      true
    ],
    [
      'helper mutates external URL route key stays allowed',
      'function mutate(url) { url.searchParams.set("id", sku); } mutate(new URL("https://api.example.test/product"));',
      false
    ],
    [
      'bound helper mutates external URL route key stays allowed',
      'function mutate(url) { url.searchParams.set("id", sku); } const bound = mutate.bind(null, new URL("https://api.example.test/product")); bound();',
      false
    ],
    [
      'window URL route key mutation',
      'const url = new window.URL(location.href); url.searchParams.set("id", post.location); return url.href;',
      true
    ],
    [
      'external split query string',
      'const externalBase = "https://api.example.test/product"; return externalBase + "?id=" + sku;',
      false
    ],
    ['external split tab string', 'return "https://api.example.test/product" + "?tab=posts";', false],
    [
      'external URL static relative path alias',
      'const externalBase = "https://api.example.test"; const productPath = "/product"; const url = new URL(productPath, externalBase); url.searchParams.set("id", sku); return url.href;',
      false
    ],
    [
      'external bracket URL searchParams allowed',
      'const url = new URL("https://api.example.test/product"); url.searchParams["set"]("id", sku); return url.href;',
      false
    ],
    [
      'external optional call URL searchParams allowed',
      'const url = new URL("https://api.example.test/product"); url.searchParams.set?.("id", sku); return url.href;',
      false
    ],
    [
      'external URL object alias',
      'const externalBase = new URL("https://api.example.test"); const url = new URL("/product", externalBase); url.searchParams.set("id", sku); return url.href;',
      false
    ],
    [
      'external URL object member alias',
      'const endpoints = { product: "https://api.example.test/product" }; const url = new URL(endpoints.product); url.searchParams.set("id", sku); return url.href;',
      false
    ],
    [
      'cross-file imported external URL alias context',
      'import { endpoint } from "./config.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file default route key alias',
      'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;',
      true,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "id";' }] }
    ],
    [
      'cross-file escaped default route key alias',
      'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;',
      true,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "\\u0069d";' }] }
    ],
    [
      'cross-file const default route key alias',
      'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'const routeKey = "id"; export default routeKey;' }]
      }
    ],
    [
      'cross-file local default export route key alias',
      'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'const routeKey = "id"; export { routeKey as default };' }]
      }
    ],
    [
      'cross-file default route URL factory assignment',
      'import makeUrl from "./url.js"; const url = makeUrl(); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/url.js', source: 'export default function makeUrl() { return new URL(location.href); }' }
        ]
      }
    ],
    [
      'cross-file parenthesized default route URL factory assignment',
      'import makeUrl from "./url.js"; const url = makeUrl(); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/url.js', source: 'export default (function makeUrl() { return new URL(location.href); });' }
        ]
      }
    ],
    [
      'cross-file parenthesized default arrow route URL factory assignment',
      'import makeUrl from "./url.js"; const url = makeUrl(); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/url.js', source: 'export default (() => new URL(location.href));' }]
      }
    ],
    [
      'cross-file default route URL factory direct mutation',
      'import makeUrl from "./url.js"; makeUrl().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'const makeUrl = () => new URL(location.href); export { makeUrl as default };'
          }
        ]
      }
    ],
    [
      'cross-file default route URL factory alias direct mutation',
      'import makeUrl from "./url.js"; const routeFactory = makeUrl; routeFactory().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'const makeUrl = () => new URL(location.href); export { makeUrl as default };'
          }
        ]
      }
    ],
    [
      'cross-file route URL factory object property alias direct mutation',
      'import { makeUrl } from "./url.js"; const helper = { makeUrl }; helper.makeUrl().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }]
      }
    ],
    [
      'cross-file route URL factory quoted object property alias direct mutation',
      'import { makeUrl } from "./url.js"; const helper = { "routeFactory": makeUrl }; helper.routeFactory().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }]
      }
    ],
    [
      'cross-file route URL factory bracket member assignment',
      'import { makeUrl } from "./url.js"; state["url"] = makeUrl(); state["url"].searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }]
      }
    ],
    [
      'cross-file route URL factory return after fake function string',
      'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'export function makeUrl() { const marker = "function fake() {"; return new URL(location.href); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory shadowed param',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(location.href); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl(externalRoot) { return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory shadowed after string brace',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { const marker = "{"; const externalRoot = location.href; return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory shadowed in return block',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { if (ok) { const externalRoot = location.href; return new URL("/product", externalRoot); } return new URL("/fallback", "https://api.example.test"); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory shadowed by array destructuring',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { const [externalRoot] = [location.href]; return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external template route context',
      'import { endpoint } from "./config.js"; return `${endpoint}?id=sku-123`;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external query alias context',
      'import { endpoint } from "./config.js"; const qs = "id=" + sku; return `${endpoint}?${qs}`;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external query alias concat context',
      'import { endpoint } from "./config.js"; const qs = "id=" + sku; return endpoint + "?" + qs;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file default external URL template query alias context',
      'import endpoint from "./config.js"; const qs = "id=" + sku; return `${endpoint}?${qs}`;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export default "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file default identifier external URL query alias context',
      'import endpoint from "./config.js"; const qs = "id=" + sku; return endpoint + "?" + qs;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/config.js',
            source: 'const endpoint = "https://api.example.test/product"; export default endpoint;'
          }
        ]
      }
    ],
    [
      'cross-file local default export external URL query alias context',
      'import endpoint from "./config.js"; const qs = "id=" + sku; return endpoint + "?" + qs;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/config.js',
            source: 'const endpoint = "https://api.example.test/product"; export { endpoint as default };'
          }
        ]
      }
    ],
    [
      'cross-file mixed named external URL alias context',
      'import unused, { endpoint as mixedEndpoint } from "./config.js"; const url = new URL(mixedEndpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/config.js',
            source: 'export default "unused"; export const endpoint = "https://api.example.test/product";'
          }
        ]
      }
    ],
    [
      'cross-file commented default route key alias ignored',
      'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: '// export default "id";\nexport default "slug";' }]
      }
    ],
    [
      'cross-file commented external URL alias ignored',
      'import { endpoint } from "./config.js"; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/config.js',
            source: '// const endpoint = "https://api.example.test/product";\nexport const endpoint = location.href;'
          }
        ]
      }
    ],
    ['commented public route literal is ignored', '// return "?id=post.md";\nreturn router.getPostHref(post);', false],
    [
      'HTML commented public route literal is ignored',
      '<!-- <a href="?id=post.md">old</a> -->\n<a href="${href}">New</a>',
      false
    ],
    ['HTML unquoted public route attribute', '<a href=?id=post.md>Post</a>', true],
    ['HTML escaped equals public route attribute', '<a href="?id&#61;post.md">Post</a>', true],
    ['HTML escaped ampersand public route attribute', '<a href="?foo=1&amp;id=post.md">Post</a>', true],
    ['HTML numeric route key public route attribute', '<a href="?&#105;d=post.md">Post</a>', true],
    ['HTML padded numeric query public route attribute', '<a href="&#00063;id&#00061;post.md">Post</a>', true],
    [
      'HTML https text before public route attribute',
      '<p>https://example.test</p><a href="?id=post.md">Post</a>',
      true,
      { path: 'assets/link.html', files: [] }
    ],
    [
      'HTML srcset public route attribute',
      '<img srcset="?id=post.md 1x, ?tab=posts 2x">',
      true,
      { path: 'assets/card.html', files: [] }
    ],
    [
      'HTML inline script public route builder',
      '<script>location.search = "id=" + post.location;</script>',
      true,
      { path: 'assets/card.html', files: [] }
    ],
    [
      'HTML inline script public route builder with loose end tag',
      '<script>location.search = "id=" + post.location;</script\t\n data-x>',
      true,
      { path: 'assets/card.html', files: [] }
    ],
    [
      'HTML event handler public route builder',
      `<button onclick="location.search = '?id=post.md'">Open</button>`,
      true,
      { path: 'assets/card.html', files: [] }
    ],
    [
      'HTML JSON script route data is ignored',
      '<script type="application/json">{"href":"?id=post.md"}</script>',
      false,
      { path: 'assets/data.html', files: [] }
    ],
    [
      'JS comment with HTML route attribute is ignored',
      '// <a href="?id=post.md">old</a>\nreturn router.getPostHref(post);',
      false,
      { path: 'modules/layout.js', files: [] }
    ],
    [
      'JS regex literal does not hide later route literal',
      'const re = /^https?:\\/\\//; return "?id=post.md";',
      true,
      { path: 'modules/layout.js', files: [] }
    ],
    [
      'CSS asset query string is not executable route code',
      'body { background: url("/sprite.svg?id=foo"); }',
      false,
      { path: 'theme.css', files: [] }
    ],
    [
      'JSON asset query string is not executable route code',
      '{"href":"?tab=posts"}',
      false,
      { path: 'assets/data.json', files: [] }
    ],
    [
      'parenthesized external URL relative path',
      'const externalBase = "https://api.example.test"; const url = new URL(("/product?id=sku-123"), externalBase); url.searchParams.set("id", sku); return url.href;',
      false
    ],
    [
      'nested same-name external endpoint helper keeps imported alias available',
      'import { endpoint } from "./config.js"; function preview(endpoint) { return new URL(endpoint).href; } const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'block-scoped imported external alias shadowing',
      'import { endpoint } from "./config.js"; if (ok) { const endpoint = location.href; const url = new URL(endpoint); url.searchParams.set("id", post.location); }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'local external alias parameter shadowing',
      'const endpoint = "https://api.example.test/product"; export function route(endpoint, post) { return endpoint + "?id=" + post.id; }',
      true,
      { path: 'modules/layout.js', files: [] }
    ],
    [
      'catch imported external alias shadowing',
      'import { endpoint } from "./config.js"; try { throw location.href; } catch (endpoint) { const url = new URL(endpoint); url.searchParams.set("id", post.location); }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'nested helper external alias does not mask parameter shadowing',
      'import { endpoint } from "./config.js"; export function route(endpoint, post) { function helper() { const endpoint = "https://api.example.test/product"; return endpoint; } const url = new URL(endpoint); url.searchParams.set("id", post.location); return helper() || url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'array destructured external alias shadowing',
      'import { endpoint } from "./config.js"; export function route([endpoint], post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'body array destructured external alias shadowing',
      'import { endpoint } from "./config.js"; export function route(post) { const [endpoint] = [location.href]; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'renamed default destructured external alias shadowing',
      'import { endpoint } from "./config.js"; export function route({ endpoint: endpoint = location.href }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'for-loop external alias shadowing',
      'import { endpoint } from "./config.js"; for (const endpoint of [location.href]) { const url = new URL(endpoint); url.searchParams.set("id", post.location); }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'string brace does not truncate shadowed body scan',
      'import { endpoint } from "./config.js"; export function route(endpoint, post) { const marker = "}"; return endpoint + "?id=" + post.id; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file barrel external URL alias context',
      'import { endpoint } from "./barrel.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' },
          { path: 'modules/barrel.js', source: 'export { endpoint } from "./config.js";' }
        ]
      }
    ],
    [
      'cross-file local-export barrel external URL alias context',
      'import { endpoint } from "./barrel.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' },
          { path: 'modules/barrel.js', source: 'import { endpoint } from "./config.js"; export { endpoint };' }
        ]
      }
    ],
    [
      'cross-file star barrel external URL alias context',
      'import { endpoint } from "./barrel.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' },
          { path: 'modules/barrel.js', source: 'export * from "./config.js";' }
        ]
      }
    ],
    [
      'cross-file external URL alias shadowing',
      'import { endpoint } from "./config.js"; function route(endpoint, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL destructured param shadowing',
      'import { endpoint } from "./config.js"; function route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL arrow destructured param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL default arrow param shadowing',
      'import { endpoint } from "./config.js"; export default (endpoint, post) => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL expression arrow param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => endpoint + "?id=" + post.location;',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline callback param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href))(new URL(endpoint));',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline block callback param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => { url.searchParams.set("id", post.location); return url.href; })(new URL(endpoint));',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline function callback param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (function(url) { url.searchParams.set("id", post.location); return url.href; })(new URL(endpoint));',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline async function callback param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (async function(url) { url.searchParams.set("id", post.location); return url.href; })(new URL(endpoint));',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL helper mutator param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const mutate = (url) => { url.searchParams.set("id", post.location); return url.href; }; return mutate(new URL(endpoint)); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL expression helper mutator param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const mutate = (url) => (url.searchParams.set("id", post.location), url.href); return mutate(new URL(endpoint)); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline callback call param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href)).call(null, new URL(endpoint));',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline callback complex call param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href)).call(getThis(a, b), new URL(endpoint));',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL inline callback apply param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href)).apply(null, [new URL(endpoint)]);',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL helper mutator call param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } return mutate.call(null, new URL(endpoint)); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL helper mutator apply param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } return mutate.apply(null, [new URL(endpoint)]); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL object helper mutator param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const helper = { mutate(url) { url.searchParams.set("id", post.location); return url.href; } }; return helper.mutate(new URL(endpoint)); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL bound helper mutator param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } const bound = mutate.bind(null); return bound(new URL(endpoint)); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL prebound helper mutator param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } const bound = mutate.bind(null, new URL(endpoint)); return bound(); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL second-arg helper mutator param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(ctx, url) { url.searchParams.set("id", post.location); return url.href; } return mutate(null, new URL(endpoint)); };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'sibling helper shadow does not hide active mutator',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } if (a) { function mutate(url) { return url.href; } } if (b) { return mutate(new URL(location.href)); }',
      true
    ],
    [
      'nested mutating helper in one-arg function is rejected',
      'export function route(post) { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } return mutate(new URL(location.href)); }',
      true
    ],
    [
      'multi-arg object helper mutator is rejected',
      'const helper = { mutate(ctx, url) { url.searchParams.set("id", "post.md"); return url.href; } }; return helper.mutate(null, new URL(location.href));',
      true
    ],
    [
      'helper URL.search assignment is rejected',
      'function mutate(url) { url.search = "id=" + post.location; return url.href; } return mutate(new URL(location.href));',
      true
    ],
    [
      'parenthesized direct helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate((new URL(location.href)));',
      true
    ],
    [
      'parenthesized call helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate.call(null, (new URL(location.href)));',
      true
    ],
    [
      'parenthesized apply helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate.apply(null, [(new URL(location.href))]);',
      true
    ],
    [
      'parenthesized inline callback direct URL is rejected',
      'return ((url) => (url.searchParams.set("id", "post.md"), url.href))((new URL(location.href)));',
      true
    ],
    [
      'optional direct helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate?.(new URL(location.href));',
      true
    ],
    [
      'optional call helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } mutate?.call(null, new URL(location.href)); mutate?.apply(null, [new URL(location.href)]);',
      true
    ],
    [
      'object property helper mutator alias is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate }; return helper.mutate(new URL(location.href));',
      true
    ],
    [
      'quoted object property helper mutator alias is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { "routeMutator": mutate }; return helper.routeMutator(new URL(location.href));',
      true
    ],
    [
      'quoted object helper mutator key is rejected',
      'const helper = { "mutate": (url) => { url.searchParams.set("id", "post.md"); return url.href; } }; return helper.mutate(new URL(location.href));',
      true
    ],
    [
      'computed object helper mutator key is rejected',
      'const helper = { ["mutate"](url) { url.searchParams.set("id", "post.md"); return url.href; } }; return helper.mutate(new URL(location.href));',
      true
    ],
    [
      'static key object helper mutator call is rejected',
      'const helper = { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }; const key = "mutate"; return helper[key](new URL(location.href));',
      true
    ],
    [
      'member assignment helper mutator alias is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } helper.routeMutator = mutate; return helper.routeMutator(new URL(location.href));',
      true
    ],
    [
      'destructured member helper mutator alias is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate }; const { mutate: routeMutator } = helper; return routeMutator(new URL(location.href));',
      true
    ],
    [
      'bracket call helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate["call"](null, new URL(location.href));',
      true
    ],
    [
      'bracket bind helper mutator URL is rejected',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const bound = mutate["bind"](null); return bound(new URL(location.href));',
      true
    ],
    [
      'optional inline callback direct URL is rejected',
      'return ((url) => (url.searchParams.set("id", "post.md"), url.href))?.(new URL(location.href));',
      true
    ],
    [
      'bracket inline callback call URL is rejected',
      'return ((url) => (url.searchParams.set("id", "post.md"), url.href))["call"](null, new URL(location.href));',
      true
    ],
    [
      'multi-arg block arrow callback direct URL is rejected',
      'return ((ctx, url) => { url.searchParams.set("id", "post.md"); return url.href; })("ctx", new URL(location.href));',
      true
    ],
    [
      'multi-arg function callback call URL is rejected',
      'return (function(ctx, url) { url.searchParams.set("id", "post.md"); return url.href; }).call(null, "ctx", new URL(location.href));',
      true
    ],
    [
      'multi-arg inline callback call is rejected',
      'return ((ctx, url) => (url.searchParams.set("id", "post.md"), url.href)).call(null, "ctx", new URL(location.href));',
      true
    ],
    [
      'multi-arg inline callback apply is rejected',
      'return ((ctx, url) => (url.searchParams.set("id", "post.md"), url.href)).apply(null, ["ctx", new URL(location.href)]);',
      true
    ],
    [
      'cross-file external URL multiline expression arrow param shadowing',
      'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (\n  endpoint + "?id=" + post.location\n);',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL single expression arrow param shadowing',
      'import { endpoint } from "./config.js"; export default endpoint => endpoint + "?tab=posts";',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL async single arrow param shadowing',
      'import { endpoint } from "./config.js"; const route = async endpoint => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL defaulted destructured param shadowing',
      'import { endpoint } from "./config.js"; function route({ endpoint = location.href }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL object method destructured param shadowing',
      'import { endpoint } from "./config.js"; export default { route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; } };',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file external URL nested local does not shadow mount',
      'import { endpoint } from "./config.js"; function helper() { const endpoint = "local"; return endpoint; } const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external URL inline callback context',
      'import { endpoint } from "./config.js"; ((url) => (url.searchParams.set("id", sku), url.href))(new URL(endpoint));',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external URL helper mutator context',
      'import { endpoint } from "./config.js"; const mutate = (url) => { url.searchParams.set("id", sku); return url.href; }; mutate(new URL(endpoint));',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external URL factory context',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory ignores sibling shadow context',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { if (ok) { const externalRoot = location.href; void externalRoot; } return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory ignores nested helper var context',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { function helper() { var externalRoot = location.href; return externalRoot; } void helper; return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory ignores fake declaration string context',
      'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' },
          {
            path: 'modules/url.js',
            source:
              'import { externalRoot } from "./config.js"; export function makeProductUrl() { const marker = "const externalRoot = x"; return new URL("/product", externalRoot); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory ignores nested imported-name route helper context',
      'import { makeProductUrl } from "./url.js"; function setup() { function makeProductUrl() { return new URL(location.href); } void makeProductUrl; } void setup; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'export function makeProductUrl() { return new URL("/product", "https://api.example.test"); }'
          }
        ]
      }
    ],
    [
      'cross-file imported external URL factory rejects active nested imported-name route helper',
      'import { makeProductUrl } from "./url.js"; function setup(post) { function makeProductUrl() { return new URL(location.href); } makeProductUrl().searchParams.set("id", post.location); } void setup;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'export function makeProductUrl() { return new URL("/product", "https://api.example.test"); }'
          }
        ]
      }
    ],
    [
      'nested route factory does not leak into safe sibling local factory',
      'function setup() { function makeUrl() { return new URL(location.href); } void makeUrl; } function route() { const makeUrl = () => new URL("https://api.example.test/product"); const url = makeUrl(); url.searchParams.set("id", sku); return url.href; }',
      false
    ],
    [
      'nested route factory member assignment is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } state.url = makeUrl(); state.url.searchParams.set("id", post.location); return state.url.href; }',
      true
    ],
    [
      'nested route factory descendant same-name shadow stays safe',
      'function route() { function makeUrl() { return new URL(location.href); } function inner() { function makeUrl() { return new URL("https://api.example.test/product"); } const url = makeUrl(); url.searchParams.set("id", sku); return url.href; } return inner; }',
      false
    ],
    [
      'nested route factory descendant same-name search assignment stays safe',
      'function route() { function makeUrl() { return new URL(location.href); } function inner() { function makeUrl() { return new URL("https://api.example.test/product"); } makeUrl().search = "id=" + sku; } return inner; }',
      false
    ],
    [
      'single-param block arrow route factory direct mutation is rejected',
      'function route(post) { const makeUrl = base => { return new URL(location.href); }; makeUrl(location.href).searchParams.set("id", post.location); }',
      true
    ],
    [
      'var route factory shadows imported factory for whole function',
      'import { makeProductUrl } from "./url.js"; export function mount(post) { if (post) { var makeProductUrl = () => new URL(location.href); } makeProductUrl().searchParams.set("id", post.location); }',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'export function makeProductUrl() { return new URL("/product", "https://api.example.test"); }'
          }
        ]
      }
    ],
    [
      'nested route factory nested call args direct mutation is rejected',
      'function route(post) { function makeUrl(base) { return new URL(location.href); } makeUrl(getBase()).searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory direct searchParams alias is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const params = makeUrl().searchParams; params.set("id", post.location); }',
      true
    ],
    [
      'nested route factory parenthesized searchParams alias is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const params = (makeUrl()).searchParams; params.set("id", post.location); }',
      true
    ],
    [
      'nested route factory parenthesized destructured searchParams alias is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const { searchParams } = (makeUrl()); searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory destructured searchParams default is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const url = makeUrl(); const { searchParams = new URLSearchParams() } = url; searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory direct destructured searchParams default is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const { searchParams = new URLSearchParams() } = makeUrl(); searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory computed destructured searchParams alias is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const { ["searchParams"]: params } = makeUrl(); params.set("id", post.location); }',
      true
    ],
    [
      'nested route factory direct searchParams dispatch is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set.call(makeUrl().searchParams, "id", post.location); makeUrl().searchParams.set.apply(makeUrl().searchParams, ["tab", "posts"]); }',
      true
    ],
    [
      'nested route factory searchParams dispatch with comma receiver is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set.call(getTarget(a, b), "id", post.location); makeUrl().searchParams.set.apply(getTarget(a, b), ["tab", "posts"]); }',
      true
    ],
    [
      'nested route factory optional searchParams dispatch is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set?.call(getTarget(a, b), "id", post.location); makeUrl().searchParams.set?.apply(getTarget(a, b), ["tab", "posts"]); }',
      true
    ],
    [
      'nested route factory parenthesized callee mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } (makeUrl)().searchParams.set("id", post.location); ((makeUrl))().search = "tab=posts"; }',
      true
    ],
    [
      'nested route factory call direct mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl.call(null).searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory apply assignment mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const url = makeUrl.apply(null, []); url.searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory bracket member assignment is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } state["url"] = makeUrl(); state["url"].searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory alias direct mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const routeFactory = makeUrl; routeFactory().searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory member assignment alias direct mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } helper.routeFactory = makeUrl; helper.routeFactory().searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory object property alias direct mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const helper = { makeUrl }; helper.makeUrl().searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory quoted object property alias direct mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const helper = { "routeFactory": makeUrl }; helper.routeFactory().searchParams.set("id", post.location); }',
      true
    ],
    [
      'nested route factory destructured member alias direct mutation is rejected',
      'function route(post) { function makeUrl() { return new URL(location.href); } const helper = { makeUrl }; const { makeUrl: routeFactory } = helper; routeFactory().searchParams.set("id", post.location); }',
      true
    ],
    [
      'object method route factory direct mutation is rejected',
      'function route(post) { const helper = { makeUrl() { return new URL(location.href); } }; helper.makeUrl().searchParams.set("id", post.location); }',
      true
    ],
    [
      'quoted object method route factory direct mutation is rejected',
      'function route(post) { const helper = { "makeUrl"() { return new URL(location.href); } }; helper.makeUrl().searchParams.set("id", post.location); }',
      true
    ],
    [
      'computed object method route factory direct mutation is rejected',
      'function route(post) { const helper = { ["makeUrl"]() { return new URL(location.href); } }; helper.makeUrl().searchParams.set("id", post.location); }',
      true
    ],
    [
      'static key object method route factory direct mutation is rejected',
      'function route(post) { const helper = { makeUrl() { return new URL(location.href); } }; const key = "makeUrl"; helper[key]().searchParams.set("id", post.location); }',
      true
    ],
    [
      'inline new URL searchParams dispatch with comma receiver is rejected',
      'new URL(location.href).searchParams.set.call(getTarget(a, b), "id", post.location);',
      true
    ],
    [
      'inline new URL optional searchParams dispatch is rejected',
      'new URL(location.href).searchParams.set?.call(getTarget(a, b), "id", post.location);',
      true
    ],
    [
      'cross-file imported route factory parenthesized callee mutation is rejected',
      'import { makeUrl } from "./url.js"; export function route(post) { (makeUrl)().searchParams.set("id", post.location); }',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }]
      }
    ],
    [
      'returned route URL variable factory mutation is rejected',
      'function makeUrl() { const url = new URL(location.href); return url; } makeUrl().searchParams.set("id", post.location);',
      true
    ],
    [
      'cross-file returned route URL variable factory mutation is rejected',
      'import { makeUrl } from "./url.js"; export function route(post) { makeUrl().searchParams.set("id", post.location); }',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'export function makeUrl() { const url = new URL(location.href); return url; }'
          }
        ]
      }
    ],
    [
      'async route URL factory mutation is rejected',
      'async function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set("id", post.location);',
      true
    ],
    [
      'awaited route URL factory assignment mutation is rejected',
      'function makeUrl() { return new URL(location.href); } export async function route(post) { const url = await makeUrl(); url.searchParams.set("id", post.location); }',
      true
    ],
    [
      'default export object route factory helper is rejected',
      'export default { makeUrl() { return new URL(location.href); }, mount(post) { this.makeUrl().searchParams.set("id", post.location); } };',
      true
    ],
    [
      'named default export object route factory helper is rejected',
      'const theme = { makeUrl() { return new URL(location.href); }, mount(post) { this.makeUrl().searchParams.set("id", post.location); }, views: {}, components: {}, effects: {} }; export default theme;',
      true
    ],
    [
      'local named default export object route factory helper is rejected',
      'const theme = { makeUrl() { return new URL(location.href); }, mount(post) { this.makeUrl().searchParams.set("id", post.location); }, views: {}, components: {}, effects: {} }; export { theme as default };',
      true
    ],
    [
      'computed searchParams access is rejected',
      'const url = new URL(location.href); url["search" + "Params"].set("id", post.location);',
      true
    ],
    [
      'computed route factory searchParams access is rejected',
      'function makeUrl() { return new URL(location.href); } makeUrl()["search" + "Params"].set("id", post.location);',
      true
    ],
    [
      'computed searchParams mutator access is rejected',
      'const url = new URL(location.href); url.searchParams["se" + "t"]("id", post.location);',
      true
    ],
    [
      'aliased searchParams mutator access is rejected',
      'const method = "set"; const url = new URL(location.href); url.searchParams[method]("id", post.location);',
      true
    ],
    ['computed location search assignment is rejected', 'location["se" + "arch"] = "id=" + post.location;', true],
    [
      'imported route key alias shadowed by local const stays safe',
      'import { key } from "./config.js"; export function route(post) { const key = "sku"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }',
      false,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }
    ],
    [
      'imported route key alias shadowed by function param stays safe',
      'import { key } from "./config.js"; export function route(key, post) { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }',
      false,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }
    ],
    [
      'same-name object method route factory stays safe',
      'function route() { function makeUrl() { return new URL(location.href); } const helper = { makeUrl() { return new URL("https://api.example.test/product"); } }; helper.makeUrl().searchParams.set("id", sku); }',
      false
    ],
    [
      'spaced same-name object method route factory stays safe',
      'function route() { function makeUrl() { return new URL(location.href); } const helper = { makeUrl() { return new URL("https://api.example.test/product"); } }; helper . makeUrl().searchParams.set("id", sku); helper ?. makeUrl().searchParams.set("tab", "posts"); }',
      false
    ],
    [
      'route factory alias local shadow stays safe',
      'function makeUrl() { return new URL(location.href); } function route() { function makeUrl() { return new URL("https://api.example.test/product"); } const routeFactory = makeUrl; routeFactory().searchParams.set("id", sku); }',
      false
    ],
    [
      'route factory member alias local shadow stays safe',
      'function makeUrl() { return new URL(location.href); } function route() { function makeUrl() { return new URL("https://api.example.test/product"); } const helper = {}; helper.routeFactory = makeUrl; helper.routeFactory().searchParams.set("id", sku); }',
      false
    ],
    [
      'route factory member alias string fixture stays safe',
      'function makeUrl() { return new URL(location.href); } const helper = {}; const marker = "helper.routeFactory = makeUrl"; helper.routeFactory = () => new URL("https://api.example.test/product"); helper.routeFactory().searchParams.set("id", sku);',
      false
    ],
    [
      'cross-file imported external URL object and bound helper mutator context',
      'import { endpoint } from "./config.js"; const helper = { mutate(url) { url.searchParams.set("id", sku); return url.href; } }; function mutate(url) { url.searchParams.set("id", sku); return url.href; } const bound = mutate.bind(null); helper.mutate(new URL(endpoint)); bound(new URL(endpoint));',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external URL second-arg and bound helper mutator context',
      'import { endpoint } from "./config.js"; function mutate(ctx, url) { url.searchParams.set("id", sku); return url.href; } const bound = mutate.bind(null, "ctx"); mutate("ctx", new URL(endpoint)); bound(new URL(endpoint));',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external URL optional helper mutator context',
      'import { endpoint } from "./config.js"; function mutate(url) { url.searchParams.set("id", sku); return url.href; } mutate?.(new URL(endpoint)); mutate["call"](null, new URL(endpoint));',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-scope helper mutator name does not leak',
      'function setup() { function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } function route() { function mutate(url) { return url.href; } return mutate(new URL(location.href)); }',
      false
    ],
    [
      'nested helper mutator shadow does not leak',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }; if (ok) { function mutate(url) { return url.href; } const helper = { mutate(url) { return url.href; } }; mutate(new URL(location.href)); helper.mutate(new URL(location.href)); }',
      false
    ],
    [
      'nested shorthand helper mutator shadow does not leak',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } function route() { function mutate(url) { return url.href; } const helper = { mutate }; return helper.mutate(new URL(location.href)); }',
      false
    ],
    [
      'nested member assignment helper mutator shadow does not leak',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } function route() { function mutate(url) { return url.href; } helper.routeMutator = mutate; return helper.routeMutator(new URL(location.href)); }',
      false
    ],
    [
      'destructured member helper mutator shadow does not leak',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate }; function route() { const helper = { mutate: (url) => url.href }; const { mutate: routeMutator } = helper; return routeMutator(new URL(location.href)); }',
      false
    ],
    [
      'simple helper name does not reject safe object method',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { return url.href; } }; return helper.mutate(new URL(location.href));',
      false
    ],
    [
      'spaced helper name does not reject safe object method',
      'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { return url.href; } }; return helper . mutate(new URL(location.href)) || helper ?. mutate(new URL(location.href));',
      false
    ],
    [
      'nested object mutator does not reject safe root method',
      'const helper = { routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }, mutate(url) { return url.href; } }; return helper.mutate(new URL(location.href));',
      false
    ],
    [
      'nested object mutator after regex marker rejects route method',
      'const helper = { marker: /{/, routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } }; return helper.routes.mutate(new URL(location.href));',
      true
    ],
    [
      'wrapped nested object mutator after regex marker rejects route method',
      'export function route() { const helper = { marker: /{/, routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } }; return helper.routes.mutate(new URL(location.href)); }',
      true,
      {
        path: 'modules/interactions.js',
        files: [
          {
            path: 'modules/interactions.js',
            source:
              'export function route() { const helper = { marker: /{/, routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } }; return helper.routes.mutate(new URL(location.href)); }'
          }
        ]
      }
    ],
    [
      'semicolonless expression arrow does not shadow later external route',
      'import { endpoint } from "./config.js"; const helper = endpoint => endpoint\nconst url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file imported external URL relative concat with base context',
      'import { endpoint } from "./config.js"; const url = new URL("?id=" + sku, endpoint); return url.href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'cross-file unrelated import does not allow alias',
      'import { endpoint } from "./internal.js"; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' },
          { path: 'modules/internal.js', source: 'export const endpoint = location.href;' }
        ]
      }
    ],
    [
      'cross-file imported route key alias',
      'import { key } from "./config.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }
    ],
    [
      'cross-file barrel route key alias',
      'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const key = "id";' },
          { path: 'modules/barrel.js', source: 'export { key } from "./config.js";' }
        ]
      }
    ],
    [
      'cross-file local-export barrel route key alias',
      'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const key = "id";' },
          { path: 'modules/barrel.js', source: 'import { key } from "./config.js"; export { key };' }
        ]
      }
    ],
    [
      'cross-file star barrel route key alias',
      'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true,
      {
        path: 'modules/layout.js',
        files: [
          { path: 'modules/config.js', source: 'export const key = "id";' },
          { path: 'modules/barrel.js', source: 'export * from "./config.js";' }
        ]
      }
    ],
    [
      'cross-file imported route key with unrelated shadow',
      'import { key } from "./config.js"; function unrelated(key) { return key; } const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;',
      true,
      { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }
    ],
    [
      'AST URLSearchParams constructor alias route builder',
      'const Params = window.URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'AST URL constructor alias route mutation',
      'const Url = window.URL; const url = new Url(location.href); url.searchParams.set("id", post.location); return url.href;',
      true
    ],
    [
      'AST bound searchParams mutator alias',
      'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); return url.href;',
      true
    ],
    [
      'AST destructured searchParams mutator call alias',
      'const url = new URL(location.href); const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); return url.href;',
      true
    ],
    [
      'AST bound searchParams mutator apply alias',
      'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set.apply(null, ["id", post.location]); return url.href;',
      true
    ],
    [
      'AST generic search sink route params',
      'const params = new URLSearchParams({ id: post.location }); link.search = params;',
      true
    ],
    [
      'AST computed property aliases route mutation',
      'const prop = "searchParams"; const method = "set"; const url = new URL(location.href); url[prop][method]("id", post.location); return url.href;',
      true
    ],
    [
      'AST object member computed property aliases route mutation',
      'const keys = { sp: "searchParams", method: "set" }; const url = new URL(location.href); url[keys.sp][keys.method]("id", post.location); return url.href;',
      true
    ],
    [
      'AST reassigned computed property aliases route mutation',
      'let prop; prop = "searchParams"; let method; method = "set"; const url = new URL(location.href); url[prop][method]("id", post.location); return url.href;',
      true
    ],
    [
      'AST Object.assign computed property aliases route mutation',
      'const keys = {}; Object.assign(keys, { sp: "searchParams", method: "set" }); const url = new URL(location.href); url[keys.sp][keys.method]("id", post.location); return url.href;',
      true
    ],
    [
      'AST Reflect.set computed property alias route mutation',
      'const keys = {}; Reflect.set(keys, "method", "set"); const url = new URL(location.href); url.searchParams[keys.method]("id", post.location); return url.href;',
      true
    ],
    [
      'AST string alias shadowed by parameter stays safe',
      'const method = "set"; export function route(method, post) { const url = new URL(location.href); url.searchParams[method]("id", post.location); return url.href; }',
      false
    ],
    [
      'AST string alias reassignment shadow stays safe',
      'let method = "set"; method = getMethod(); const url = new URL(location.href); url.searchParams[method]("id", post.location); return url.href;',
      false
    ],
    ['AST constructor argument public route literal', 'return new Request("?id=post.md");', true],
    [
      'AST concise arrow public route builder',
      'const href = post => "?id=" + post.location; link.setAttribute("href", href(post));',
      true
    ],
    ['AST template route value public href', 'return `?id=${post.location}`;', true],
    ['AST template tab value public href', 'return `?tab=${slug}&page=2`;', true],
    ['AST template final quasi public href', 'return `${base}?id=post.md`;', true],
    [
      'AST external literal template route query stays allowed',
      'return `https://api.example.test/product?id=${sku}`;',
      false
    ],
    [
      'AST external interpolated host template route query stays allowed',
      'return `https://${host}/products?id=${sku}`;',
      false
    ],
    [
      'AST external interpolated path template route query stays allowed',
      'return `https://example.test/${path}?id=${sku}`;',
      false
    ],
    [
      'AST current-location URL ignores external base',
      'const externalBase = "https://api.example.test/product"; return new URL(location.href + "?id=" + post.location, externalBase).href;',
      true
    ],
    [
      'AST external base relative query stays allowed',
      'const externalBase = "https://api.example.test/product"; return new URL("?id=" + sku, externalBase).href;',
      false
    ],
    [
      'AST aliased URL constructor external search stays allowed',
      'const Url = window.URL; const external = new Url("https://api.example.test/product"); external.search = "?id=" + sku; return external.href;',
      false
    ],
    [
      'AST aliased URL constructor route factory is rejected',
      'const Url = window.URL; function makeUrl() { return new Url(location.href); } makeUrl().searchParams.set("id", post.location);',
      true
    ],
    [
      'AST computed route URL storage alias is rejected',
      'const prop = "url"; state[prop] = new URL(location.href); state.url.searchParams.set("id", post.location);',
      true
    ],
    [
      'AST computed searchParams storage alias is rejected',
      'const prop = "params"; const url = new URL(location.href); state[prop] = url.searchParams; state[prop].set("id", post.location);',
      true
    ],
    [
      'AST computed route query storage alias is rejected',
      'const keys = { p: "params" }; state[keys.p] = new URLSearchParams({ id: post.location }); link.search = state[keys.p];',
      true
    ],
    [
      'AST helper mutates route URL route key',
      'function mutate(url) { url.searchParams.set("id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'AST arrow helper mutates route URL route key',
      'const mutate = (url) => { url.searchParams.set("id", post.location); }; mutate(new URL(location.href));',
      true
    ],
    [
      'AST helper mutates aliased route URL route key',
      'function mutate(url) { url.searchParams.set("id", post.location); } const routeUrl = new URL(location.href); mutate(routeUrl);',
      true
    ],
    [
      'AST helper mutates route URL searchParams alias route key',
      'function mutate(url) { const params = url.searchParams; params.set("id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'AST helper mutates route URL destructured searchParams route key',
      'function mutate(url) { const { searchParams: params } = url; params.set("id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'AST helper mutates route URL destructured mutator route key',
      'function mutate(url) { const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'AST helper mutates route URL bound mutator route key',
      'function mutate(url) { const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); } mutate(new URL(location.href));',
      true
    ],
    [
      'AST bound helper mutates route URL route key',
      'function mutate(url) { url.searchParams.set("id", post.location); } const bound = mutate.bind(null, new URL(location.href)); bound();',
      true
    ],
    [
      'AST Object.assign helper mutates route URL route key',
      'const helpers = {}; Object.assign(helpers, { mutate(url) { url.searchParams.set("id", post.location); } }); helpers.mutate(new URL(location.href));',
      true
    ],
    [
      'AST Reflect.set helper mutates route URL route key',
      'const helpers = {}; Reflect.set(helpers, "mutate", function(url) { url.searchParams.set("id", post.location); }); helpers.mutate(new URL(location.href));',
      true
    ],
    [
      'AST helper mutates external URL route key stays allowed',
      'function mutate(url) { url.searchParams.set("id", sku); } mutate(new URL("https://api.example.test/product"));',
      false
    ],
    [
      'AST bound helper mutates external URL route key stays allowed',
      'function mutate(url) { url.searchParams.set("id", sku); } const bound = mutate.bind(null, new URL("https://api.example.test/product")); bound();',
      false
    ],
    [
      'AST helper non-route key stays allowed',
      'function mutate(url) { url.searchParams.set("slug", post.location); } mutate(new URL(location.href));',
      false
    ],
    [
      'AST external member concat query stays allowed',
      'const endpoints = { product: "https://api.example.test/product" }; return endpoints.product + "?foo=1" + "&id=" + sku;',
      false
    ],
    [
      'AST route query helper public href',
      'function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const href = "?" + query(post);',
      true
    ],
    [
      'AST route query helper alias public href',
      'function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const build = query; const href = "?" + build(post);',
      true
    ],
    [
      'AST route query helper object alias public href',
      'function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const helpers = { query }; const href = "?" + helpers.query(post);',
      true
    ],
    [
      'AST route query helper local route key alias public href',
      'function query(post) { const routeKey = "id"; const params = new URLSearchParams(); params.set(routeKey, post.location); return params.toString(); } const href = "?" + query(post);',
      true
    ],
    [
      'AST route query helper local member route key alias public href',
      'function query(post) { const keys = { post: "id" }; const params = new URLSearchParams(); params.set(keys.post, post.location); return params.toString(); } const href = "?" + query(post);',
      true
    ],
    [
      'AST route query helper local equals alias public href',
      'function query(post) { const eq = "="; return "id" + eq + post.location; } const href = "?" + query(post);',
      true
    ],
    [
      'AST route query helper non-route key stays allowed',
      'function query(post) { const params = new URLSearchParams(); params.set("slug", post.location); return params.toString(); } const href = "?" + query(post);',
      false
    ],
    [
      'AST route query helper nested local route key alias does not leak',
      'function query(post) { function nested() { const routeKey = "id"; return routeKey; } const params = new URLSearchParams(); params.set("slug", post.location); return params.toString(); } const href = "?" + query(post);',
      false
    ],
    [
      'AST imported external base relative query stays allowed',
      'import { endpoint } from "./config.js"; return new URL("?id=" + sku, endpoint).href;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'AST imported external template route query stays allowed',
      'import { endpoint } from "./config.js"; return `${endpoint}?id=${sku}`;',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }]
      }
    ],
    [
      'AST imported aliased URL constructor external query stays allowed',
      'import { endpoint } from "./config.js"; return new URL("?id=" + sku, endpoint).href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/config.js',
            source: 'const Url = window.URL; export const endpoint = new Url("https://api.example.test/product");'
          }
        ]
      }
    ],
    [
      'AST imported aliased URL constructor route factory is rejected',
      'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'const Url = window.URL; export function makeUrl() { return new Url(location.href); }'
          }
        ]
      }
    ],
    [
      'AST imported helper mutates route URL route key',
      'import { mutate } from "./url.js"; mutate(new URL(location.href));',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'export function mutate(url) { url.searchParams.set("id", post.location); }'
          }
        ]
      }
    ],
    [
      'AST imported route query helper public href',
      'import { query } from "./url.js"; const href = "?" + query(post);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source:
              'export function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }'
          }
        ]
      }
    ],
    [
      'AST imported wrapped route query helper public href',
      'import { query } from "./url.js"; const href = "?" + query(post);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/base.js',
            source:
              'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }'
          },
          {
            path: 'modules/url.js',
            source: 'import { makeQuery } from "./base.js"; export function query(post) { return makeQuery(post); }'
          }
        ]
      }
    ],
    [
      'AST imported wrapped route query helper local shadow stays allowed',
      'import { query } from "./url.js"; const href = "?" + query(post);',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/base.js',
            source:
              'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }'
          },
          {
            path: 'modules/url.js',
            source:
              'import { makeQuery } from "./base.js"; export function query(post) { const makeQuery = (post) => "slug=" + post.slug; return makeQuery(post); }'
          }
        ]
      }
    ],
    [
      'AST imported default object route query helper public href',
      'import theme from "./theme.js"; const href = "?" + theme.query(post);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/base.js',
            source:
              'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }'
          },
          {
            path: 'modules/theme.js',
            source: 'import { makeQuery } from "./base.js"; export default { query: makeQuery };'
          }
        ]
      }
    ],
    [
      'AST CommonJS route query helper public href',
      'const { query } = require("./url.js"); const href = "?" + query(post);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source:
              'exports.query = function(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); };'
          }
        ]
      }
    ],
    [
      'AST imported helper mutates external URL route key stays allowed',
      'import { mutate } from "./url.js"; mutate(new URL("https://api.example.test/product"));',
      false,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/url.js', source: 'export function mutate(url) { url.searchParams.set("id", sku); }' }]
      }
    ],
    [
      'AST stale imported helper mutator reassignment stays safe',
      'import { mutate } from "./url.js"; mutate(new URL(location.href));',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source:
              'export let mutate = function(url) { url.searchParams.set("id", post.location); }; mutate = function(url) { return url.href; };'
          }
        ]
      }
    ],
    [
      'AST destructured CommonJS helper mutates route URL route key',
      'const { mutate } = require("./url.js"); mutate(new URL(location.href));',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); };'
          }
        ]
      }
    ],
    [
      'AST stale destructured CommonJS helper reassignment stays safe',
      'const { mutate } = require("./url.js"); mutate(new URL(location.href));',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source:
              'exports.mutate = function(url) { url.searchParams.set("id", post.location); }; exports.mutate = function(url) { return url.href; };'
          }
        ]
      }
    ],
    [
      'AST stale module.exports CommonJS helper reassignment stays safe',
      'const { mutate } = require("./url.js"); mutate(new URL(location.href));',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source:
              'module.exports.mutate = function(url) { url.searchParams.set("id", post.location); }; module.exports.mutate = function(url) { return url.href; };'
          }
        ]
      }
    ],
    [
      'AST stale module.exports require replacement stays safe',
      'const { mutate } = require("./url.js"); mutate(new URL(location.href));',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source:
              'exports.mutate = function(url) { url.searchParams.set("id", post.location); }; module.exports = require("./safe.js");'
          },
          { path: 'modules/safe.js', source: 'exports.mutate = function(url) { return url.href; };' }
        ]
      }
    ],
    [
      'AST imported URL constructor alias route mutation is rejected',
      'import { Url } from "./ctor.js"; const url = new Url(location.href); url.searchParams.set("id", post.location);',
      true,
      { path: 'modules/layout.js', files: [{ path: 'modules/ctor.js', source: 'export const Url = window.URL;' }] }
    ],
    [
      'AST imported URLSearchParams constructor alias route query is rejected',
      'import { Params } from "./ctor.js"; const params = new Params({ id: post.location }); return "?" + params;',
      true,
      {
        path: 'modules/layout.js',
        files: [{ path: 'modules/ctor.js', source: 'export const Params = window.URLSearchParams;' }]
      }
    ],
    [
      'AST assigned URL constructor alias route mutation is rejected',
      'let Url; Url = window.URL; const url = new Url(location.href); url.searchParams.set("id", post.location);',
      true
    ],
    [
      'AST object member URL constructor alias route mutation is rejected',
      'const Ctors = { Url: window.URL }; const url = new Ctors.Url(location.href); url.searchParams.set("id", post.location);',
      true
    ],
    [
      'AST object member URLSearchParams constructor alias route query is rejected',
      'const Ctors = { Params: window.URLSearchParams }; const params = new Ctors.Params({ id: post.location }); return "?" + params;',
      true
    ],
    [
      'AST root shadowed constructor member stays safe',
      'const Ctors = { Url: window.URL }; function route() { const Ctors = { Url: ExternalUrl }; return new Ctors.Url(location.href).href; } route();',
      false
    ],
    [
      'AST stale external member reassignment is rejected',
      'const endpoints = { product: "https://api.example.test/product" }; endpoints.product = getPath(); return endpoints.product + "?id=" + post.location;',
      true
    ],
    [
      'AST route factory constructor parameter shadow stays safe',
      'function setup() { const Url = window.URL; } function makeUrl(Url) { return new Url(location.href); } makeUrl(ExternalUrl).searchParams.set("id", post.location);',
      false
    ],
    [
      'AST sibling constructor alias shadow stays safe',
      'function setup() { const Url = window.URL; void Url; } function makeUrl() { return new Url(location.href); } makeUrl().searchParams.set("id", post.location);',
      false
    ],
    [
      'AST exported destructured URL constructor route factory is rejected',
      'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'const { URL: Url } = window; export function makeUrl() { return new Url(location.href); }'
          }
        ]
      }
    ],
    [
      'AST exported assigned URL constructor route factory is rejected',
      'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);',
      true,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/url.js',
            source: 'let Url; Url = window.URL; export function makeUrl() { return new Url(location.href); }'
          }
        ]
      }
    ],
    [
      'AST exported computed URL constructor external query stays allowed',
      'import { endpoint } from "./config.js"; return new URL("?id=" + sku, endpoint).href;',
      false,
      {
        path: 'modules/layout.js',
        files: [
          {
            path: 'modules/config.js',
            source:
              'const key = "URL"; const { [key]: Url } = window; export const endpoint = new Url("https://api.example.test/product");'
          }
        ]
      }
    ],
    [
      'AST unknown function search assignment stays safe',
      'function route() { function makeUrl() { return new URL(location.href); } function inner() { function makeUrl() { return new URL("https://api.example.test/product"); } makeUrl().search = "id=" + sku; } return inner; }',
      false
    ]
  ].map((testCase) => Object.freeze(testCase))
);

export function themeRouteGuardCorpusDigest(cases = THEME_ROUTE_GUARD_CASES) {
  return createHash('sha256').update(JSON.stringify(cases)).digest('hex');
}

export function assertThemeRouteGuardCorpusIntegrity(cases = THEME_ROUTE_GUARD_CASES) {
  const reject = cases.filter(([, , expected]) => expected === true).length;
  const allow = cases.filter(([, , expected]) => expected === false).length;
  const labels = cases.map(([label]) => label);
  const digest = themeRouteGuardCorpusDigest(cases);
  const failures = [];
  if (cases.length !== THEME_ROUTE_GUARD_CORPUS_LOCK.cases)
    failures.push(`expected ${THEME_ROUTE_GUARD_CORPUS_LOCK.cases} cases, found ${cases.length}`);
  if (reject !== THEME_ROUTE_GUARD_CORPUS_LOCK.reject)
    failures.push(`expected ${THEME_ROUTE_GUARD_CORPUS_LOCK.reject} reject cases, found ${reject}`);
  if (allow !== THEME_ROUTE_GUARD_CORPUS_LOCK.allow)
    failures.push(`expected ${THEME_ROUTE_GUARD_CORPUS_LOCK.allow} allow cases, found ${allow}`);
  if (new Set(labels).size !== labels.length) failures.push('case labels must be unique');
  if (digest !== THEME_ROUTE_GUARD_CORPUS_LOCK.labelContentSha256)
    failures.push(`expected digest ${THEME_ROUTE_GUARD_CORPUS_LOCK.labelContentSha256}, found ${digest}`);
  if (failures.length) throw new Error(`theme route guard corpus integrity failed: ${failures.join('; ')}`);
  return { cases: cases.length, reject, allow, labelContentSha256: digest };
}

export function assertThemeRouteGuardImplementation(label, implementation, cases = THEME_ROUTE_GUARD_CASES) {
  if (typeof implementation !== 'function') throw new TypeError(`${label} must be a function`);
  const failures = [];
  cases.forEach(([caseLabel, source, expected, contextSource]) => {
    const actual = implementation(source, contextSource || source);
    if (actual !== expected) failures.push(`${caseLabel}: expected ${expected}, found ${actual}`);
  });
  if (failures.length)
    throw new Error(`${label} failed ${failures.length}/${cases.length} corpus cases:\n${failures.join('\n')}`);
}

function validatorCaseFiles(source, contextSource) {
  const context = contextSource && typeof contextSource === 'object' ? contextSource : {};
  const inferredPath = /^\s*</u.test(source) ? 'modules/case.html' : 'modules/case.js';
  const mainPath = typeof context.path === 'string' && context.path ? context.path : inferredPath;
  const files = Array.isArray(context.files) ? context.files.filter((file) => file.path !== mainPath) : [];
  return [...files, { path: mainPath, source }];
}

export function assertThemeRouteGuardValidator(label, validator, cases = THEME_ROUTE_GUARD_CASES) {
  if (typeof validator !== 'function') throw new TypeError(`${label} must be a function`);
  const failures = [];
  cases.forEach(([caseLabel, source, expected, contextSource]) => {
    const result = validator(validatorCaseFiles(source, contextSource), {
      contractVersion: 4,
      label: caseLabel
    });
    const actual = Boolean(result && result.ok === false);
    if (actual !== expected) failures.push(`${caseLabel}: expected ${expected}, found ${actual}`);
  });
  if (failures.length)
    throw new Error(`${label} failed ${failures.length}/${cases.length} validator cases:\n${failures.join('\n')}`);
}

export function assertThemeRouteGuardNestedHtmlResolution(label, implementation) {
  if (typeof implementation !== 'function') throw new TypeError(`${label} must be a function`);
  const files = [
    { path: 'views/config.js', source: 'export const key = "id";' },
    { path: 'config.js', source: 'export const key = "safe";' }
  ];
  const rejectSource =
    '<script type="module">import { key } from "./config.js"; const url = new URL(location.href); url.searchParams.set(key, post.location);</script>';
  const allowSource =
    '<script type="module">import { endpoint } from "./endpoint.js"; new URL(endpoint).searchParams.set("id", post.location);</script>';
  const reject = implementation(rejectSource, { path: 'views/card.html', files });
  const allow = implementation(allowSource, {
    path: 'views/card.html',
    files: [...files, { path: 'views/endpoint.js', source: 'export const endpoint = "https://example.test/api";' }]
  });
  const failures = [];
  if (reject !== true) failures.push('nested HTML inline import must resolve relative to the HTML directory');
  if (allow !== false) failures.push('nested HTML inline external endpoint must remain allowed');
  if (failures.length) throw new Error(`${label} failed nested HTML resolution: ${failures.join('; ')}`);
}

export function assertThemeRouteGuardBrowserDifferentials(label, implementation) {
  if (typeof implementation !== 'function') throw new TypeError(`${label} must be a function`);
  const htmlContext = { path: 'views/probe.html', files: [] };
  const executableLegacyTypes = [
    'application/x-ecmascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript'
  ];
  const cases = [
    ['numeric TAB in HTML URL', '<a href="?t&#9;ab=posts">posts</a>', htmlContext],
    ['named TAB in HTML URL', '<a href="?t&Tab;ab=posts">posts</a>', htmlContext],
    ['named newline in HTML URL', '<a href="?t&NewLine;ab=posts">posts</a>', htmlContext],
    ['raw TAB in HTML URL', '<a href="?t\tab=posts">posts</a>', htmlContext],
    ['SVG xlink route URL', '<svg><a xlink:href="?tab=posts">posts</a></svg>', htmlContext],
    ['escaped TAB in JavaScript URL', 'const href = "?t\\tab=posts";', { path: 'modules/probe.js', files: [] }],
    ...executableLegacyTypes.map((type) => [
      `legacy executable script MIME ${type}`,
      `<script type="${type}">location.search = "?tab=posts";</script>`,
      htmlContext
    ])
  ];
  const failures = cases
    .filter(([, source, context]) => implementation(source, context) !== true)
    .map(([caseLabel]) => caseLabel);
  const pathlessCases = [
    ['pathless JavaScript comparison before route literal', 'if (a < b > c) {} const href = "?tab=posts";'],
    [
      'pathless JavaScript comparison before location route',
      'const ok = a < button > c; location.search = "?id=post.md";'
    ],
    ['pathless HTML route link', '<a href="?tab=posts">posts</a>'],
    ['pathless HTML route script', '<script>location.search = "?id=post.md";</script>']
  ];
  failures.push(
    ...pathlessCases.filter(([, source]) => implementation(source) !== true).map(([caseLabel]) => caseLabel)
  );
  if (failures.length) throw new Error(`${label} missed browser-differential cases: ${failures.join('; ')}`);
}

assertThemeRouteGuardCorpusIntegrity();
