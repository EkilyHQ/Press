#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEditorAppKernel,
  runEditorFeatureLifecycle
} from '../assets/js/editor-app-kernel.js';
import { createEditorMainFeatures } from '../assets/js/editor-main.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

{
  const calls = [];
  const kernel = createEditorAppKernel({
    name: 'test-editor',
    provides: ['runtime'],
    context: { calls }
  });
  kernel.registerFeature({
    name: 'feature.a',
    requires: ['runtime'],
    provides: ['aService'],
    init: context => context.calls.push('a:init'),
    bind: context => context.calls.push('a:bind'),
    start: context => context.calls.push('a:start')
  });
  kernel.registerFeature({
    name: 'feature.b',
    requires: ['aService'],
    provides: ['bService'],
    init: context => context.calls.push('b:init'),
    bind: context => context.calls.push('b:bind'),
    start: context => context.calls.push('b:start')
  });

  const result = await kernel.run();
  assert.deepEqual(calls, [
    'a:init',
    'b:init',
    'a:bind',
    'b:bind',
    'a:start',
    'b:start'
  ]);
  assert.deepEqual(result.context.lifecycle.features.map(feature => feature.name), ['feature.a', 'feature.b']);
}

{
  const calls = [];
  const kernel = createEditorAppKernel({
    name: 'dispose-test',
    provides: ['runtime'],
    context: { calls }
  });
  kernel.registerFeature({
    name: 'feature.a',
    requires: ['runtime'],
    provides: ['aService'],
    init(context) {
      context.lifecycle.registerDisposer(() => context.calls.push('a:registered-dispose'));
    },
    dispose(context) {
      context.calls.push('a:dispose');
    }
  });
  kernel.registerFeature({
    name: 'feature.b',
    requires: ['aService'],
    provides: ['bService'],
    dispose(context) {
      context.calls.push('b:dispose');
    }
  });
  const result = await kernel.run();
  assert.equal(await result.dispose(), true);
  assert.equal(await result.dispose(), false);
  assert.deepEqual(
    calls,
    ['b:dispose', 'a:dispose', 'a:registered-dispose'],
    'app kernel dispose should run feature and registered disposers in reverse lifecycle order'
  );
}

await assert.rejects(
  runEditorFeatureLifecycle([
    { name: 'feature.a', requires: ['missingService'] }
  ], { name: 'missing-dependency' }),
  /missing-dependency: feature "feature\.a" requires missing token "missingService"/
);

await assert.rejects(
  runEditorFeatureLifecycle([
    { name: 'feature.a', provides: ['shared'] },
    { name: 'feature.b', provides: ['shared'] }
  ], { name: 'duplicate-provider' }),
  /duplicate-provider: token "shared" is provided by both "feature\.a" and "feature\.b"/
);

await assert.rejects(
  runEditorFeatureLifecycle([
    { name: 'feature.a', requires: ['bService'], provides: ['aService'] },
    { name: 'feature.b', requires: ['aService'], provides: ['bService'] }
  ], { name: 'cycle-test' }),
  /cycle-test: feature dependency cycle:/
);

await assert.rejects(
  runEditorFeatureLifecycle([
    { name: 'feature.a', requires: ['aService'], provides: ['aService'] }
  ], { name: 'self-dependency-test' }),
  /self-dependency-test: feature "feature\.a" requires token "aService" that it provides itself/
);

const composerBootstrap = read('assets/js/composer-bootstrap.js');
assert.match(composerBootstrap, /from '\.\/editor-app-kernel\.js'/, 'composer bootstrap should use the shared app kernel');
assert.match(composerBootstrap, /export function createComposerBootstrapFeatures/, 'composer bootstrap should expose feature declarations for tests');
assert.match(composerBootstrap, /name: 'composer\.markdownToolbar'[\s\S]*provides: \['markdownToolbar'\]/, 'composer toolbar binding should be a lifecycle feature');
assert.match(composerBootstrap, /name: 'composer\.initialState'[\s\S]*requires: \['markdownToolbar'\][\s\S]*provides: \['initialComposerState'\]/, 'composer initial state should depend on toolbar setup');
assert.match(composerBootstrap, /name: 'composer\.workspace'[\s\S]*requires: \['initialComposerState'\]/, 'composer workspace assembly should depend on loaded state');

