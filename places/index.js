// The shared world gazetteer: one file of about 320,000 places (GeoNames,
// CC BY 4.0) that Waymark and Ledger read to put a pin where a place really
// is. No DOM, no dependencies; works in the browser, a WebView and Node.
//
// File format (places/world.txt, written by scripts/build-places.mjs):
//
//   dusk-dawn places 1|<attribution>|<built yyyy-mm-dd>
//   <IANA zone>                       one per line, then a blank line
//   <iso2>|<name>|<iso numeric>|<zone index>   one per country, then a blank line
//   <region name>                     first-level divisions, then a blank line
//   <name>|<lat>|<lon>|<rank>|<iso2>|<region>|<zone>|<kind>|<in>|<other names>
//
// Rows are grouped by country and region. <rank> is 8 × log10 of population
// (towns, regions) or of how widely the place is named (everything else), so a
// higher rank is the place most people mean. <region> is a 1-based line in the
// region table, blank for none. <zone> is blank when the place keeps its
// country's zone. <kind> is blank for a town or city, otherwise one of
// d r i m n w p s l (see KINDS). <in> is the row of the city a landmark or
// neighbourhood belongs to. <other names> are ;-separated. Trailing empty
// fields are left off.

export const PLACES_FORMAT = 'dusk-dawn places 1';

/** File letter → kind. A town or city has no letter. */
export const KINDS = Object.freeze({
  '': 'city',
  d: 'district',
  r: 'region',
  i: 'island',
  m: 'mountain',
  n: 'nature',
  w: 'water',
  p: 'park',
  s: 'station',
  l: 'landmark'
});
const LETTERS = Object.keys(KINDS);
/**
 * Added to a place's rank when ordering matches. A town is what most people
 * mean by a name it shares with its region (Kyoto) or a landmark (Grand
 * Canyon, unless the landmark is much the better known).
 */
const KIND_BONUS = { '': 8, d: 2 };
/** Added when the name is the place's own rather than one it is also known by. */
const OWN_NAME_BONUS = 4;
const KIND_NAMES = Object.values(KINDS);

/**
 * Case, accents, punctuation, a leading "the" and the usual abbreviations do
 * not decide a match: "st. petersburg", "Saint-Pétersbourg" and "SAINT
 * PETERSBURG" fold alike. Letters of every script survive.
 */
