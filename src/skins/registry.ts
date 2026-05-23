import type { RemoteSkinEntry } from "./types";

/** Future online skin registry — not used in v1. */
export interface SkinRegistrySource {
  id: string;
  fetchCatalog(): Promise<RemoteSkinEntry[]>;
}

export class StubSkinRegistry implements SkinRegistrySource {
  constructor(public id: string) {}

  async fetchCatalog(): Promise<RemoteSkinEntry[]> {
    return [];
  }
}

export function createRegistrySources(_urls: string[]): SkinRegistrySource[] {
  return [];
}
