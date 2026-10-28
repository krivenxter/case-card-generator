import assert from 'node:assert/strict';
globalThis.window = globalThis;
await import('../shared/assets.js');
import { BLOCK_DEFINITIONS, createBlock, createDefaultEmail } from '../email/email-model.js';
import { renderEmailDocument } from '../email/email-renderer.js';

function checkTables(html) {
  const stack = [];
  for (const match of html.matchAll(/<(\/)?(table|tr|td)\b[^>]*>/g)) {
    const [, closing, tag] = match;
    if (closing) assert.equal(stack.pop(), tag, `Unexpected closing ${tag}`);
    else {
      if (tag === 'tr') assert.equal(stack.at(-1), 'table');
      if (tag === 'td') assert.equal(stack.at(-1), 'tr');
      stack.push(tag);
    }
  }
  assert.deepEqual(stack, []);
}

let cases = 0;
for (const type of BLOCK_DEFINITIONS.map(({ type }) => type)) {
  for (const preview of [false, true]) {
    for (const theme of ['classic', 'editorial']) {
      const email = createDefaultEmail();
      email.settings.theme = theme;
      email.blocks = [createBlock(type)];
      email.footnotes = [{ id: 'note', text: 'Условия предложения' }];
      const html = renderEmailDocument(email, { preview });
      checkTables(html);
      for (const [, fallback, background] of html.matchAll(/bgcolor="([^"]+)"[^>]*style="[^"]*?background:([^;"]+)/g)) {
        assert.ok(background.includes(fallback), `${type}: ${fallback} differs from ${background}`);
      }
      assert.ok(html.includes('{{link_unsubscribe}}'));
      assert.ok(html.includes('{{link_view_in_browser}}'));
      if (!preview) {
        assert.ok(!/data-dela(?:-|=)/.test(html));
        assert.ok(!html.includes('[data-brand-'));
        assert.ok(!html.includes('h1{'));
      }
      cases++;
    }
  }
}

const email = createDefaultEmail();
email.blocks = [createBlock('title', { content: { heading: '{{pill|{{dela|29 октября}}}}' } })];
for (const assets of [{}, { '{{pill|{{dela|29 октября}}}}': { url: 'https://example.com/title.png', width: 400 } }]) {
  window.CALLTOUCH_DELA_ASSETS = assets;
  const html = renderEmailDocument(email);
  assert.ok(!html.includes('data-dela'));
  assert.ok(!html.includes('{{pill|') && !html.includes('{{dela|'));
  assert.ok(renderEmailDocument(email, { preview: true }).includes('data-dela-text'));
}
assert.ok(!renderEmailDocument(email).includes('.benefits-grid'));
email.blocks.push(createBlock('iconGrid'));
assert.ok(renderEmailDocument(email).includes('.benefits-grid{'));
email.blocks.at(-1).settings.hidden = true;
assert.ok(!renderEmailDocument(email).includes('.benefits-grid'));
email.footnotes = [];
checkTables(renderEmailDocument(email));
console.log(`Passed ${cases} block/theme/preview cases and export regressions.`);
