// Builds places/world.txt, the offline gazetteer Waymark and Ledger use to
// put a pin where a place really is. Source: GeoNames (https://www.geonames.org/),
// CC BY 4.0. Maintainers only; the apps never run this.
//
//   npm run places                          # download the dumps into .geonames/ (≈650 MB)
//   GEONAMES_DIR=/path/to/dump npm run places   # use files already downloaded
//
// What goes in (see places/README.md for the reasoning):
//   - every populated place of MIN_POPULATION people or more, every capital
//     and every seat of a first- or second-level division;
//   - neighbourhoods and districts with an English Wikipedia article;
//   - every first-level division (state, province, region), named in English;
//   - landmarks, islands, mountains, lakes, parks and stations that have an
//     English Wikipedia article, named in English.
//
// The file format is documented in places/index.js, which parses it.

import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { Unzip, UnzipInflate } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'places', 'world.txt');
const BASE = 'https://download.geonames.org/export/dump/';
const DIR = process.env.GEONAMES_DIR ?? join(root, '.geonames');

/** Populated places at least this large are always in. */
const MIN_POPULATION = 1000;
/** Other names kept per place: its English names, old ones included, and its local one. */
const MAX_ALTERNATES = 6;
/** Two rows of one name and kind closer than this are one place. */
const TWIN_KM = 3;
/** Rank steps per tenfold in size: 8 tells a town of 10,000 from one of 13,000. */
const RANK_STEPS = 8;
/** A landmark within this of a city of CITY_POPULATION is "in" that city. */
const NEAR_KM = 40;
const CITY_POPULATION = 15_000;

/** GeoNames feature codes → the one-letter kind the apps read. */
const KINDS = {
  'A.ADM1': 'r',
  ...codes('T', 'i', ['ISL', 'ISLS', 'ATOL']),
  ...codes('T', 'm', ['MT', 'MTS', 'PK', 'VLC', 'PASS']),
  ...codes('T', 'n', ['CAPE', 'PEN', 'BCH', 'BCHS', 'DSRT', 'CNYN', 'GRGE', 'VAL', 'PLAT', 'CLF', 'CRTR', 'RK']),
  ...codes('H', 'w', ['LK', 'LKS', 'FLLS', 'GLCR', 'BAY', 'LGN', 'FJD', 'GYSR', 'SPNG', 'HBR']),
  ...codes('L', 'p', ['PRK', 'RESN', 'RESF', 'RESW', 'AMUS', 'RGN', 'CST']),
  ...codes('L', 's', ['PRT']),
  ...codes('S', 's', ['RSTN', 'MTRO', 'PIER', 'MAR']),
  ...codes('S', 'l', [
    'MNMT', 'CSTL', 'PAL', 'RUIN', 'MUS', 'CH', 'MSQE', 'TMPL', 'SHRN', 'BDG', 'TOWR', 'STDM', 'ZOO', 'OPRA',
    'THTR', 'UNIV', 'HSTS', 'AMTH', 'PYR', 'PYRS', 'GDN', 'SQR', 'MALL', 'RSRT', 'LTHSE', 'ANS', 'CTHSE', 'MSTY',
    'CVNT', 'PGDA', 'BLDG', 'OBPT', 'CAVE', 'SPA', 'ARCH', 'WALLA', 'FT', 'ATHF', 'RECG', 'MKT', 'OBS', 'CTRS', 'SWT'
  ])
};
function codes(fclass, kind, list) {
  return Object.fromEntries(list.map((c) => [`${fclass}.${c}`, kind]));
}
/** Places that no longer exist, or never were towns. */
const SKIP_POPULATED = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
const SEATS = new Set(['PPLC', 'PPLA', 'PPLA2', 'PPLG']);

// ---------- input ----------

