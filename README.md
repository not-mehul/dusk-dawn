<h1 align="center">dusk-dawn</h1>

<p align="center"><em>Editorial Dusk &amp; Dawn, the design system behind seven apps.</em></p>

<p align="center">
  Svelte 5 package&nbsp;·&nbsp;<a href="https://github.com/not-mehul/dusk-dawn/releases/latest">Latest release</a>&nbsp;·&nbsp;MIT&nbsp;·&nbsp;Created by <strong>Mehul Sen</strong>
</p>

---

**Editorial Dusk & Dawn**, Material 3 Expressive edition: the design system shared by Waymark, BookShelf, Ledger, Colophon, Rosetta, Mise and Nookling, as one package. The full spec is [`style.md`](style.md); §18 covers this package.

## What's in it

- `tokens.json`: every colour, size, shape, weight, spring, duration and font, in both themes, plus the contrast pairs.
- `css/tokens.css`: the theme file generated from `tokens.json`, with the Fraunces `@font-face` rules.
- `css/components.css`: the shared component styles.
- `fonts/`: Fraunces, normal and italic (SIL Open Font License).
- The need meter (`.need-meter`), and the pet tokens and living-subject rule for Nookling (style.md §3.7, §8.22, §11.2).
- Svelte 5 components: `IconTabs`, `LoadingIndicator`, `Select`, `Switch`, `TabRail`, `ThemeToggle`, `TimeField`, `Toast` and `WavyProgress`.
- Themed replacements for the controls that would otherwise open Android's own pickers (style.md §8.6): `Select` (a menu in place of `<select>`), `TimeField` (a clock in place of `<input type="time">`), `.check` for checkboxes and `.range` for sliders, with `dismissOverlay()` for Android back.
- Expressive helpers (style.md §11.3): `celebrate` (confetti in token colours), `play` (one-shot flourishes), `konami`, `secretTaps`, `longPress`, `countUp`, `createEggs` (easter-egg tracking), `shapeClipPath` and `spring`. All of them respect reduced motion.
- `dusk-dawn/places`: the world gazetteer for apps with a map (style.md §18.4). About 320,000 places from GeoNames (CC BY 4.0): every town of 1,000 people or more, every region, and landmarks, islands, mountains, lakes, parks and stations with an English Wikipedia article, each with its time zone and English, old and local names. `dusk-dawn/places/vite` ships the file with an app.
- The `dusk-dawn` command: `check` (contrast in both themes), `colours` (no literal colours in an app's source), `css` and `kotlin` (theme files for other targets).

## Using it in an app

```sh
npm install --save-dev github:not-mehul/dusk-dawn#v2.3.0
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
import { LoadingIndicator, Select, Switch, TabRail, ThemeToggle, TimeField, Toast, WavyProgress, celebrate, dismissOverlay, konami } from 'dusk-dawn';
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
import { parsePlacesInSlices } from 'dusk-dawn/places';
const world = await parsePlacesInSlices(await (await fetch('catalog/places.txt')).text());
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

Then bump `version`, tag the release (`v2.3.0`), and move each app to the new tag in its own pull request. A new token or component is a minor version; a renamed or removed one is a major version.

To refresh the places, run `npm run places` (it downloads about 650 MB from GeoNames into `.geonames/`, or reads `GEONAMES_DIR`) and commit `places/world.txt`.

Never edit `css/tokens.css` by hand, and never patch the package inside an app.

## The Dusk & Dawn apps

Every app below installs this package at a tag and takes its tokens, fonts, components and checks from it. Design changes happen here, never inside an app.

| App | What it is for |
|---|---|
| [Waymark](https://github.com/not-mehul/Waymark) | Your whole trip, offline: flights, stays, plans and costs on one timeline |
| [BookShelf](https://github.com/not-mehul/BookShelf) | Books, films, shows and the lines worth keeping |
| [Ledger](https://github.com/not-mehul/Ledger) | A record of cities, scored on what matters to you |
| [Colophon](https://github.com/not-mehul/Colophon) | Inspect, fix and rebind EPUB editions |
| [Rosetta](https://github.com/not-mehul/Rosetta) | A quiet library and reader for books, papers and notes |
| [Mise](https://github.com/not-mehul/Mise) | Recipes from anywhere, cooked one step at a time |
| [Nookling](https://github.com/not-mehul/Nookling) | A small round friend to feed, play with and put to bed |

## Credits

dusk-dawn and the apps built on it are designed and built by **Mehul Sen** ([@not-mehul](https://github.com/not-mehul)).

- Fraunces: SIL Open Font License, shipped in [`fonts/`](fonts) with its licence.
- Places: [GeoNames](https://www.geonames.org), CC BY 4.0 (see [`places/LICENSE.md`](places/LICENSE.md)).

## Licence

[MIT](LICENSE) © 2026 Mehul Sen. Fraunces and the GeoNames data keep their own terms, listed above.
