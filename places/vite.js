// Ships the world gazetteer beside an app's page, from this package, so every
// app carries the same file and no app keeps a copy in its own repository.
//
//   // vite.config.ts
//   import { worldPlaces } from 'dusk-dawn/places/vite';
//   plugins: [worldPlaces({ fileName: 'catalog/places.txt', kinds: ['city'] })]
//
// The page then fetches `<base>catalog/places.txt` and hands the text to
// parsePlaces. In dev the same path is served from memory.

import { readFileSync } from 'node:fs';
import { filterPlaces } from './index.js';

/** The gazetteer's text, narrowed to `kinds` when given. For tests and build scripts. */
export function readWorldPlaces({ kinds } = {}) {
  return filterPlaces(readFileSync(new URL('./world.txt', import.meta.url), 'utf8'), { kinds });
}

/** A Vite plugin that emits the gazetteer as `fileName` (default `places.txt`). */
export function worldPlaces({ fileName = 'places.txt', kinds } = {}) {
  let text;
  const source = () => (text ??= readWorldPlaces({ kinds }));
  return {
    name: 'dusk-dawn-places',
    configureServer(server) {
      const base = server.config.base ?? '/';
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== `${base}${fileName}` && path !== `/${fileName}`) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(source());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source: source() });
    }
  };
}
