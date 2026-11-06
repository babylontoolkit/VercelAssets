import type { IContentInstallerHostOptions } from "../chrome/content-installer";

/** The folder of the playground scene Home's demo loads (samplescene.gz.gltf). */
const PLAYGROUND_SCENE_BASE_URL: string = "https://repo.babylontoolkit.com/playground/";

/**
 * The app's content installer settings (offline install and fast loads of the hosted game content).
 * Off by default: the one change to turn it on is `NEXT_PUBLIC_CONTENT_INSTALLER=on` in `.env`. The scene host is
 * `NEXT_PUBLIC_SCENE_BASE_URL` (default: the playground folder), and it must serve `content-manifest.json` with CORS
 * (see README › Hosting game content for the content installer). On localhost and private network hosts the installer
 * stays off unless `NEXT_PUBLIC_CONTENT_INSTALLER_LOCALHOST=on`, so dev sessions behave exactly as before. The app shell
 * root (`bt-shell-manifest.json`, written by `npm run build`) is used in production builds only; `next dev` has none.
 * Next.js inlines `NEXT_PUBLIC_*` values when it compiles, so a change needs a restart of `next dev` or a new build.
 */
export const CONTENT_INSTALLER_OPTIONS: IContentInstallerHostOptions = {
  enabled: process.env.NEXT_PUBLIC_CONTENT_INSTALLER === "on",
  sceneBaseUrl: process.env.NEXT_PUBLIC_SCENE_BASE_URL ?? PLAYGROUND_SCENE_BASE_URL,
  enableOnLocalHost: process.env.NEXT_PUBLIC_CONTENT_INSTALLER_LOCALHOST === "on",
  includeAppShell: process.env.NODE_ENV === "production",
};