const editorMain = read('assets/js/editor-main.js');
assert.match(editorMain, /from '\.\/editor-app-kernel\.js'/, 'editor-main should use the shared app kernel');
assert.match(editorMain, /export function createEditorMainFeatures/, 'editor-main should expose lifecycle feature declarations');
assert.match(editorMain, /name: 'editorMain\.metadataPanel'[\s\S]*provides: \['metadataPanel'\]/, 'editor metadata panel should be a feature');
assert.match(editorMain, /name: 'editorMain\.previewSession'[\s\S]*requires: \[[^\]]*'linkCardContext'[\s\S]*provides: \['previewSession'\]/, 'editor preview should declare feature dependencies');
assert.match(editorMain, /name: 'editorMain\.documentInputBinding'[\s\S]*requires: \[[^\]]*'currentFileRender'[\s\S]*context\.documentSession\.bindInput\(\)/, 'editor input binding should declare its current-file render dependency');
assert.match(editorMain, /name: 'editorMain\.initialDocumentState'[\s\S]*requires: \[[^\]]*'documentInputBinding'[\s\S]*context\.documentSession\.renderInitial\(context\.seed\)/, 'editor initial render should start after input wiring is explicit');
assert.match(editorMain, /name: 'editorMain\.sidebarStartup'[\s\S]*requires: \[[^\]]*'scrollBinding'[\s\S]*start\(context\) \{[\s\S]*context\.sidebarSession\.initialize\(\)/, 'editor sidebar should start after initial document and scroll startup');
assert.match(editorMain, /createEditorMainFeatures\(\)\.forEach\(feature => kernel\.registerFeature\(feature\)\)/, 'editor-main root should register declared features through the kernel');

{
  const kernel = createEditorAppKernel({
    name: 'editor-main-plan',
    provides: ['runtime', 'documentRef', 'dom', 'appServices', 'getContentRoot', 'resolveEditorImageSrc', 'seed']
  });
  createEditorMainFeatures().forEach(feature => kernel.registerFeature(feature));
  const plan = kernel.getLifecyclePlan();
  const order = plan.map(feature => feature.name);
  const byName = new Map(plan.map(feature => [feature.name, feature]));
  const assertBefore = (first, second) => {
    assert.ok(
      order.indexOf(first) >= 0 && order.indexOf(first) < order.indexOf(second),
      `${first} should run before ${second}`
    );
  };

  assert.equal(byName.get('editorMain.metadataPanel').requires.includes('getContentRoot'), true);
  assert.equal(byName.get('editorMain.linkCardContext').requires.includes('getContentRoot'), true);
  assert.equal(byName.get('editorMain.blocksSession').requires.includes('resolveEditorImageSrc'), true);
  assert.equal(byName.get('editorMain.initialDocumentState').requires.includes('seed'), true);
  assert.equal(plan.some(feature => feature.requires.includes('document')), false);

  [
    ['editorMain.workspaceBinding', 'editorMain.previewBinding'],
    ['editorMain.previewBinding', 'editorMain.contentBinding'],
    ['editorMain.contentBinding', 'editorMain.blocksBinding'],
    ['editorMain.blocksBinding', 'editorMain.toolbarBinding'],
    ['editorMain.toolbarBinding', 'editorMain.languageBinding'],
    ['editorMain.languageBinding', 'editorMain.linkCardToolbarSync'],
    ['editorMain.linkCardToolbarSync', 'editorMain.currentFileRender'],
    ['editorMain.currentFileRender', 'editorMain.documentInputBinding'],
    ['editorMain.documentInputBinding', 'editorMain.initialDocumentState'],
    ['editorMain.initialDocumentState', 'editorMain.imageBinding'],
    ['editorMain.imageBinding', 'editorMain.primaryEditorApi'],
    ['editorMain.primaryEditorApi', 'editorMain.defaultWorkspaceView'],
    ['editorMain.defaultWorkspaceView', 'editorMain.scrollBinding'],
    ['editorMain.scrollBinding', 'editorMain.sidebarStartup']
  ].forEach(([first, second]) => assertBefore(first, second));
}

console.log('ok - editor app kernel');
