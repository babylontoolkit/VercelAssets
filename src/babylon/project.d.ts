// Ambient global declarations for the Babylon Toolkit ESM runtime.
// These globals are populated at runtime by dynamic script loads
// (Havok physics, project script bundle). Declaring them here keeps the
// project compilable under `strict: true` without scattered `@ts-ignore`s
// or `(globalThis as any)` casts at every call site.

export {};

declare global {
  // Babylon Toolkit UMD globals
  // const BABYLON: any;
  // const TOOLKIT: any;
  // const PROJECT: any;

  // Havok physics — loaded dynamically via BABYLON.Tools.LoadScriptAsync
  // and exposed as a global factory function on `globalThis`.
  function HavokPhysics(): Promise<any>;

  // Runtime caches stashed on globalThis so async script loads happen once
  // across hot reloads, navigation and React StrictMode double-invokes.
  interface globalThis {
    // BABYLON: any;
    // TOOLKIT: any;
    // PROJECT: any;
    HK: any;
    HKP: any;
    HavokPhysics: () => Promise<any>;
    HAVOKPHYSICS_JS: any;
    SCRIPTBUNDLE_JS: any;
  }
}
