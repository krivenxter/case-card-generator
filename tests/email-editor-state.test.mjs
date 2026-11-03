import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../email/email-app.js', import.meta.url), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  const body = source.indexOf('{', start);
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}
const writes = [];
const cancelled = [];
const classes = [];
const context = vm.createContext({
  email: { text: 'new' },
  history: { undo: [JSON.stringify({ text: 'old' })], redo: [] },
  historyTimer: 1, saveTimer: 2,
  EMAIL_STORAGE_KEY: 'draft',
  window: { clearTimeout: id => cancelled.push(id) },
  localStorage: { setItem: (...args) => writes.push(args) },
  elements: { saveStatus: {}, previewStage: { classList: { remove: name => classes.push(name) } } },
  canvasState: { panning: true, spacePressed: true },
  syncHistoryButtons() {},
  restoreHistorySnapshot(snapshot) { context.email = JSON.parse(snapshot); },
  console,
});
vm.runInContext(['saveEmail', 'pushHistory', 'undo', 'redo', 'stopCanvasPan', 'releaseCanvasPan'].map(functionSource).join('\n'), context);
vm.runInContext('saveEmail()', context);
assert.equal(writes[0][1], '{"text":"new"}');
assert.ok(cancelled.includes(2));
vm.runInContext('undo()', context);
assert.equal(context.email.text, 'old');
assert.equal(context.history.redo.length, 1);
vm.runInContext('redo()', context);
assert.equal(context.email.text, 'new');
context.email = null;
vm.runInContext('saveEmail()', context);
assert.equal(writes.length, 1, 'Reset state must not overwrite the draft with null');
vm.runInContext('releaseCanvasPan()', context);
assert.equal(context.canvasState.panning, false);
assert.equal(context.canvasState.spacePressed, false);
assert.deepEqual(classes, ['is-pan-ready', 'is-panning']);
console.log('Passed editor save, pending undo/redo, reset save guard and pan release regressions.');
