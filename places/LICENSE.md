# World places data

`world.txt` is derived from the [GeoNames](https://www.geonames.org/) gazetteer
(`allCountries`, `alternateNamesV2`, `admin1CodesASCII`, `countryInfo`), which
is licensed under the [Creative Commons Attribution 4.0
License](https://creativecommons.org/licenses/by/4.0/). The data is provided
"as is" without warranty of any kind.

Changes made: places were selected (towns of 1,000 people or more, seats of
government, first-level divisions, and landmarks, natural features, parks and
stations with an English Wikipedia article), renamed to their English names
where GeoNames has one, deduplicated, given a rank and a containing city, and
rounded to three decimal places (about 110 m). See `scripts/build-places.mjs`.

An app that ships this file must credit GeoNames where it lists its data
sources, for example: "Places: GeoNames (geonames.org), CC BY 4.0".

The code in this folder (`index.js`, `vite.js`) is MIT, like the rest of the package.