async function file(name) {
  const path = join(DIR, name);
  if (existsSync(path)) return path;
  if (process.env.GEONAMES_DIR) throw new Error(`${path} is missing`);
  await mkdir(DIR, { recursive: true });
  console.log(`downloading ${name}…`);
  const res = await fetch(BASE + name);
  if (!res.ok || !res.body) throw new Error(`${name}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(path));
  return path;
}

/** Calls onLine for every line of one text file inside a zip, without holding it all. */
function zipLines(path, entry, onLine) {
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder();
    let rest = '';
    let found = false;
    const unzip = new Unzip((f) => {
      if (f.name !== entry) return;
      found = true;
      f.ondata = (err, chunk, final) => {
        if (err) return reject(err);
        const lines = (rest + decoder.decode(chunk, { stream: !final })).split('\n');
        rest = final ? '' : lines.pop();
        for (const line of lines) if (line && line[0] !== '#') onLine(line.split('\t'));
        if (final) resolve();
      };
      f.start();
    });
    unzip.register(UnzipInflate);
    createReadStream(path, { highWaterMark: 1 << 20 })
      .on('data', (c) => unzip.push(new Uint8Array(c.buffer, c.byteOffset, c.length)))
      .on('end', () => {
        unzip.push(new Uint8Array(0), true);
        if (!found) reject(new Error(`${entry} not found in ${path}`));
      })
      .on('error', reject);
  });
}

async function textRows(name) {
  return (await readFile(await file(name), 'utf8'))
    .split('\n')
    .filter((l) => l && l[0] !== '#')
    .map((l) => l.split('\t'));
}

// ---------- names ----------

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
/** A copy that does not keep the whole megabyte it was split from alive. */
const own = (s) => Buffer.from(s, 'utf8').toString('utf8');
const clean = (s) => s.replaceAll('|', ' ').replaceAll(';', ' ').replace(/\s+/g, ' ').trim();

// ---------- build ----------

const km = (a, b) => {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};


const countries = (await textRows('countryInfo.txt')).map((c) => ({ iso: c[0], name: c[4], numeric: Number(c[2]) }));
const countryCodes = new Set(countries.map((c) => c.iso));
const admin1Rows = await textRows('admin1CodesASCII.txt');
const admin1Name = new Map(admin1Rows.map((a) => [a[0], a[1]]));
const admin1ById = new Map(admin1Rows.map((a) => [a[3], a[1]]));

console.log('reading alternate names…');
const wiki = new Set();
/** geonameid → { name: the English name to show, score, all: every English name } */
const english = new Map();
await zipLines(await file('alternateNamesV2.zip'), 'alternateNamesV2.txt', (c) => {
  // alternateNameId, geonameid, isolanguage, name, isPreferred, isShort, isColloquial, isHistoric, from, to
  const [, id, lang, name, preferred, short, colloquial, historic] = c;
  if (lang === 'link') {
    if (name.includes('en.wikipedia.org')) wiki.add(own(id));
    return;
  }
  if (lang !== 'en' || colloquial === '1' || name.length > 30) return;
  let entry = english.get(id);
  if (!entry) english.set(own(id), (entry = { name: '', score: -1, all: [] }));
  // Old names ("Bombay", "Peking") still find the place, but are never shown.
  if (entry.all.length < MAX_ALTERNATES) entry.all.push(own(name));
  if (historic === '1') return;
  const score = (preferred === '1' ? 2 : 0) + (short === '1' ? 0 : 1);
  if (score > entry.score) Object.assign(entry, { name: entry.all.at(-1), score });
});
console.log(`${wiki.size} places with an English Wikipedia article, ${english.size} with English names`);

console.log('reading all places…');
const picked = [];
/** The same kind of place under the same name in the same country, by fold. */
const twins = new Map();
const tally = {};
await zipLines(await file('allCountries.zip'), 'allCountries.txt', (c) => {
  const [id, name, , alternates, lat, lon, fclass, fcode, cc, , a1, , , , popText, , , tz] = c;
  if (!tz || !countryCodes.has(cc)) return;
  const population = Number(popText) || 0;
  const notable = wiki.has(id);
  let kind;
  if (fclass === 'P') {
    if (SKIP_POPULATED.has(fcode)) return;
    if (fcode === 'PPLX') {
      if (!notable) return;
      kind = 'd';
    } else if (population >= MIN_POPULATION || SEATS.has(fcode) || (notable && population > 0)) {
      kind = 'c';
    } else return;
  } else {
    kind = KINDS[`${fclass}.${fcode}`];
    if (!kind || (kind !== 'r' && !notable)) return;
  }
  const en = english.get(id);
  // Towns keep the name GeoNames gives them, which is the English one for any
  // city a traveller knows; regions and landmarks take their English name.
  const display = clean(kind === 'r' ? (admin1ById.get(id) ?? en?.name ?? name) : kind === 'c' ? name : en?.name || name);
  if (!display) return;
  const alts = [];
  const seen = new Set([fold(display)]);
  for (const a of [...(en?.all ?? []), name]) {
    const cleaned = clean(a);
    const key = fold(cleaned);
    if (!key || seen.has(key) || alts.length >= MAX_ALTERNATES) continue;
    seen.add(key);
    alts.push(own(cleaned));
  }
  const p = {
    name: own(display),
    lat: Number(lat),
    lon: Number(lon),
    cc: own(cc),
    admin1: kind === 'r' ? '' : (admin1Name.get(`${cc}.${a1}`) ?? ''),
    zone: own(tz),
    kind,
    // Towns and regions rank by population; everything else by how widely it is named.
    weight: kind === 'c' || kind === 'r' ? population : (alternates ? alternates.split(',').length : 0) * 1000 + population,
    population,
    alts
  };
  // GeoNames sometimes has one place twice a few hundred metres apart; keep the better-known.
  const key = `${kind === 'd' ? 'c' : kind}|${p.cc}|${fold(display)}`;
  const same = (twins.get(key) ?? []).find((q) => km(p, q) < TWIN_KM);
  if (same) {
    if (p.weight > same.weight) Object.assign(same, p);
    return;
  }
  if (!twins.has(key)) twins.set(key, []);
  twins.get(key).push(p);
  picked.push(p);
  tally[kind] = (tally[kind] ?? 0) + 1;
});
console.log(tally);

// Grouped by country and region, which compresses a quarter smaller than one
// list by size; each row carries a rank so the reader can still put the
// largest or best-known first, the one most people mean by a shared name.
picked.sort(
  (a, b) =>
    a.cc.localeCompare(b.cc) || a.admin1.localeCompare(b.admin1) || b.weight - a.weight || a.name.localeCompare(b.name)
);
const rank = (p) => Math.round(Math.log10(p.weight + 1) * RANK_STEPS);

// Which city each landmark or neighbourhood belongs to: the nearest sizeable one.
const grid = new Map();
const cell = (lat, lon) => `${Math.floor(lat * 2)},${Math.floor(lon * 2)}`;
picked.forEach((p, i) => {
  if (p.kind !== 'c' || p.population < CITY_POPULATION) return;
  const key = cell(p.lat, p.lon);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(i);
});
function nearestCity(p) {
  // The largest city whose reach covers the place (Paris, not the arrondissement
  // the Eiffel Tower stands in); failing that, the nearest within NEAR_KM.
  let covering = -1;
  let nearest = -1;
  let nearestKm = NEAR_KM;
  const la = Math.floor(p.lat * 2);
  const lo = Math.floor(p.lon * 2);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const i of grid.get(`${la + dy},${lo + dx}`) ?? []) {
        const city = picked[i];
        const d = km(p, city);
        if (d <= reachKm(city) && (covering < 0 || city.population > picked[covering].population)) covering = i;
        if (d < nearestKm) [nearest, nearestKm] = [i, d];
      }
    }
  }
  return covering >= 0 ? covering : nearest;
}
/** Roughly how far a city's built-up area runs: 25 km for Paris, 8 km for a town of 150,000. */
const reachKm = (city) => 2 + Math.sqrt(city.population / 1000) / 2;

// Zones: a country with one zone gets it from its own row, so most places spell none.
const zonesOf = new Map();
for (const p of picked) {
  if (!zonesOf.has(p.cc)) zonesOf.set(p.cc, new Map());
  const z = zonesOf.get(p.cc);
  z.set(p.zone, (z.get(p.zone) ?? 0) + 1);
}
const countryZone = new Map(
  [...zonesOf].map(([cc, z]) => [cc, [...z].sort((a, b) => b[1] - a[1])[0][0]])
);
const zones = [...new Set(picked.map((p) => p.zone))].sort();
const zoneIndex = new Map(zones.map((z, i) => [z, i]));
const admin1 = ['', ...[...new Set(picked.map((p) => p.admin1).filter(Boolean))].sort()];
const admin1Index = new Map(admin1.map((a, i) => [a, i]));
const usedCountries = countries.filter((c) => zonesOf.has(c.iso));

const coord = (n) => String(Number(n.toFixed(3)));
const today = new Date().toISOString().slice(0, 10);
const lines = [
  `dusk-dawn places 1|GeoNames (geonames.org), CC BY 4.0|${today}`,
  ...zones,
  '',
  ...usedCountries.map((c) => [c.iso, clean(c.name), c.numeric, zoneIndex.get(countryZone.get(c.iso))].join('|')),
  '',
  ...admin1.slice(1),
  '',
  ...picked.map((p) => {
    const near = p.kind === 'c' || p.kind === 'r' ? -1 : nearestCity(p);
    return [
      p.name,
      coord(p.lat),
      coord(p.lon),
      rank(p),
      p.cc,
      admin1Index.get(p.admin1) || '',
      p.zone === countryZone.get(p.cc) ? '' : zoneIndex.get(p.zone),
      p.kind === 'c' ? '' : p.kind,
      near < 0 ? '' : near,
      p.alts.join(';')
    ]
      .join('|')
      .replace(/\|+$/, '');
  })
];

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, lines.join('\n') + '\n');
console.log(`${picked.length} places, ${usedCountries.length} countries, ${zones.length} zones → ${OUT}`);
