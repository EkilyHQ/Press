import { insertImageMarkdownAtSelection } from './editor-markdown-ops.js';
import { resolveLocalMarkdownAssetReference } from './repository-deletions.js';

const noop = () => {};
const fallbackTranslate = (key) => key;

export function createEditorMainImageSession(options = {}) {
  const runtime = options.runtime || {};
  const translateImpl = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const imageButton = options.imageButton || null;
  const imageInput = options.imageInput || null;
  const getCurrentMarkdownPath = typeof options.getCurrentMarkdownPath === 'function' ? options.getCurrentMarkdownPath : () => '';
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : () => 'wwwroot';
  const getEditorTextarea = typeof options.getEditorTextarea === 'function' ? options.getEditorTextarea : () => null;
  const getEditorBody = typeof options.getEditorBody === 'function' ? options.getEditorBody : () => '';
  const buildMarkdown = typeof options.buildMarkdown === 'function' ? options.buildMarkdown : (body) => String(body || '');
  const setValue = typeof options.setValue === 'function' ? options.setValue : noop;
  const getBlocksEditor = typeof options.getBlocksEditor === 'function' ? options.getBlocksEditor : () => null;
  const consoleRef = options.consoleRef || null;
  const emitToastImpl = typeof options.emitToast === 'function'
    ? options.emitToast
    : (kind, message) => {
        if (typeof runtime.emitToast === 'function') runtime.emitToast(kind, message);
      };
  const onWindow = typeof runtime.onWindow === 'function' ? runtime.onWindow.bind(runtime) : () => noop;
  const setTimer = typeof runtime.setTimer === 'function' ? runtime.setTimer.bind(runtime) : (fn, ms) => {
    if (typeof fn === 'function') {
      try { fn(); } catch (_) {}
    }
    return null;
  };
  const FileReaderCtor = options.FileReader
    || (typeof runtime.getFileReader === 'function' ? runtime.getFileReader() : null);
  const createMouseEvent = typeof options.createMouseEvent === 'function'
    ? options.createMouseEvent
    : (type, eventOptions) => (typeof runtime.createMouseEvent === 'function'
        ? runtime.createMouseEvent(type, eventOptions)
        : null);

  let pendingBlocksImageInsert = null;
  let pendingImagePickerToken = 0;
  let bound = false;

  const translate = (key, params) => {
    try {
      return translateImpl(key, params);
    } catch (_) {
      return key;
    }
  };

  const text = (key, fallback, params) => {
    const translated = translate(key, params);
    return translated && translated !== key ? translated : fallback;
  };

  const emitToast = (kind, message) => {
    const value = message == null ? '' : String(message);
    if (!value) return;
    emitToastImpl(kind, value);
  };

  function error(...args) {
    try {
      if (consoleRef && typeof consoleRef.error === 'function') consoleRef.error(...args);
    } catch (_) {}
  }

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided.'));
      return;
    }
    if (!FileReaderCtor) {
      reject(new Error('FileReader is not available.'));
      return;
    }
    const reader = new FileReaderCtor();
    reader.onload = () => {
      try {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unexpected file data.'));
          return;
        }
        const comma = result.indexOf(',');
        const base64 = comma >= 0 ? result.slice(comma + 1) : result;
        if (!base64) {
          reject(new Error('Image data is empty.'));
          return;
        }
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read image.'));
    };
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });

  const slugifyAssetBase = (value) => {
    const input = String(value == null ? '' : value).toLowerCase();
    const cleaned = input.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned ? cleaned.slice(0, 48) : 'image';
  };

  const inferAssetExtension = (file) => {
    if (!file) return '.png';
    const name = typeof file.name === 'string' ? file.name : '';
    const extMatch = name.match(/\.([a-zA-Z0-9]+)$/);
    let ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
    const normalize = (value) => (value && value.startsWith('.') ? value : `.${value || ''}`);
    const type = (file.type || '').toLowerCase();
    const typeMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/avif': '.avif',
      'image/bmp': '.bmp',
      'image/heic': '.heic',
      'image/heif': '.heif'
    };
    if (!ext && typeMap[type]) ext = typeMap[type];
    if (!ext && type.includes('jpeg')) ext = '.jpg';
    if (!ext && type.includes('png')) ext = '.png';
    if (!ext) ext = '.png';
    ext = normalize(ext.toLowerCase());
    return ext.replace(/[^.a-z0-9]/g, '') || '.png';
  };

  const buildAssetFileMeta = (file) => {
    const original = file && typeof file.name === 'string' ? file.name : '';
    const dot = original.lastIndexOf('.');
    const baseRaw = dot > 0 ? original.slice(0, dot) : original;
    const slug = slugifyAssetBase(baseRaw);
    const ext = inferAssetExtension(file);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    const fileName = `${slug}-${timestamp}${random ? `-${random}` : ''}${ext}`;
    const altText = baseRaw && baseRaw.trim() ? baseRaw.trim() : slug.replace(/-/g, ' ').trim();
    return { fileName, altText: altText || slug };
  };

  const computeAssetPaths = (markdownPath, fileName) => {
    const normalized = String(markdownPath || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
    const idx = normalized.lastIndexOf('/');
    const dir = idx >= 0 ? normalized.slice(0, idx) : '';
    const assetDir = dir ? `${dir}/assets` : 'assets';
    const commitPath = `${assetDir}/${fileName}`.replace(/\/+/g, '/');
    const relativePath = `assets/${fileName}`;
    return { commitPath, relativePath };
  };

  const insertImageMarkdown = (relativePath, altText) => {
    const target = getEditorTextarea();
    const content = target ? (target.value || '') : getEditorBody();
    const start = target && Number.isFinite(target.selectionStart) ? target.selectionStart : content.length;
    const end = target && Number.isFinite(target.selectionEnd) ? target.selectionEnd : start;
    const insertion = insertImageMarkdownAtSelection(content, start, end, relativePath, altText);
    const next = buildMarkdown(insertion.value);
    setValue(next, { notify: true });
    return {
      altStart: insertion.altStart,
      altEnd: insertion.altEnd,
      afterIndex: insertion.afterIndex
    };
  };

  const isImageFile = (file) => {
    if (!file) return false;
    if (file.type) return file.type.startsWith('image/');
    const name = typeof file.name === 'string' ? file.name : '';
    return /\.(?:png|jpe?g|gif|bmp|webp|svg|avif|heic|heif)$/i.test(name);
  };

  const containsImageFile = (dataTransfer) => {
    if (!dataTransfer) return false;
    const files = dataTransfer.files;
    if (files && files.length) {
      for (let i = 0; i < files.length; i += 1) {
        if (isImageFile(files[i])) return true;
      }
    }
    if (dataTransfer.items && dataTransfer.items.length) {
      for (let i = 0; i < dataTransfer.items.length; i += 1) {
        const item = dataTransfer.items[i];
        if (item && item.kind === 'file') {
          try {
            const file = item.getAsFile();
            if (isImageFile(file)) return true;
          } catch (_) { /* ignore */ }
        }
      }
    }
    return false;
  };

  const handleImageFiles = async (fileList, opts = {}) => {
    const markdownPath = getCurrentMarkdownPath();
    if (!markdownPath) {
      emitToast('warn', text('editor.toasts.markdownOpenBeforeInsert', 'Open a markdown file before inserting images.'));
      return;
    }
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) {
      if (fileList && fileList.length) emitToast('warn', 'Only image files can be inserted.');
      return;
    }
    if (opts.singleImage && files.length > 1) files.splice(1);

    const textarea = getEditorTextarea();
    const customInsertMarkdown = typeof opts.insertMarkdown === 'function' ? opts.insertMarkdown : null;
    let lastSelection = null;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (lastSelection && textarea) {
        try { textarea.setSelectionRange(lastSelection.afterIndex, lastSelection.afterIndex); }
        catch (_) {}
      }
      let base64;
      try {
        base64 = await readFileAsBase64(file);
      } catch (err) {
        error('Failed to read image for insertion', err);
        emitToast('error', err && err.message ? err.message : 'Failed to read image file.');
        continue;
      }

      const meta = buildAssetFileMeta(file);
      const paths = computeAssetPaths(markdownPath, meta.fileName);
      let selection;
      if (customInsertMarkdown) {
        selection = customInsertMarkdown(paths.relativePath, meta.altText);
        if (selection === false) {
          if (opts.insertAbortToast) emitToast('warn', opts.insertAbortToast);
          continue;
        }
        selection = selection || {};
      } else {
        selection = insertImageMarkdown(paths.relativePath, meta.altText);
      }
      lastSelection = selection;

      if (!customInsertMarkdown && textarea) {
        try {
          textarea.focus();
          textarea.setSelectionRange(selection.altStart, selection.altEnd);
        } catch (_) {}
      }

      try {
        if (typeof runtime.emitAssetAdded === 'function') {
          runtime.emitAssetAdded({
            markdownPath,
            fileName: meta.fileName,
            commitPath: paths.commitPath,
            relativePath: paths.relativePath,
            base64,
            mime: file.type || '',
            size: file.size || 0,
            originalName: file.name || '',
            altText: meta.altText,
            source: opts.source || 'picker',
            silent: true
          });
        }
      } catch (err) {
        error('Failed to dispatch asset-added event', err);
      }

      emitToast('success', translate('editor.toasts.assetAttached', { label: paths.relativePath }));
    }
  };

  const armImagePickerCancelReset = (token) => {
    const clearIfPickerStillPending = () => {
      setTimer(() => {
        if (token !== pendingImagePickerToken) return;
        const hasFiles = imageInput && imageInput.files && imageInput.files.length;
        if (!hasFiles) pendingBlocksImageInsert = null;
      }, 250);
    };
    onWindow('focus', clearIfPickerStillPending, { once: true });
    if (imageInput) {
      imageInput.addEventListener('cancel', clearIfPickerStillPending, { once: true });
      imageInput.addEventListener('blur', clearIfPickerStillPending, { once: true });
    }
  };

  const openImageInputPicker = () => {
    if (!imageInput) {
      pendingBlocksImageInsert = null;
      return;
    }
    pendingImagePickerToken += 1;
    const pickerToken = pendingImagePickerToken;
    try { imageInput.value = ''; } catch (_) {}
    armImagePickerCancelReset(pickerToken);
    try { imageInput.click(); }
    catch (_) {
      const event = createMouseEvent('click', { bubbles: true });
      if (!event) return;
      try { imageInput.dispatchEvent(event); }
      catch (__) {}
    }
  };

  const requestBlocksImageUpload = ({ index, replaceIndex, replaceBlockId } = {}) => {
    pendingBlocksImageInsert = {
      index: Number.isFinite(index) ? index : null,
      replaceIndex: Number.isFinite(replaceIndex) ? replaceIndex : null,
      replaceBlockId: typeof replaceBlockId === 'string' && replaceBlockId ? replaceBlockId : null
    };
    if (!getCurrentMarkdownPath()) {
      emitToast('warn', text('editor.toasts.markdownOpenBeforeInsert', 'Open a markdown file before inserting images.'));
      pendingBlocksImageInsert = null;
      return;
    }
    openImageInputPicker();
  };

  const resolveCurrentImageResource = (src) => {
    const markdownPath = getCurrentMarkdownPath();
    if (!markdownPath) return null;
    return resolveLocalMarkdownAssetReference(markdownPath, src, getContentRoot());
  };

  const canDeleteImageResource = (src) => !!resolveCurrentImageResource(src);

  const requestBlocksImageDelete = ({ index, blockId, src } = {}) => {
    const blocksEditor = getBlocksEditor();
    if (!blocksEditor || typeof blocksEditor.deleteImageBlock !== 'function') return;
    const target = {
      index: Number.isFinite(index) ? index : null,
      blockId: typeof blockId === 'string' && blockId ? blockId : null
    };
    const source = typeof blocksEditor.getImageBlockSource === 'function'
      ? blocksEditor.getImageBlockSource(target)
      : src;
    const markdownPath = getCurrentMarkdownPath();
    if (!markdownPath) {
      emitToast('warn', text('editor.toasts.markdownOpenBeforeInsert', 'Open a markdown file before inserting images.'));
      return;
    }
    const resolved = resolveLocalMarkdownAssetReference(markdownPath, source || src, getContentRoot());
    if (!resolved) {
      emitToast('warn', text('editor.toasts.assetDeleteUnsupported', 'Only local assets next to the current Markdown file can be deleted.'));
      return;
    }
    const detail = {
      markdownPath,
      src: source || src || '',
      assetPath: resolved.contentPath,
      commitPath: resolved.commitPath,
      relativePath: resolved.relativePath
    };
    const accepted = typeof runtime.requestAssetDelete === 'function'
      ? runtime.requestAssetDelete(detail)
      : false;
    if (!accepted || detail.rejected) {
      emitToast('warn', detail.message || text('editor.toasts.assetDeleteRejected', 'This image resource cannot be deleted yet.'));
      return;
    }
    const result = blocksEditor.deleteImageBlock(target);
    if (!result) {
      if (typeof runtime.emitAssetDeleteCanceled === 'function') runtime.emitAssetDeleteCanceled(detail);
      emitToast('warn', text('editor.toasts.imageDeleteTargetMissing', 'The image block no longer exists. Select an image block and try again.'));
    }
  };

  const handleImageInputChange = () => {
    const files = imageInput ? imageInput.files : null;
    const blockInsert = pendingBlocksImageInsert;
    pendingBlocksImageInsert = null;
    pendingImagePickerToken += 1;
    if (files && files.length) {
      const blocksEditor = getBlocksEditor();
      const replaceIndex = blockInsert && Number.isFinite(blockInsert.replaceIndex)
        ? blockInsert.replaceIndex
        : null;
      const replaceBlockId = blockInsert && typeof blockInsert.replaceBlockId === 'string'
        ? blockInsert.replaceBlockId
        : null;
      let insertIndex = blockInsert && Number.isFinite(blockInsert.index)
        ? blockInsert.index
        : null;
      const replaceMarkdown = (replaceIndex != null || replaceBlockId)
        && blocksEditor
        && typeof blocksEditor.replaceImageBlock === 'function'
        ? (relativePath) => {
            const result = blocksEditor.replaceImageBlock(relativePath, { index: replaceIndex, blockId: replaceBlockId });
            if (!result) return false;
            return {};
          }
        : null;
      const insertMarkdown = !replaceMarkdown && blockInsert && blocksEditor && typeof blocksEditor.insertImageBlock === 'function'
        ? (relativePath, altText) => {
            const result = blocksEditor.insertImageBlock(relativePath, altText, insertIndex);
            if (result && Number.isFinite(result.index)) insertIndex = result.index + 1;
            return {};
          }
        : null;
      const markdownHandler = replaceMarkdown || insertMarkdown;
      const imageFileOptions = markdownHandler
        ? { source: 'picker', insertMarkdown: markdownHandler, singleImage: !!replaceMarkdown }
        : { source: 'picker' };
      if (replaceMarkdown) imageFileOptions.insertAbortToast = translate('editor.toasts.imageReplaceTargetMissing');
      handleImageFiles(files, imageFileOptions).catch((err) => {
        error('Image insertion failed', err);
      });
    }
    if (imageInput) imageInput.value = '';
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    if (imageButton) {
      imageButton.addEventListener('click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        pendingBlocksImageInsert = null;
        if (!getCurrentMarkdownPath()) {
          emitToast('warn', text('editor.toasts.markdownOpenBeforeInsert', 'Open a markdown file before inserting images.'));
          return;
        }
        openImageInputPicker();
      });
    }

    if (imageInput) {
      imageInput.addEventListener('change', handleImageInputChange);
    }

    const markdownTextarea = getEditorTextarea();
    if (markdownTextarea) {
      markdownTextarea.addEventListener('dragover', (event) => {
        if (!event || !event.dataTransfer) return;
        if (!containsImageFile(event.dataTransfer)) return;
        event.preventDefault();
        try { event.dataTransfer.dropEffect = 'copy'; }
        catch (_) {}
      });
      markdownTextarea.addEventListener('drop', (event) => {
        if (!event || !event.dataTransfer) return;
        if (!containsImageFile(event.dataTransfer)) return;
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files && files.length) {
          handleImageFiles(files, { source: 'drop' }).catch((err) => {
            error('Image drop failed', err);
          });
        }
      });
    }
  };

  return {
    bind,
    handleImageFiles,
    requestBlocksImageUpload,
    canDeleteImageResource,
    requestBlocksImageDelete,
    openImageInputPicker
  };
}
