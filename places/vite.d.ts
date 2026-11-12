import type { PlaceOptions } from './index.js';

export function readWorldPlaces(options?: PlaceOptions): string;

export function worldPlaces(
  options?: PlaceOptions & { fileName?: string }
): {
  name: string;
  configureServer(server: unknown): void;
  generateBundle(): void;
};
