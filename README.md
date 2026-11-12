# dusk-dawn

**Editorial Dusk & Dawn**, Material 3 Expressive edition: the design system shared by Waymark, BookShelf, Ledger, Colophon, Rosetta and Mise, as one package. The full spec is [`style.md`](style.md); §18 covers this package.

## What's in it

- `tokens.json`: every colour, size, shape, weight, spring, duration and font, in both themes, plus the contrast pairs.
- `css/tokens.css`: the theme file generated from `tokens.json`, with the Fraunces `@font-face` rules.
- `css/components.css`: the shared component styles.
- `fonts/`: Fraunces, normal and italic (SIL Open Font License).
- Svelte 5 components: `LoadingIndicator`, `Switch`, `TabRail`, `ThemeToggle`, `Toast` and `WavyProgress`.
- Expressive helpers (style.md §11.3): `celebrate` (confetti in token colours), `play` (one-shot flourishes), `konami`, `secretTaps`, `longPress`, `countUp`, `createEggs` (easter-egg tracking), `shapeClipPath` and `spring`. All of them respect reduced motion.
- `dusk-dawn/places`: the world gazetteer for apps with a map (style.md §18.4). About 320,000 places from GeoNames (CC BY 4.0): every town of 1,000 people or more, every region, and landmarks, islands, mountains, lakes, parks and stations with an English Wikipedia article, each with its time zone and English, old and local names. `dusk-dawn/places/vite` ships the file with an app.
- The `dusk-dawn` command: `check` (contrast in both themes), `colours` (no literal colours in an app's source), `css` and `kotlin` (theme files for other targets).

## Using it in an app

```sh
npm install --save-dev github:not-mehul/dusk-dawn#v2.1.0
```

```css
/* first lines of the app's stylesheet */
@import 'dusk-dawn/tokens.css';
@import 'dusk-dawn/components.css';
```

```ts
// In a plain .ts module (state, platform code), import the helpers without the components:
import { celebrate, createEggs } from 'dusk-dawn/expressive';
// In components:
import { LoadingIndicator, Switch, TabRail, ThemeToggle, Toast, WavyProgress, celebrate, konami } from 'dusk-dawn';
```

```json
"lint": "eslint . && dusk-dawn colours",
"check": "dusk-dawn check && npm run lint && …"
```

```ts
// vite.config.ts: ship the gazetteer beside the page, only the kinds the app needs
import { worldPlaces } from 'dusk-dawn/places/vite';
plugins: [worldPlaces({ fileName: 'catalog/places.txt', kinds: ['city', 'district'] })];

// in the app, the first time a place is needed
import { parsePlaces } from 'dusk-dawn/places';
const world = parsePlaces(await (await fetch('catalog/places.txt')).text());
world.named('Bombay')[0]; // Mumbai, 19.073, 72.883, Asia/Kolkata
world.search('sao pa');   // São Paulo first
```

## Changing the design

```sh
npm ci
# edit tokens.json, css/components.css, svelte/*, or style.md
npm run build   # regenerates css/tokens.css
npm run check   # contrast, generated CSS up to date, no literal colours, svelte-check
```

Then bump `version`, tag the release (`v2.1.0`), and move each app to the new tag in its own pull request. A new token or component is a minor version; a renamed or removed one is a major version.

To refresh the places, run `npm run places` (it downloads about 650 MB from GeoNames into `.geonames/`, or reads `GEONAMES_DIR`) and commit `places/world.txt`.

Never edit `css/tokens.css` by hand, and never patch the package inside an app.
