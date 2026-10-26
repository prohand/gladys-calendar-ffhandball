// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_ACCOUNT,
  DEFAULT_CONFIG,
  normalizeAccount,
  normalizeConfig,
} from '../src/config.js';
import { ACTIONS } from '../src/capabilities/actions.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const indexSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every list of form fields the manifest declares (same field grammar).
const allFields = [
  ...manifest.config_schema,
  ...manifest.account_schema,
  ...(manifest.actions ?? []).flatMap((item) => item.fields ?? []),
];

test('the integration is a calendar provider, listening to the account changes', () => {
  assert.equal(manifest.type, 'calendar');
  assert.match(indexSource, /onCalendarAccountUpdated\(/);
  // A calendar integration has no devices: no device declaration to carry.
  for (const field of ['transports', 'scene_triggers', 'scene_actions', 'widgets', 'music']) {
    assert.equal(manifest[field], undefined, `manifest.${field}`);
  }
});

test('every manifest action is registered in index.js, and has a handler', () => {
  for (const action of manifest.actions) {
    assert.match(
      indexSource,
      new RegExp(`onAction\\('${action.key}'`),
      `manifest action "${action.key}" is not registered`,
    );
    assert.equal(typeof ACTIONS[action.key], 'function', `action "${action.key}" has no handler`);
  }
  assert.deepEqual(Object.keys(ACTIONS).sort(), keysOf(manifest.actions).sort());
});

test('every field uses a type the store accepts, with a snake_case key', () => {
  const types = ['string', 'number', 'boolean', 'select', 'multi_select', 'secret', 'section'];
  for (const field of allFields) {
    assert.ok(types.includes(field.type), `field "${field.key}": unknown type "${field.type}"`);
    assert.match(field.key, /^[a-z0-9_]+$/, `field key "${field.key}" must be snake_case`);
    if (field.placeholder !== undefined) {
      assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder object`);
      assert.ok(['string', 'number', 'secret'].includes(field.type));
    }
    if (field.min !== undefined || field.max !== undefined) {
      assert.equal(field.type, 'number', `field "${field.key}": min/max are number-only`);
    }
  }
});

test('config_schema and account_schema defaults stay consistent with the code', () => {
  for (const [schema, defaults, normalize] of [
    [manifest.config_schema, DEFAULT_CONFIG, normalizeConfig],
    [manifest.account_schema, DEFAULT_ACCOUNT, normalizeAccount],
  ]) {
    const keys = schema.filter((field) => field.type !== 'section').map((field) => field.key);
    assert.deepEqual(keys.sort(), Object.keys(defaults).sort());
    for (const field of schema) {
      if (field.default !== undefined) {
        assert.equal(defaults[field.key], field.default, `default of ${field.key}`);
      }
      if (field.min !== undefined) {
        // What the form refuses, the code clamps the same way.
        assert.equal(normalize({ [field.key]: field.min - 1 })[field.key], field.min);
        assert.equal(normalize({ [field.key]: field.max + 1 })[field.key], field.max);
      }
    }
  }
});

test('section fields are purely presentational', () => {
  const sections = allFields.filter((f) => f.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.equal(section.required, undefined, `section "${section.key}" must not be required`);
    assert.equal(section.default, undefined, `section "${section.key}" must not have a default`);
    assert.equal(section.placeholder, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  // The Release workflow writes all three: a mismatch means one was edited by
  // hand, and Gladys would offer a version whose image is another one.
  assert.equal(manifest.version, pkg.version);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/prohand/gladys-calendar-ffhandball:${manifest.version}`,
  );
});

test('the categories stay inside the vocabulary the store indexes', () => {
  const vocabulary = [
    'climate',
    'lighting',
    'energy',
    'security',
    'multimedia',
    'appliances',
    'environment',
    'protocols',
    'network',
    'notifications',
    'assistants',
    'services',
    'transport',
    'vehicles',
    'servers',
    'leisure',
  ];
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  assert.equal(new Set(manifest.categories).size, manifest.categories.length);
  for (const category of manifest.categories) {
    assert.ok(vocabulary.includes(category), `unknown category "${category}"`);
  }
  // Following a sports team is a pastime: the shelf the store proposes for it.
  assert.ok(manifest.categories.includes('leisure'));
});

test('the search keywords follow the store rules', () => {
  // 1 to 10 unique terms of 2 to 30 characters, compared trimmed and
  // lowercased. Never displayed: only the catalog search reads them.
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  for (const keyword of keywords) {
    assert.equal(typeof keyword, 'string');
    const { length } = keyword.trim();
    assert.ok(length >= 2 && length <= 30, `keyword "${keyword}": ${length} characters`);
  }
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, 'keywords must be unique');
});

test('the integration is declared for France only', () => {
  // ffhandball.fr covers the French federation's competitions: the catalog of
  // an instance located elsewhere hides it from its shelves (not from search).
  assert.deepEqual(manifest.countries, ['FR']);
});

test('the Gladys floor covers every field the manifest declares', () => {
  // The calendar type and `account_schema` need 5.2; `keywords` and
  // `countries` need 5.3. Compared as numbers.
  const [major, minor] = manifest.gladys_version.replace(/^>=/, '').split('.').map(Number);
  const atLeast = (wantedMajor, wantedMinor) =>
    major > wantedMajor || (major === wantedMajor && minor >= wantedMinor);
  assert.ok(atLeast(5, 2), `the calendar type needs >=5.2.0, got ${manifest.gladys_version}`);
  if (['keywords', 'countries'].some((field) => manifest[field] !== undefined)) {
    assert.ok(atLeast(5, 3), `keywords / countries need >=5.3.0, got ${manifest.gladys_version}`);
  }
});

/** Every multi-language object of the manifest, with where it sits. */
function multiLanguageTexts(node, path = 'manifest') {
  if (Array.isArray(node)) {
    return node.flatMap((child, index) => multiLanguageTexts(child, `${path}[${index}]`));
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const keys = Object.keys(node);
  if (keys.includes('en') && keys.every((key) => /^[a-z]{2}$/.test(key))) {
    return [{ path, text: node }];
  }
  return keys.flatMap((key) => multiLanguageTexts(node[key], `${path}.${key}`));
}

test('every multi-language text of the manifest carries en, fr, de and es', () => {
  // Gladys shows the reader's language and falls back to English: a text
  // missing one of them shows up in English in the middle of a translated
  // screen. The store accepts any two-letter key, so nothing else catches it.
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 15, `only ${texts.length} texts found`);
  for (const { path, text } of texts) {
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const language of LANGUAGES) {
      assert.ok(text[language].trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the per-language length limits of the store hold in every language', () => {
  const within = (text, min, max, where) => {
    for (const language of LANGUAGES) {
      const { length } = text[language];
      assert.ok(length >= min && length <= max, `${where}.${language}: ${length} characters`);
    }
  };
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  within(manifest.description, 10, 100, 'description');
  for (const section of allFields.filter((field) => field.type === 'section')) {
    within(section.description, 1, 1000, `section ${section.key} description`);
  }
});
