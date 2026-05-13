---
title: Press指南
date: 2025-08-23
version: v2.1.0
tags:
  - Press
  - 文件
excerpt: 唔需要建置步驟，就可以直接用 Markdown 檔案建立內容網站；只要將檔案放入 wwwroot/，喺 YAML 入面列出再發布，就可以兼容 GitHub Pages。本指南涵蓋專案結構、設定、內容載入、主題、搜尋、標籤、SEO、媒體同部署。
author: Ekily
ai: true
---

## 檔案概覽
開始使用 Press 前，可以先認識幾個核心檔案同資料夾：

- `site.yaml` — 設定網站標題、副標題、預設語言、社交連結等基本資訊。
- `wwwroot/` — 放置所有內容同資料。
  - `wwwroot/index.yaml` — 文章索引，例如教學、更新記錄或者閱讀筆記。
  - `wwwroot/tabs.yaml` — 靜態頁面索引，例如關於、歷史、法律頁面。

> 你可以由 [v2.1.0/site.yaml](https://github.com/EkilyHQ/Press/blob/v2.1.0/site.yaml) 取得 v2.1.0 嘅預設設定。

## 網站基本設定
喺 `site.yaml` 入面設定網站基本資訊：

```yaml
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
defaultLanguage: en
```

- `siteTitle` / `siteSubtitle` — 網站標題同副標題，可以按語言提供唔同版本。
- `avatar` — 網站頭像或者標誌。
- `defaultLanguage` — 預設 UI/內容語言。本倉庫目前係 `en`。

## 個人資料同社交連結
`profileLinks` 會顯示喺網站卡片上：

```yaml
profileLinks:
  - label: GitHub
    href: https://github.com/EkilyHQ/Press
  - label: Demo
    href: https://ekilyhq.github.io/Press/
```

`label` 只係顯示文字，可以用任何名稱。

## 文章寫作
Press 預設由 `wwwroot/index.yaml` 讀取文章列表。簡化格式如下：

```yaml
githubpages:
  en: post/page/githubpages_en.md
  chs: post/page/githubpages_chs.md
  ja: post/page/githubpages_ja.md
```

每篇 Markdown 可以喺檔案開頭加入 Front Matter：

```yaml
---
title: 為 Press 設定 GitHub Pages
date: 2025-08-21
tags:
  - Press
  - 技術
  - GitHub Pages
image: page.jpeg
excerpt: 你可以將 Press 免費託管喺 GitHub Pages 上。
author: Ekily
ai: true
---
```

常用欄位：

- `title` — 文章標題。
- `date` — 發布日期。
- `tags` — 文章標籤，可以有多個。
- `excerpt` — 摘要，用於文章卡片同 SEO。
- `image` — 封面圖片，路徑相對於目前 Markdown 檔案。
- `author` — 作者名稱。
- `ai` — 是否有生成式 AI 參與撰寫。

### 受保護文章
文章可以喺編輯器入面設定密碼保護。編輯文章時撳「保護」按鈕，為該文章設定獨立密碼，然後照平時咁儲存或發布。

受保護文章會繼續公開 `title`、`date`、`tags`、`image`、`excerpt` 等 Front Matter 元資料，所以文章卡片、搜尋結果同社交分享資訊仍然可以顯示公開摘要。Markdown 正文會被替換成 `press-encrypted-markdown-v1` 密文區塊，並使用 Web Crypto 嘅 `PBKDF2-SHA256` 同 `AES-GCM-256` 加密。

Press 唔會提交密碼，唔會將密碼寫入 JavaScript，亦唔會將密碼保存到瀏覽器儲存空間。正確密碼只會留喺目前頁面記憶體中。重新整理或者重新開啟文章後，需要再次輸入密碼。

請使用 `excerpt` 撰寫受保護文章嘅公開摘要。Press 唔會從加密正文產生預覽或 SEO 描述。

## 頁面寫作
靜態頁面由 `wwwroot/tabs.yaml` 管理：

```yaml
About:
  en:
    title: About
    location: tab/about/en.md
  chs:
    title: 关于Press
    location: tab/about/chs.md
  cht-tw:
    title: 關於Press
    location: tab/about/cht-tw.md
  cht-hk:
    title: 關於Press
    location: tab/about/cht-hk.md
  ja:
    title: 概要
    location: tab/about/ja.md
```

頁面 Markdown 可以省略 Front Matter。

## Press Markdown 語法
Press 使用一套為 Press 站點設計嘅小型、安全嘅類 Markdown 渲染器。佢唔係完整嘅 CommonMark 或 GitHub Flavored Markdown 實作。

支援嘅語法包括標題、段落、粗體、斜體、刪除線、行內程式碼、圍欄程式碼區塊、一般連結、一般圖片、簡單有序/無序列表、引用區塊、簡單管線表格、`- [ ]` / `- [x]` 任務列表、Press 站內連結卡片、Obsidian 風格 callout，以及 `![[...]]` 嵌入。圖片同影片路徑會相對於目前 Markdown 檔案解析。

Press 唔支援 raw HTML。`<div>`、`<script>` 同 HTML 註解等內容會作為文字顯示，而唔會被插入頁面。不支援或者風險較高嘅語法，喺編輯器區塊視圖中亦可能保留為 Markdown 原始碼，而唔係轉換成結構化可編輯區塊。

### 表格
Press 支援簡單嘅管線表格。表格需要包含表頭列、分隔列同資料列，建議每一列都以 `|` 開頭同結尾：

```markdown
| 功能 | 支援情況 | 說明 |
| --- | --- | --- |
| 基礎儲存格 | 支援 | 每一列寫喺單獨一行 |
| 行內 Markdown | 支援 | **粗體**、`程式碼` 同連結可用 |
| 視覺化表格編輯 | 暫不支援 | 區塊編輯器會將表格保留為 Markdown 原始碼 |
```

渲染範例：

| 功能 | 支援情況 | 說明 |
| --- | --- | --- |
| 基礎儲存格 | 支援 | 每一列寫喺單獨一行 |
| 行內 Markdown | 支援 | **粗體**、`程式碼` 同連結可用 |
| 視覺化表格編輯 | 暫不支援 | 區塊編輯器會將表格保留為 Markdown 原始碼 |

`:---`、`:---:`、`---:` 呢類對齊標記可以出現喺分隔列中並被識別為合法表格，但 Press 目前唔會為佢哋額外設定對齊樣式，實際對齊由目前主題決定。表格暫不支援儲存格內換行、儲存格內轉義管線符、`colspan` 或 `rowspan`。

## 圖片同影片
Markdown 入面嘅圖片同影片路徑會相對於目前 Markdown 檔案解析：

```markdown
![page](page.jpeg)
```

如果文章位於 `wwwroot/post/page/githubpages_chs.md`，圖片應該放喺 `wwwroot/post/page/page.jpeg`。影片檔案都使用同一套規則，Press 會自動辨識同渲染。

### 刪除內容同媒體
喺編輯器入面刪除文章、頁面、語言或者版本時，Publish 會由 `index.yaml` 或 `tabs.yaml` 移除引用，並將對應嘅受管理 Markdown 檔案作為 GitHub 檔案刪除提交。刪除後嘅樹狀節點喺發布前仍然可以恢復；Publish 預覽會將刪除檔案標記為 `deleted`。

如果被刪除嘅 Markdown 檔案引用寫作 `assets/...`，而且存放喺該 Markdown 檔案旁邊 `assets/` 子目錄入面嘅本地資源，Press 只會喺目前內容掃描確認冇任何仍存在嘅受管理 Markdown 檔案引用佢時，先一併刪除該資源。`page.jpeg` 呢類同層檔案、站點級資源、絕對 URL、根路徑資源、共享資源同跨文件資源都會保留。

圖片區塊亦提供 **刪除資源** 操作，只用於目前文件下嘅本地 `assets/...` 檔案。此操作會移除圖片區塊並暫存資源刪除；喺原始碼模式中手動刪走 Markdown 圖片語法，唔會自動刪除已提交過嘅資源檔案。

## 站內連結卡片
當一個段落只包含指向文章嘅連結時，Press 會將佢升級成有封面、摘要、日期同閱讀時間嘅卡片：

```markdown
[為 Press 設定 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md)
```

若要喺行內強制使用卡片，可以喺連結 title 入面加入 `card`：

```markdown
呢度係一張 [為 Press 設定 GitHub Pages](?id=post%2Fpage%2Fgithubpages_chs.md "card") 行內卡片。
```

## 路由工作方式
前端路由讀取 URL 查詢參數：

- `?tab=posts` — 全部文章，支援 `&page=N` 分頁。
- `?tab=search&q=關鍵字` — 按標題或者標籤搜尋，亦可以用 `&tag=標籤名` 篩選。
- `?id=path/to/post.md` — 開啟指定文章，該路徑必須存在於 `index.yaml`。
- `?lang=cht-hk` — UI 語言偏好，會儲存在 localStorage；內容會先嘗試匹配該語言，再按回退鏈選擇可用版本。

## 多語言
Press 將網站本體語言同內容語言視為相關但獨立嘅兩層。

- 網站本體支援嘅 UI 語言來自 `assets/i18n/languages.json` 同 `assets/i18n/` 入面對應嘅語言包。文章編輯器可以顯示專案支援嘅全部語言。
- 內容語言由每篇文章或者頁面喺 `wwwroot/index.yaml` 同 `wwwroot/tabs.yaml` 入面分別宣告。作者只需要列出實際撰寫嘅語言版本。
- 當 URL 設定 `?lang=...` 時，網站導覽、按鈕、提示等本體文案會切換到對應 UI 語言，前提係語言包存在。
- 對每篇文章或者頁面，Press 會先嘗試載入同目前 UI 語言相同嘅內容版本。若該版本不存在，就回退到 `site.yaml` 入面嘅 `defaultLanguage`；本倉庫預設係 `en`。
- 如果設定嘅預設語言版本都不存在，Press 會繼續嘗試 `en`、`default`，最後使用該項目下第一個可用版本，避免頁面完全無法渲染。

內容索引支援三種形式：

- 簡化版：按語言直接提供 Markdown 路徑。
- 統一版：每種語言使用 `{title, location}`。
- 舊版：`index.en.yaml`、`index.chs.yaml` 等分語言檔案。

## SEO
Press 會喺執行時按目前頁面更新 meta、Open Graph、Twitter Card 同 JSON-LD。資料來源優先順序：

1. Markdown Front Matter。
2. `index.yaml` 入面嘅 metadata。
3. 自動回退，例如 H1、首段文字或者產生嘅社交圖片。

可喺 `site.yaml` 入面提供多語言 SEO 文字：

```yaml
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

## 常見問題
- Q：網站打開後係空白？
  - A：先檢查 YAML 縮排、冒號同列表/物件結構。
  - A：確認 `index.yaml` / `tabs.yaml` 嘅路徑係相對於 `wwwroot/`。
  - A：請透過本機或者正式伺服器預覽，唔好直接雙擊 `index.html`。
- Q：文章寫好但冇出現喺列表？
  - A：確認文章路徑已加入 `wwwroot/index.yaml`，再強制重新整理瀏覽器快取。
