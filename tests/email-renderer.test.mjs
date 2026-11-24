import assert from 'node:assert/strict';
globalThis.window = globalThis;
await import('../shared/assets.js');
import { BLOCK_DEFINITIONS, createBlock, createDefaultEmail } from '../email/email-model.js';
import { renderEmailDocument } from '../email/email-renderer.js';
import { buildAiEmailVariants } from '../email/email-ai.js';
import { normalizeDraft } from '../cloud/creative-ai/generate.mjs';

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
    for (const theme of ['classic', 'editorial', 'mist', 'lavender', 'white']) {
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
const resourceUrl = 'https://example.com/video?utm_source=mail&campaign=1';
const draft = normalizeDraft({
  subject: 'Материалы вебинара',
  cover: 'banner',
  coverBanner: { title: 'Вебинар', theme: 'dark', backdrop: 'violet' },
  blocks: [
    { type: 'feature', heading: 'Итоги', items: [{ heading: 'Самостоятельная практика', body: 'Повторите шаги' }] },
    { type: 'resources', heading: 'Запись', items: [{ heading: 'Вебинар', cta: 'Смотреть', url: resourceUrl }] }
  ]
}, 'email', resourceUrl);
const [primary, alternative] = buildAiEmailVariants(draft, 'data:image/png;base64,illustration', 'data:image/jpeg;base64,cover');
assert.equal(primary.blocks[0].content.image.previewSource, 'data:image/jpeg;base64,cover');
assert.ok(primary.blocks[1].content.body.includes('Самостоятельная практика'));
assert.equal(primary.blocks[2].content.items[0].ctaUrl, resourceUrl);
assert.ok(alternative.blocks.some((block) => block.content.image?.previewSource === 'data:image/png;base64,illustration'));
assert.equal(primary.settings.theme, 'mist');
assert.equal(alternative.settings.theme, 'classic');
const enrichedDraft = normalizeDraft({
  subject: 'Цифры и ответы',
  cover: 'inline',
  theme: 'lavender',
  blocks: [
    { type: 'metrics', heading: 'Показатели', items: [{ eyebrow: '15 минут', heading: 'Демо' }] },
    { type: 'faq', heading: 'Вопросы', items: [{ heading: 'Что понадобится?', body: 'Доступ к кабинету' }] }
  ]
}, 'email', 'Демо длится 15 минут. Понадобится доступ к кабинету.');
const libraryAsset = { id: 'call-tracking', label: 'Коллтрекинг', previewSource: 'visuals/Коллтрекинг.png', exportUrl: 'https://example.com/visual.png' };
const [enriched] = buildAiEmailVariants(enrichedDraft, libraryAsset.previewSource, '', libraryAsset);
const richHtml = renderEmailDocument(enriched);
assert.match(richHtml, /bgcolor="#F7F3FC"/);
assert.match(richHtml, /15 минут/);
assert.match(richHtml, /Что понадобится/);
assert.ok(richHtml.includes(libraryAsset.exportUrl));
checkTables(richHtml);
const collectionHtml = renderEmailDocument(primary, { preview: true, mobile: true });
assert.ok(collectionHtml.includes('utm_source=mail&amp;campaign=1'));
checkTables(collectionHtml);
console.log(`Passed ${cases} block/theme/preview cases and export regressions.`);
