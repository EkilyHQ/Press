---
title: Documentation for Press
date: 2025-08-23
version: v2.1.0
tags:
  - Press
  - Documentation
excerpt: Build a content site directly from Markdown with no build steps — drop files into wwwroot/, list them in YAML, and publish (compatible with GitHub Pages). This guide covers project structure, configuration, content loading, themes, search, tags, SEO, media, and deployment.
author: Ekily
ai: true
---

## File Overview
Before using Press, it helps to understand the core files/folders:

- `site.yaml` — Configure basic site info, such as the site title or your profile links.
- `wwwroot/` — Holds all content and data:
  - `wwwroot/index.yaml` — Index of all posts (e.g., “Travel Log — Maldives”, “Reading Notes: The Little Prince”).
  - `wwwroot/tabs.yaml` — Index of static pages (e.g., “About”, “Legal”).

> You can always fetch the v2.1.0 default settings from [v2.1.0/site.yaml](https://github.com/EkilyHQ/Press/blob/v2.1.0/site.yaml).


## Site Basics
Set the following in `site.yaml`:

- `siteTitle` and `siteSubtitle` — Site title and subtitle.
- `avatar` — Site logo.

Example:

```yaml
# Basic site info
siteTitle:
  default: Press
  en: Press
  chs: Press
  cht-tw: Press
  cht-hk: Press
  ja: Press
siteSubtitle:
  default: Where knowledge becomes pages.
  en: Where knowledge becomes pages.
  chs: Where knowledge becomes pages.
  cht-tw: Where knowledge becomes pages.
  cht-hk: Where knowledge becomes pages.
  ja: Where knowledge becomes pages.
avatar: assets/avatar.png
```


## Profile & Social Links
Press can display your contacts or social links on the site card. Add `profileLinks` in `site.yaml`:

```yaml
# Social/profile links
profileLinks:
  - label: GitHub
    href: https://github.com/EkilyHQ/Press
  - label: Demo
    href: https://ekilyhq.github.io/Press/
```

> The `label` is just display text — it can be any string, not a fixed platform name.


## Writing Posts
By default, Press uses the `wwwroot/` folder as its working directory and reads `wwwroot/index.yaml` for the posts list. For example, the article Configure GitHub Pages for Press corresponds to this entry in `wwwroot/index.yaml`:

```yaml
githubpages:
  en: post/page/githubpages_en.md
  chs: post/page/githubpages_chs.md # Chinese version stored at wwwroot/post/page/githubpages_chs.md
  ja: post/page/githubpages_ja.md
```

In addition to listing post paths in `wwwroot/index.yaml`, include front matter at the top of each Markdown file to supply metadata. Here’s an excerpt from `wwwroot/post/page/githubpages_en.md`:

```markdown
---
title: Configure GitHub Pages for Press
date: 2025-08-21
tags:
  - Press
  - Tech
  - GitHub Pages
image: page.jpeg
excerpt: You can host Press on GitHub Pages for free. This article is a self-contained reference, but always consult GitHub’s official docs for the most accurate details.
author: Ekily
ai: true
---

... content omitted
```

Field meanings:

- `title` — Post title.
- `date` — Publish date.
- `tags` — Tags for the post; multiple allowed.
- `excerpt` — Summary for cards and meta.
- `image` — Cover image path (relative to the Markdown file).
- `author` — Author name.
- `ai` — Whether generative AI (specifically LLMs) participated in authoring.

> All front matter fields are optional. Leave any out if you don’t need them.

### Protected Articles
Articles can be password-protected from the editor. Use the Protection button while editing a post, set a per-article password, then save or publish normally.

Protected posts keep public front matter such as `title`, `date`, `tags`, `image`, and `excerpt` visible so cards, search results, and social metadata can still describe the article. The Markdown body is replaced with a `press-encrypted-markdown-v1` ciphertext block using Web Crypto (`PBKDF2-SHA256` and `AES-GCM-256`).

Press does not commit passwords, embed them in JavaScript, or store them in browser storage. The correct password exists only in the current page memory. Refreshing or reopening the article requires entering it again.

Use `excerpt` for the public summary of a protected article. Press never derives protected previews or SEO descriptions from the encrypted body.

## Writing Pages
Similar to Writing Posts, Press reads `wwwroot/tabs.yaml` for static pages. For example, the About page entry in `wwwroot/tabs.yaml` looks like:

```yaml
About:
  en:
    title: About
    location: tab/about/en.md
  chs:
    title: 关于
    location: tab/about/chs.md # Chinese version stored at wwwroot/tab/about/chs.md
  ja:
    title: 概要
    location: tab/about/ja.md
```

Unlike posts, page Markdown files may omit front matter.


## Press Markdown Syntax
Press uses a small, safe Markdown-like renderer built for Press sites. It is not a full CommonMark or GitHub Flavored Markdown implementation.

Supported syntax includes headings, paragraphs, bold, italic, strikethrough, inline code, fenced code blocks, ordinary links, ordinary images, simple ordered and unordered lists, blockquotes, simple pipe tables, `- [ ]` / `- [x]` task lists, Press link cards, Obsidian-style callouts, and `![[...]]` embeds. Images and videos resolve relative to the current Markdown file.

Raw HTML is not supported. Tags such as `<div>`, `<script>`, and HTML comments are displayed as text rather than inserted into the page. Unsupported or risky syntax may also stay as Markdown source in the editor block view instead of becoming a structured editable block.


## Images and Videos
Press supports images and videos in Markdown. Paths resolve relative to the current Markdown file. In Configure GitHub Pages for Press, the content begins with an image:

```markdown
![page](page.jpeg)
```

Because the article lives at `wwwroot/post/page/githubpages_en.md`, the image should be placed at `wwwroot/post/page/page.jpeg`. Videos work the same way; just ensure the path is correct — Press detects video files and renders them accordingly.

### Deleting Content and Media
When you delete a post, page, language, or version in the editor, Publish removes it from `index.yaml` or `tabs.yaml` and stages the managed Markdown file for deletion from GitHub. Deleted tree nodes remain restorable before Publish; the Publish preview labels deleted files as `deleted`.

When a deleted Markdown file referenced local assets written as `assets/...` and stored in an `assets/` subfolder next to that Markdown file, Press deletes those assets only if the current content scan can confirm no remaining managed Markdown file still references them. Sibling files such as `page.jpeg`, site-level assets, absolute URLs, root-relative paths, shared assets, and cross-document assets are kept.

Image blocks also offer **Delete resource** for same-document local `assets/...` files. The action removes the image block and stages the asset deletion; manually removing Markdown image syntax in source mode does not delete an already committed asset.

## Internal Link Cards (Previews)

If a paragraph contains only a link to a post (`?id=...`), the link is upgraded to a card with cover image, excerpt, date, and read time (like the cards on the home page).

```markdown
... content above omitted

[Configure GitHub Pages for Press](?id=post%2Fpage%2Fgithubpages_en.md)

... content below omitted
```

To force a card inline, include `card` in the link title or add `data-card`:

```markdown
... content above omitted

This is an inline card for [Configure GitHub Pages for Press](?id=post%2Fpage%2Fgithubpages_en.md "card").

... content below omitted
```

## FAQ

- Q: The site is blank when opened.
  - A: Validate your YAML (indentation, colons, list/map structure).
  - A: Paths in `index.yaml`/`tabs.yaml` must be relative to `wwwroot/` by default. Double-check paths.
  - A: Preview via a local or real web server (not by double‑clicking `index.html`). Some browsers block local resource loading for security reasons.
- Q: I wrote a post but it doesn’t show up.
  - A: Ensure its `location` is listed in `wwwroot/index.yaml` and the path is correct.
  - A: Hard refresh your browser cache (e.g., Shift + click the reload button).

## Advanced
Advanced options if you want to go further.

### Other Settings
Additional options in `site.yaml`:

#### Theme Override
By default, the site respects user theme choices (stored in the browser). You can force a theme (and its variant):
- `themeMode` — Theme mode (e.g., `user`, `dark`, `light`, `default`).
- `themePack` — Theme pack (e.g., `minimalism`, `github`).
- `themeOverride` — Force a specific theme for all users (default `false`).

Example:
```yaml
themeMode: user
themePack: minimalism
themeOverride: true
```

#### Error Reporting
- `reportIssueURL` — Enable a prefilled issue link (e.g., GitHub New Issue).
- `errorOverlay` — Show an error overlay on the page if something goes wrong (default `false`).
- `assetWarnings` — Asset-related warnings.
  - `largeImage` — Large image warnings.
    - `enabled` — Enable large image warnings (default `false`).
    - `thresholdKB` — Size threshold in KB (default `500KB`).

Example:
```yaml
reportIssueURL: https://github.com/EkilyHQ/Press/issues/new
errorOverlay: true
assetWarnings:
  largeImage:
    enabled: true
    thresholdKB: 500
```

#### Misc
- `contentOutdatedDays` — Days after which content is considered outdated (default 180).
- `cardCoverFallback` — Generate a fallback cover when a post has no image (default `true`).
- `pageSize` — Number of posts per page in index views (default `8`).
- `defaultLanguage` — Default UI/content language (e.g., `en`, `chs`, `cht-tw`, `cht-hk`, `ja`; default `en`).

Example:
```yaml
contentOutdatedDays: 180
cardCoverFallback: false
pageSize: 8
defaultLanguage: en
```

### How Routing Works

The client router reads URL query parameters:

- `?tab=posts` — All posts (default). Supports `&page=N` pagination.
- `?tab=search&q=term` — Search by title or tag. You can also filter by `&tag=TagName`.
- `?id=path/to/post.md` — Open a specific post (the path must exist in `index.yaml`).
- `?lang=chs` — UI language preference. Stored in localStorage; content tries the matching variant and then uses the configured fallback chain.

Markdown examples: `[See this](?id=post/frogy/main.md)` and `[About](?tab=about)`.

### SEO (Built‑in)

At runtime, Press updates meta tags per page (title, description, Open Graph, Twitter Card) and injects structured data (JSON‑LD). Source order:

1) Markdown front matter (`title`, `excerpt`, `tags`, `date`, `image`)
2) `index.yaml` metadata
3) Auto‑fallbacks (H1/first paragraph) and a generated fallback social image

