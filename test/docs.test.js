import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const docs = Object.fromEntries(
  await Promise.all(
    LANGUAGES.map(async (language) => [
      language,
      await readFile(new URL(`../docs/${language}.md`, import.meta.url), 'utf8'),
    ]),
  ),
);

test('the documentation exists in every language, with the same sections', () => {
  const outline = (text) => text.match(/^#{1,3} /gm).join('');
  for (const language of LANGUAGES) {
    assert.equal(outline(docs[language]), outline(docs.en), `docs/${language}.md outline`);
  }
});

test('every button and form field is named in its own language', () => {
  for (const language of LANGUAGES) {
    for (const entry of [
      ...manifest.actions,
      ...manifest.account_schema,
      ...manifest.config_schema.filter((field) => field.type !== 'section'),
    ]) {
      assert.ok(
        docs[language].includes(entry.label[language]),
        `docs/${language}.md misses "${entry.label[language]}"`,
      );
    }
  }
});
