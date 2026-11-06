/**
 * The one Vite-style build flag the copied content installer layer names: `contentInstallerConfig.ts` defaults
 * `includeAppShell` to `import.meta.env.PROD`. Next.js has no `import.meta.env`, so this app always passes
 * `includeAppShell` itself (src/config/contentInstaller.ts) and the default is never read at run time; this declaration
 * only lets the layer, kept byte-identical to the ReactFramework copy, type-check here.
 */
interface ImportMetaEnv {
  /** True in a production build (Vite). */
  readonly PROD: boolean;
}

interface ImportMeta {
  /** Vite's build-time environment (never present at run time in Next.js). */
  readonly env: ImportMetaEnv;
}
