// node --test places/places.test.mjs   (part of `npm run check`)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterPlaces, foldPlaceName, parsePlaces } from './index.js';
import { readWorldPlaces } from './vite.js';

const world = parsePlaces(readWorldPlaces());
const first = (name) => world.named(name)[0];

test('the file covers the world', () => {
  assert.ok(world.size > 300_000, `only ${world.size} places`);
  assert.ok(world.countries.length > 240);
  assert.match(world.attribution, /GeoNames.*CC BY 4\.0/);
  const kinds = new Set(Array.from({ length: world.size }, (_, i) => world.place(i).kind));
  assert.deepEqual([...kinds].sort(), ['city', 'district', 'island', 'landmark', 'mountain', 'nature', 'park', 'region', 'station', 'water']);
});

test('every place has a sound position and a real zone', () => {
  for (let i = 0; i < world.size; i += 97) {
    const p = world.place(i);
    assert.ok(p.latitude >= -90 && p.latitude <= 90 && p.longitude >= -180 && p.longitude <= 180, p.name);
    assert.ok(p.timeZoneId === 'UTC' || p.timeZoneId.includes('/'), `${p.name}: ${p.timeZoneId}`);
    assert.ok(p.name.trim() !== '');
  }
});

test('a shared name means the place most people mean', () => {
  assert.equal(first('Paris').country, 'FR');
  assert.equal(first('London').country, 'GB');
  assert.equal(first('Kyoto').kind, 'city');
  assert.equal(first('New York').name, 'New York City');
  assert.equal(first('Bruges').country, 'BE');
  assert.equal(first('Manhattan').timeZoneId, 'America/New_York');
});

test('places are where they are, to within a few hundred metres', () => {
  const near = (p, lat, lon) => Math.abs(p.latitude - lat) < 0.01 && Math.abs(p.longitude - lon) < 0.01;
  assert.ok(near(first('Paris'), 48.853, 2.349));
  assert.ok(near(first('Eiffel Tower'), 48.858, 2.294));
  assert.ok(near(first('Sydney'), -33.868, 151.207));
});

test('landmarks, districts and islands are found, in English, with their city', () => {
  const eiffel = first('Eiffel Tower');
  assert.equal(eiffel.kind, 'landmark');
  assert.equal(eiffel.city, 'Paris');
  assert.equal(first('Bloomsbury').city, 'London');
  assert.equal(first('Tuscany').kind, 'region');
  assert.equal(first('Santorini').kind, 'island');
  assert.equal(first('Mount Fuji').timeZoneId, 'Asia/Tokyo');
});

test('old and local names find the place', () => {
  assert.equal(first('Bombay').name, 'Mumbai');
  assert.equal(first('Toscana').name, 'Tuscany');
  assert.equal(first('st. petersburg').country, 'RU');
  assert.equal(first('ZURICH').timeZoneId, 'Europe/Zurich');
});

test('search: whole-name prefixes, then later words, best first', () => {
  assert.equal(world.search('par')[0].name, 'Paris');
  assert.equal(world.search('york city')[0].name, 'New York City');
  assert.equal(world.search('sao pa')[0].name, 'São Paulo');
  assert.deepEqual(world.search('p'), []);
  assert.ok(world.search('lond', { kinds: ['city'] }).every((p) => p.kind === 'city'));
});

test('folding ignores case, accents, punctuation and abbreviations', () => {
  assert.equal(foldPlaceName('Saint-Pétersbourg'), foldPlaceName('st. petersbourg'));
  assert.equal(foldPlaceName('The Hague'), 'hague');
  assert.equal(foldPlaceName('東京'), '東京');
});

test('a filtered file keeps only those kinds, and its links still point right', () => {
  const cities = parsePlaces(filterPlaces(readWorldPlaces(), { kinds: ['city', 'district'] }));
  assert.ok(cities.size > 200_000 && cities.size < world.size);
  const bloomsbury = cities.named('Bloomsbury')[0];
  assert.equal(bloomsbury.city, 'London');
  assert.equal(cities.named('Eiffel Tower').length, 0);
  assert.throws(() => parsePlaces(readWorldPlaces(), { kinds: ['castle'] }));
});
