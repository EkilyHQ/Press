import assert from 'node:assert/strict';

import { createEditorMainShellService } from '../assets/js/editor-main-shell-service.js';

{
  const calls = [];
  const service = createEditorMainShellService({
    editor: {
      refreshLayout() {
        calls.push('editor.refreshLayout');
      }
    },
    textarea: {
      style: {},
      offsetHeight: 12,
      scrollHeight: 64
    }
  });
  assert.equal(service.requestLayout(), true);
  assert.deepEqual(calls, ['editor.refreshLayout']);
}

{
  const textarea = {
    style: {},
    offsetHeight: 12,
    scrollHeight: 72
  };
  const service = createEditorMainShellService({ textarea });
  assert.equal(service.requestLayout(), true);
  assert.equal(textarea.style.height, '72px');
}

{
  const service = createEditorMainShellService();
  assert.equal(service.requestLayout(), false);
}

{
  const calls = [];
  const service = createEditorMainShellService({
    runtime: {
      emitToast(kind, message) {
        calls.push([kind, message]);
      }
    }
  });
  assert.equal(service.emitToast('warn', 'Open a file first'), true);
  assert.equal(service.emitToast('warn', ''), false);
  assert.equal(service.emitToast('warn', null), false);
  assert.deepEqual(calls, [['warn', 'Open a file first']]);
}

{
  const service = createEditorMainShellService({
    runtime: {
      emitToast() {
        throw new Error('toast failed');
      }
    }
  });
  assert.equal(service.emitToast('error', 'Failed'), false);
}
