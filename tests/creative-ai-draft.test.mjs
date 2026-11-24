import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDraft } from '../cloud/creative-ai/generate.mjs';

test('keeps the original numeric headline, subtitle, and terms even if the model swaps roles', () => {
  const title = '10%* кешбэка в октябре\nна таргетированные\nСМС-рассылки:';
  const subtitle = 'контакт с новой аудиторией\nбез сбора номеров';
  const terms = '* Спецпредложение действует при полной открутке бюджета (150 000 ₽).';
  const draft = normalizeDraft({
    title: 'Контакт с новой аудиторией', subtitle: '', labels: ['Октябрь'],
    offer: { value: '10%*', caption: 'кешбэка' }, visualIdea: 'A string of pearls'
  }, 'banner', [title, subtitle, terms].join('\n'));
  assert.equal(draft.title, title);
  assert.equal(draft.subtitle, subtitle);
  assert.equal(draft.additionalText, terms);
  assert.deepEqual(draft.labels, []);
  assert.equal(draft.offer.value, '');
  assert.equal(draft.profile, 'wideCopy');
  assert.match(draft.visualIdea, /targeted SMS messaging.*bullseye/u);
  assert.doesNotMatch(draft.visualIdea, /string of pearls/u);
});

test('preserves labeled supplied copy and CTA, and keeps creative mode for instructions', () => {
  const brief = 'Заголовок: Встречаемся в декабре\nПодзаголовок: Обсудим сквозную аналитику.\nКнопка: Записаться\nУсловия: Вход по регистрации.';
  const draft = normalizeDraft({ title: 'Придуманный заголовок' }, 'banner', brief);
  assert.equal(draft.title, 'Встречаемся в декабре');
  assert.equal(draft.subtitle, 'Обсудим сквозную аналитику.');
  assert.equal(draft.cta, 'Записаться');
  assert.equal(draft.additionalText, 'Вход по регистрации.');
  assert.equal(normalizeDraft({title:'Текст ИИ'}, 'banner', 'Напиши баннер с оффером 10%.').title, 'Текст ИИ');
});
