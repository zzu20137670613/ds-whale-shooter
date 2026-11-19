/**
 * Dump the whole shipped dataset (weapons, characters, monsters, drops,
 * levels, audios) to one JSON file, so the workbook builder — or any other
 * reader — never has to hand-copy a number out of a YAML.
 *
 *   node tools/dump-data.cjs [repoDir] [outJson]
 *
 * Parses with the repo's own `js-yaml`, so the workbook sees what the game
 * loads, not what a partial parser thinks is there.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const OUT = path.resolve(
  process.argv[3] || path.join(__dirname, '..', '..', 'data-dump.json'),
);
const DATA = path.join(REPO, 'public', 'data');

const yaml = require(path.join(REPO, 'node_modules', 'js-yaml'));
const load = (text) => (typeof yaml.load === 'function' ? yaml.load(text) : yaml.safeLoad(text));

const dump = { generatedFrom: REPO, data: {}, indexes: {} };

/** Read one directory of `<id>.yaml` specs (skipping the index). */
function readKind(kind, sub) {
  const dir = path.join(DATA, kind, ...(sub ? [sub] : []));
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.yaml') || file === 'index.yaml') continue;
    const id = file.replace(/\.yaml$/, '');
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const doc = load(text);
    // The leading comment block is where a spec says what it is meant to be.
    const comments = (text.match(/^(#[^\n]*\n)+/) || [''])
      .map((block) => block.split('\n').filter((l) => l.startsWith('#')).map((l) => l.replace(/^#\s?/, '')).join(' ').trim());
    out[id] = { ...doc, _file: `${kind}/${sub ? `${sub}/` : ''}${file}`, _comments: comments[0] || '' };
  }
  return out;
}

for (const kind of ['weapons', 'characters', 'monsters', 'drops', 'levels']) {
  dump.data[kind] = readKind(kind);
}
for (const sub of ['sfx', 'music']) {
  const specs = readKind('audios', sub);
  if (Object.keys(specs).length) dump.data[`audios/${sub}`] = specs;
}

for (const kind of ['weapons', 'characters', 'monsters', 'drops', 'levels', 'audios']) {
  const file = path.join(DATA, kind, 'index.yaml');
  if (fs.existsSync(file)) dump.indexes[kind] = load(fs.readFileSync(file, 'utf8'));
}

fs.writeFileSync(OUT, JSON.stringify(dump, null, 2), 'utf8');
const counts = Object.entries(dump.data)
  .map(([k, v]) => `${k}=${Object.keys(v).length}`)
  .join('  ');
console.log(`wrote ${OUT}`);
console.log(counts);