export function foldPlaceName(value) {
  const text = String(value);
  // Most names are plain ASCII, which needs no Unicode work: a phone folds a
  // third of a million of them on the first lookup.
  let folded = ASCII.test(text)
    ? text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : text
        .normalize('NFD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
  if (folded.charCodeAt(0) === 116 && folded.startsWith('the ')) folded = folded.slice(4);
  const c = folded.charCodeAt(0);
  if (c === 115) return folded.replace(/^st /, 'saint ').replace(/^ste /, 'sainte ');
  if (c === 109) return folded.replace(/^mt /, 'mount ');
  return folded;
}
const ASCII = /^[\x00-\x7f]*$/;

/** Splits the file into its header, its tables and its rows. */
function sections(text) {
  const lines = text.split(/\r?\n/);
  const [format = '', attribution = '', built = ''] = (lines[0] ?? '').split('|');
  if (format !== PLACES_FORMAT) throw new Error(`Not a ${PLACES_FORMAT} file`);
  const tables = [[], [], []];
  let t = 0;
  let i = 1;
  for (; i < lines.length && t < 3; i++) {
    if (lines[i] === '') t++;
    else tables[t].push(lines[i]);
  }
  return { attribution, built, zones: tables[0], countries: tables[1], regions: tables[2], rows: lines.slice(i) };
}

function kindFilter(kinds) {
  if (!kinds) return null;
  for (const k of kinds) if (!KIND_NAMES.includes(k)) throw new Error(`Unknown place kind: ${k}`);
  return new Set(LETTERS.filter((l) => kinds.includes(KINDS[l])));
}

/**
 * The same file with only some kinds of place in it, for an app that needs
 * fewer (Ledger keeps cities). Run at build time, so the phone never carries
 * the rest.
 */
export function filterPlaces(text, { kinds } = {}) {
  const keep = kindFilter(kinds);
  if (!keep) return text;
  const { rows } = sections(text);
  const head = text.slice(0, text.length - rows.join('\n').length);
  const kept = [];
  const moved = new Map();
  rows.forEach((row, i) => {
    if (row === '') return;
    if (!keep.has(row.split('|', 8)[7] ?? '')) return;
    moved.set(i, kept.length);
    kept.push(row);
  });
  const out = kept.map((row) => {
    const f = row.split('|');
    if (f[8]) f[8] = moved.has(Number(f[8])) ? String(moved.get(Number(f[8]))) : '';
    return f.join('|').replace(/\|+$/, '');
  });
  return head + out.join('\n') + '\n';
}

/**
 * The parsed gazetteer, held in columns (a few megabytes for every place on
 * Earth, not a third of a million objects). Everything it hands out is a
 * plain Place made on demand.
 */
export class Gazetteer {
  constructor(text, options = {}) {
    drain(this._build(text, options));
  }

  /** Parses the file, pausing every SLICE rows when driven by parsePlacesInSlices. */
  *_build(text, { kinds } = {}) {
    const keep = kindFilter(kinds);
    const s = sections(text);
    this.attribution = s.attribution;
    this.built = s.built;
    const zones = s.zones;
    this.countries = s.countries.map((line) => {
      const [code, name, numeric, zone] = line.split('|');
      return { code, name, numeric: Number(numeric), zone: zones[Number(zone)] ?? 'UTC' };
    });
    this._countryIndex = new Map(this.countries.map((c, i) => [c.code, i]));
    this._zones = zones;
    this._regions = ['', ...s.regions];
    yield;

    const n = s.rows.length;
    const names = [];
    const others = [];
    const lat = new Float64Array(n);
    const lon = new Float64Array(n);
    const rank = new Uint8Array(n);
    const country = new Uint16Array(n);
    const region = new Uint16Array(n);
    const zone = new Int16Array(n);
    const kind = new Uint8Array(n);
    const near = new Int32Array(n);
    const moved = new Int32Array(n).fill(-1);
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (i % SLICE === SLICE - 1) yield;
      const row = s.rows[i];
      if (row === '') continue;
      const f = row.split('|');
      const letter = f[7] ?? '';
      if (keep && !keep.has(letter)) continue;
      moved[i] = count;
      names.push(f[0]);
      others.push(f[9] ?? '');
      lat[count] = Number(f[1]);
      lon[count] = Number(f[2]);
      rank[count] = Number(f[3]) || 0;
      country[count] = this._countryIndex.get(f[4]) ?? 0;
      region[count] = Number(f[5]) || 0;
      zone[count] = f[6] ? Number(f[6]) : -1;
      kind[count] = LETTERS.indexOf(letter);
      near[count] = f[8] ? Number(f[8]) : -1;
      count++;
    }
    for (let i = 0; i < count; i++) near[i] = near[i] < 0 ? -1 : moved[near[i]];
    yield;

    this.size = count;
    this._names = names;
    this._others = others;
    this._lat = lat.subarray(0, count);
    this._lon = lon.subarray(0, count);
    this._rank = rank.subarray(0, count);
    this._country = country.subarray(0, count);
    this._region = region.subarray(0, count);
    this._zone = zone.subarray(0, count);
    this._kind = kind.subarray(0, count);
    this._near = near.subarray(0, count);

    // Best first: highest score, then file order. A counting sort, since scores are small.
    const score = new Uint16Array(count);
    for (let i = 0; i < count; i++) score[i] = this._rank[i] + (KIND_BONUS[LETTERS[this._kind[i]]] ?? 0);
    this._score = score;
    const buckets = new Uint32Array(512);
    for (let i = 0; i < count; i++) buckets[511 - score[i]]++;
    for (let b = 0, at = 0; b < 512; b++) [buckets[b], at] = [at, at + buckets[b]];
    this._order = new Int32Array(count);
    for (let i = 0; i < count; i++) this._order[buckets[511 - score[i]]++] = i;
  }

  /**
   * Folds every name for lookups: the folded names in best-first order, and
   * folded name → places for own and other names. The slow part of the first
   * lookup, so parsePlacesInSlices does it ahead of time.
   */
  *_buildIndex() {
    const keys = new Array(this.size);
    const byName = new Map();
    const byOther = new Map();
    const add = (map, key, i) => {
      const list = map.get(key);
      if (list) list.push(i);
      else map.set(key, [i]);
    };
    for (let at = 0; at < this.size; at++) {
      if (at % SLICE === SLICE - 1) yield;
      const i = this._order[at];
      keys[at] = foldPlaceName(this._names[i]);
      add(byName, keys[at], i);
      if (this._others[i]) for (const o of this._others[i].split(';')) add(byOther, foldPlaceName(o), i);
    }
    this._folded = keys;
    this._byName = byName;
    this._byOther = byOther;
  }

  _index() {
    if (!this._byName) drain(this._buildIndex());
  }

  /** Place number i (0 ≤ i < size). */
  place(i) {
    const c = this.countries[this._country[i]];
    const z = this._zone[i];
    const near = this._near[i];
    return {
      id: i,
      name: this._names[i],
      latitude: this._lat[i],
      longitude: this._lon[i],
      kind: KIND_NAMES[this._kind[i]],
      rank: this._rank[i],
      country: c.code,
      countryName: c.name,
      region: this._regions[this._region[i]] ?? '',
      timeZoneId: z < 0 ? c.zone : (this._zones[z] ?? c.zone),
      city: near >= 0 ? this._names[near] : '',
      alternates: this._others[i] ? this._others[i].split(';') : []
    };
  }

  /** The country with this ISO 3166-1 alpha-2 code. */
  country(code) {
    const i = this._countryIndex.get(String(code).toUpperCase());
    return i === undefined ? undefined : this.countries[i];
  }

  /**
   * Every place called exactly `name`, or also known by it ("Bombay"), best
   * first: a town before a region or landmark of the same size, a place's own
   * name before a name it is also known by, unless the other place is much the
   * larger ("Bruges" is the Belgian city, not the French town). `kinds`
   * narrows the result.
   */
  named(name, { kinds } = {}) {
    const key = foldPlaceName(name);
    if (key === '') return [];
    this._index();
    const own = new Set(this._byName.get(key) ?? []);
    const ids = [...own, ...(this._byOther.get(key) ?? []).filter((i) => !own.has(i))];
    const score = (i) => this._score[i] + (own.has(i) ? OWN_NAME_BONUS : 0);
    // Stable, so equal scores keep best-first order.
    ids.sort((a, b) => score(b) - score(a));
    return this._take(ids, kinds, Infinity);
  }

  /**
   * Places whose name begins with `query`, best first (towns ahead of regions
   * and landmarks of the same size); then places with a
   * later word that does ("york" finds New York); then places also known by a
   * name that does.
   */
  search(query, { limit = 6, kinds } = {}) {
    const q = foldPlaceName(query);
    if (q.length < 2) return [];
    const keep = kindFilter(kinds);
    const ok = (i) => !keep || keep.has(LETTERS[this._kind[i]]);
    this._index();
    const keys = this._folded;
    const starts = [];
    const words = [];
    const inner = ` ${q}`;
    for (let at = 0; at < keys.length && starts.length < limit; at++) {
      const key = keys[at];
      const i = this._order[at];
      if (key.startsWith(q)) {
        if (ok(i)) starts.push(i);
      } else if (words.length < limit && key.includes(inner) && ok(i)) words.push(i);
    }
    let found = [...starts, ...words];
    if (found.length < limit) {
      const others = [];
      for (const [key, list] of this._byOther) {
        if (key.startsWith(q)) for (const i of list) if (ok(i) && !found.includes(i)) others.push(i);
      }
      others.sort((a, b) => this._score[b] - this._score[a]);
      found = [...found, ...new Set(others)];
    }
    return found.slice(0, limit).map((i) => this.place(i));
  }

  _take(ids, kinds, limit) {
    const keep = kindFilter(kinds);
    const out = [];
    for (const i of ids) {
      if (keep && !keep.has(LETTERS[this._kind[i]])) continue;
      out.push(this.place(i));
      if (out.length >= limit) break;
    }
    return out;
  }
}

/** Rows handled between pauses: a few milliseconds' work on a phone. */
const SLICE = 8192;

function drain(steps) {
  while (!steps.next().done);
}

async function inSlices(steps) {
  while (!steps.next().done) await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Parses the gazetteer's text in one go. `kinds` keeps only those kinds of
 * place. The first lookup then folds every name, which takes a moment.
 */
export function parsePlaces(text, options) {
  return new Gazetteer(text, options);
}

/**
 * Parses the text and prepares every lookup a slice at a time, handing the
 * main thread back between slices, so a phone keeps scrolling while it works.
 * What an app should use at start.
 */
export async function parsePlacesInSlices(text, options) {
  const world = Object.create(Gazetteer.prototype);
  await inSlices(world._build(text, options));
  await inSlices(world._buildIndex());
  return world;
}
