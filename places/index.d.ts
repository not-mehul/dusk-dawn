export type PlaceKind =
  | 'city'
  | 'district'
  | 'region'
  | 'island'
  | 'mountain'
  | 'nature'
  | 'water'
  | 'park'
  | 'station'
  | 'landmark';

export interface WorldPlace {
  /** Row number in this gazetteer. */
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  kind: PlaceKind;
  /** 8 × log10 of population or renown; higher is the place most people mean. */
  rank: number;
  /** ISO 3166-1 alpha-2. */
  country: string;
  countryName: string;
  /** State, province or region; empty for a region itself. */
  region: string;
  /** IANA time zone. */
  timeZoneId: string;
  /** The city a landmark, station or neighbourhood belongs to; empty for a town or region. */
  city: string;
  /** English names (old ones included) and the local name. */
  alternates: string[];
}

export interface WorldCountry {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** ISO 3166-1 numeric, as world-atlas shapes carry it. */
  numeric: number;
  /** The zone most of its places keep. */
  zone: string;
}

export interface PlaceOptions {
  kinds?: readonly PlaceKind[];
}

export const PLACES_FORMAT: string;
export const KINDS: Readonly<Record<string, PlaceKind>>;

export function foldPlaceName(value: string): string;
export function filterPlaces(text: string, options?: PlaceOptions): string;

export class Gazetteer {
  constructor(text: string, options?: PlaceOptions);
  readonly attribution: string;
  readonly built: string;
  readonly size: number;
  readonly countries: readonly WorldCountry[];
  place(id: number): WorldPlace;
  country(code: string): WorldCountry | undefined;
  named(name: string, options?: PlaceOptions): WorldPlace[];
  search(query: string, options?: PlaceOptions & { limit?: number }): WorldPlace[];
}

export function parsePlaces(text: string, options?: PlaceOptions): Gazetteer;
