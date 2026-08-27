/// <reference types="vite/client" />

declare module "*.svg?url" {
  const src: string;
  export default src;
}

/** Present in Node (scripts) and optional in the Vite bundle. */
declare const process: { env?: Record<string, string | undefined> } | undefined;