Example `index.yaml` SEO fields:
```yaml
resourceURL: https://ekilyhq.github.io/Press/wwwroot/
siteDescription:
  default: Press - Where knowledge becomes pages.
  en: Press - Where knowledge becomes pages.
  chs: Press - Where knowledge becomes pages.
  cht-tw: Press - Where knowledge becomes pages.
  cht-hk: Press - Where knowledge becomes pages.
  ja: Press - Where knowledge becomes pages.
siteKeywords:
  default: static blog, markdown, github pages, blog
  en: static blog, markdown, github pages, blog
  chs: 静态博客, Markdown, GitHub Pages, 博客
  cht-tw: 靜態部落格, Markdown, GitHub Pages, 部落格
  cht-hk: 靜態網誌, Markdown, GitHub Pages, 網誌
  ja: 静的サイト, Markdown, GitHub Pages, ブログ
```

Where:
- `resourceURL` — Base URL for assets to ensure images/videos resolve correctly. Point it to your site’s actual `wwwroot/`.
- `siteDescription` — Site description for SEO and social sharing.
- `siteKeywords` — Keywords for SEO.

You should also open `index_seo.html` to generate `sitemap.xml` and `robots.txt` into the site root (same level as `index.html`), and to generate starter `<head>` tags for `index.html` based on `site.yaml`.

### Multi‑language

Press treats the site UI language and the content language as related but separate concerns.

- Supported UI languages come from `assets/i18n/languages.json` and the matching files in `assets/i18n/`. The editor may expose every language supported by the project.
- Content languages are declared per post or page in `wwwroot/index.yaml` and `wwwroot/tabs.yaml`. A post only needs to list the language variants that the author actually wrote.
- When `?lang=...` is set, the site chrome switches to that UI language if a bundle exists.
- For each post or page, Press first tries to load the content variant matching the current UI language. If that variant is missing, it falls back to `defaultLanguage` from `site.yaml`; in this repository that default is `en`.
- If the configured default variant is also missing, Press tries `en`, then `default`, then the first available variant so the page can still render.

Content index formats:

- Simplified (as in this repo): provide Markdown paths per language.
- Unified: `{title, location}` per language.
- Legacy: `index.en.yaml`/`index.en.json`, `index.chs.yaml`/`index.chs.json`... (fallback).

When switching languages, the router keeps you on the same article if a matching variant exists; otherwise the content falls back as described above.
