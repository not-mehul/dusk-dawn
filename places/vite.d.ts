import type { FilterOptions } from './index.js';

export function readWorldPlaces(options?: FilterOptions): string;

export function worldPlaces(
  options?: FilterOptions & { fileName?: string }
): {
  name: string;
  configureServer(server: unknown): void;
  generateBundle(): void;
};
