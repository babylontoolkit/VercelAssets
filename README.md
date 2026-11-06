This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Content installer (game data download, offline play and fast loads)

The app can download its hosted game data to the player's device: the toolkit's `ContentInstaller` and its service
worker (`bt-content-worker.js`) store every file listed in the export's `content-manifest.json` in browser storage,
so later loads read it from the device (no network), the game runs offline, and an update downloads only the files
whose bytes changed. Downloading is optional and never a gate: without support, CORS or a manifest the game loads from
the network exactly as before.

* **The one switch.** Off by default. Add `NEXT_PUBLIC_CONTENT_INSTALLER=on` to `.env`. The content host is
  `NEXT_PUBLIC_SCENE_BASE_URL` (default `https://repo.babylontoolkit.com/playground/`); its `content-manifest.json` must
  be served next to the scenes (see the next section). The settings live in `src/config/contentInstaller.ts`. Next.js
  inlines `NEXT_PUBLIC_*` values when it compiles: restart `next dev` or rebuild after changing one.
* **What you get.** `ContentInstallerHost` (`src/app/installer.tsx`, mounted by the root layout) wraps every route in
  `ContentInstallerProvider`, which loads the installer once Home is idle — Home never loads Babylon code first (the
  installer and Babylon's `Observable` get their own small `content-installer` chunk in `next.config.ts`). Home shows
  one **Download** button (it reads **Downloaded ✓** once every file of the game data is on the device). It opens the
  modal "Download Game Data" dialog (`ContentInstallPanel`; Escape closes it): *Not downloaded* — the game data size,
  what is already on this device and the free space, with Download and Cancel; *Downloading* — progress with percent,
  size and speed (no time-left estimate), with Pause (Resume while paused) and Close (the download keeps going in the background);
  *Downloaded* — "All game data is on this device", with Close and Remove (Remove deletes it and closes the dialog). No text the player sees says "install":
  adding the app to the desktop or home screen is the browser's own option. `ContentUpdateToast` announces new content
  ("New game content — 34 MB": Update, then Apply at the next scene load) and a new app version (Reload). An installed
  app (standalone launch) is offered the download once (`ContentInstallOffer`: "Download the game data to this device —
  559 MB", Download / Maybe Later). Before every scene load `babylon.tsx` calls
  `prepareContentSceneLoad`; when the scene is on the device the splash reads "Loading from this device". The components
  are unstyled: skin their class hooks (`.content-install-panel__*`, `.content-toast*`, `.content-install-offer__*`).
* **Local hosts.** On `localhost`, `127.0.0.1`, `*.local` and private network addresses the installer stays off (and
  removes its worker) unless `NEXT_PUBLIC_CONTENT_INSTALLER_LOCALHOST=on`, so a dev session behaves exactly as before.
* **The worker and the app shell.** `npm run dev` and `npm run build` first copy `bt-content-worker.js` from
  `@babylonjs-toolkit/next` into `public/` (`scripts/content-installer-build.mjs worker`, the `predev` / `prebuild`
  steps); after a build, `postbuild` writes `public/bt-shell-manifest.json` (every file of `.next/static/` under
  `/_next/static/`, every public file and the prerendered Home page as `index.html`, each with its SHA-256), so an
  installed app also launches offline into Home. Both files are generated and git-ignored. `next.config.ts` serves the
  worker and the shell manifest `Cache-Control: no-cache`, the web app manifest as `application/manifest+json`, and
  `/index.html` as Home (the shell's offline page). A `next dev` session serves the worker but has no shell manifest.
  Offline (no app server), the installed app opens on Home: the worker answers every offline navigation with that one
  page, and a Next.js page renders only its own route (from its HTML, or from an RSC payload fetched with an `RSC`
  header that a file manifest cannot list), so `/play` needs the app server; its scene files still come from the device.
* **Toolkit version.** The installer ships with the `@babylonjs-toolkit/next` release that adds
  `@babylonjs-toolkit/next/contentinstaller` and `workers/bt-content-worker.js`. With an older toolkit the build step
  warns once and copies no worker, and the layer stays unavailable.

The asset host's requirements (CORS, `Content-Encoding: gzip` on `.gz.` files, `content-manifest.json` served
`Cache-Control: no-cache`) and S3 / CloudFront examples are in the AppTemplate README, section "Hosting game content for
the content installer".

Every successful export — a level, a container, a project build or a Build All — writes the `content-manifest.json`
of the scenes folder it wrote, with no setting to turn on. **Progressive Web App** in Canvas Tools only turns on
engine.html's downloader. To rebuild the manifest of any scenes folder, run
`unity command bt_build_content_manifest [--folder <scenes folder>]`; add `--check true` to compare it with the files
without writing anything (deploy scripts read `success` from `--format json`; `false` lists the differences).

**Deploy order:**

1. Run the check: `unity command bt_build_content_manifest --check true --folder <scenes folder> --format json`, and
   stop when `success` is `false`.
2. Upload the content files.
3. Upload `content-manifest.json` last.
4. Invalidate the manifest's path on the CDN (for example `/scenes/content-manifest.json` on CloudFront).

A manifest that arrives before its files, or a stale cached manifest, makes players fetch files that do not match it.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
