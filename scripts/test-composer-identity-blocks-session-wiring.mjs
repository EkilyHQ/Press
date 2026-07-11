import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSystemThemeBridgeSource = readIdentitySource('../assets/js/composer-system-theme-bridge.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksControlFactorySource = readIdentitySource('../assets/js/editor-blocks-control-factory.js');

const editorBlocksLayoutSessionSource = readIdentitySource('../assets/js/editor-blocks-layout-session.js');

const editorBlocksBodySessionSource = readIdentitySource('../assets/js/editor-blocks-body-session.js');

const editorBlocksMenuSessionSource = readIdentitySource('../assets/js/editor-blocks-menu-session.js');

const editorBlocksHeadSessionSource = readIdentitySource('../assets/js/editor-blocks-head-session.js');

const editorBlocksCommandSessionSource = readIdentitySource('../assets/js/editor-blocks-command-session.js');

const editorBlocksRichTextSessionSource = readIdentitySource('../assets/js/editor-blocks-rich-text-session.js');

const editorBlocksSelectionSessionSource = readIdentitySource('../assets/js/editor-blocks-selection-session.js');

const editorBlocksInlineDomSessionSource = readIdentitySource('../assets/js/editor-blocks-inline-dom-session.js');

const editorBlocksInlineEditingBridgeSource = readIdentitySource('../assets/js/editor-blocks-inline-editing-bridge.js');

const editorBlocksBlockTypeSessionsSource = readIdentitySource('../assets/js/editor-blocks-block-type-sessions.js');

const editorBlocksInlineToolbarSessionSource = readIdentitySource(
  '../assets/js/editor-blocks-inline-toolbar-session.js'
);

const editorBlocksLinkSessionSource = readIdentitySource('../assets/js/editor-blocks-link-session.js');

const editorBlocksMathSessionSource = readIdentitySource('../assets/js/editor-blocks-math-session.js');

const editorBlocksTableSessionSource = readIdentitySource('../assets/js/editor-blocks-table-session.js');

const editorBlocksCardPickerSessionSource = readIdentitySource('../assets/js/editor-blocks-card-picker-session.js');

const editorBlocksImageSessionSource = readIdentitySource('../assets/js/editor-blocks-image-session.js');

const editorBlocksCodeSessionSource = readIdentitySource('../assets/js/editor-blocks-code-session.js');

const editorBlocksSourceSessionSource = readIdentitySource('../assets/js/editor-blocks-source-session.js');

const editorBlocksListSessionSource = readIdentitySource('../assets/js/editor-blocks-list-session.js');

// composer-identity-body:start

assert.doesNotMatch(
  [
    editorBlocksSource,
    editorBlocksLayoutSessionSource,
    editorBlocksBodySessionSource,
    editorBlocksControlFactorySource,
    editorBlocksMenuSessionSource,
    editorBlocksHeadSessionSource,
    editorBlocksCommandSessionSource,
    editorBlocksRichTextSessionSource,
    editorBlocksSelectionSessionSource,
    editorBlocksInlineDomSessionSource,
    editorBlocksInlineEditingBridgeSource,
    editorBlocksInlineToolbarSessionSource,
    editorBlocksLinkSessionSource,
    editorBlocksMathSessionSource,
    editorBlocksBlockTypeSessionsSource,
    editorBlocksTableSessionSource,
    editorBlocksCardPickerSessionSource,
    editorBlocksImageSessionSource,
    editorBlocksCodeSessionSource,
    editorBlocksSourceSessionSource,
    editorBlocksListSessionSource
  ].join('\n'),
  /documentRef\s*=\s*typeof document|windowRef\s*=\s*typeof window|return document\.createElement|safeCall\(\(\) => (?:document|window|requestAnimationFrame|setTimeout|clearTimeout|getComputedStyle)/,
  'blocks editor sessions should receive document/window/runtime adapters explicitly instead of falling back to browser globals'
);

assert.match(
  editorMainSource,
  /from '\.\/safe-html\.js'/,
  'editor preview should import the cache-busted safe HTML helper directly'
);

assert.match(
  editorBlocksSource,
  /from '\.\/math-render\.js'/,
  'editor blocks should cache-bust the math renderer when KaTeX support changes'
);

assert.match(
  editorBlocksSource,
  /\bcreatePressMathRenderer\b[\s\S]*const renderMathWithRuntime = createPressMathRenderer\(\{[\s\S]*documentRef: blocksDocument,[\s\S]*windowRef: blocksWindow[\s\S]*\}\);/,
  'editor blocks should bind math rendering to explicit runtime document/window refs'
);

assert.doesNotMatch(
  editorBlocksSource,
  /\brenderPressMath\b/,
  'editor blocks should not import or call the implicit math renderer'
);

assert.doesNotMatch(
  editorBlocksSource,
  /renderMath:\s*renderPressMath/,
  'editor blocks should not pass the implicit math renderer into runtime-owned sessions'
);

assert.match(
  composerSystemThemeBridgeSource,
  /from '\.\/system-updates\.js'/,
  'system/theme bridge should cache-bust system updates when version compatibility changes'
);

assert.doesNotMatch(
  source,
  /from '\.\/encrypted-content\.js'/,
  'composer root should not import encrypted article helpers directly after the Markdown feature extraction'
);

// composer-identity-body:end
