import type { IContentInstallerOptions, IContentInstallerState, IContentRootOptions } from "@babylonjs-toolkit/next";

/** What the installer stores: every group, each group the first time it loads, or nothing. */
export type ContentInstallPolicyOption = "everything" | "as-you-play" | "off";

/** How content updates are taken: announced for the player, applied automatically, or only on request. */
export type ContentUpdatePolicyOption = "prompt" | "automatic" | "manual";

/** Options a host app gives the provider (one object per app, usually in `src/config`). */
export interface IContentInstallerHostOptions {
    /** False keeps the whole layer inert: no worker, no state, components render nothing. */
    enabled: boolean;
    /** The app's one scene base URL (ends with "/"); the content manifest is "<sceneBaseUrl>content-manifest.json". */
    sceneBaseUrl: string;
    /** What to store; the installer's default is "as-you-play". */
    installPolicy?: ContentInstallPolicyOption;
    /** How updates are taken; the installer's default is "prompt". */
    updatePolicy?: ContentUpdatePolicyOption;
    /** Runs the installer on localhost and private network hosts too (off by default, so dev sessions behave as before). */
    enableOnLocalHost?: boolean;
    /** Adds the app shell root "./bt-shell-manifest.json"; defaults to `import.meta.env.PROD` (D23). */
    includeAppShell?: boolean;
    /**
     * Prepares graphics with the game data (on by default): Download also compiles the shaders of every level and
     * container on a hidden engine, and the Downloaded state offers Prepare graphics when they are missing or stale.
     * False keeps the download as it was.
     */
    prepareGraphics?: boolean;
    /**
     * The hidden priming engine's options: give it the switches the game's own engine plays with, so the shaders it
     * compiles are the ones the game asks for. Defaults to `DEFAULT_PRIMING_ENGINE_OPTIONS`.
     */
    primingEngineOptions?: IContentPrimingEngineOptions;
    /**
     * The game loads more into its levels after they load (containers: racers, items), so prime each level with the shader
     * variants those later loads bring (`SceneShaderWarmup.PrimingMatchesLaterLoads`; e.g. Babylon's glTF loader raises
     * every material's light count at the next load). Default false: a page that loads one scene would prime variants it
     * never uses. Ignored by a toolkit without the switch.
     */
    primingMatchesLaterLoads?: boolean;
    /**
     * Replaces how a scene is prepared, keeping the installer's records and progress: given the toolkit's preparer (a hidden
     * engine that loads each scene file alone), it returns the one Prepare graphics uses. A game whose scripts change what its
     * levels draw (racers, shadows) can load the real level here, so the shaders compiled are exactly the ones a play asks for.
     * Default: the toolkit's preparer.
     */
    wrapGraphicsPreparer?: (preparer: IContentScenePreparer) => IContentScenePreparer;
    /**
     * Runs once before the first Prepare graphics step, after the toolkit's scene module loaded: set up what the game's
     * own engine page sets before a scene loads (Draco and KTX2 decoder locations, for example), since the menu page
     * never ran it.
     */
    beforeGraphicsPreparation?: () => Promise<void> | void;
}

/** What Prepare graphics calls (`TOOLKIT.IContentGraphicsPreparer`), typed here so the layer compiles against a toolkit without it. */
export interface IContentScenePreparer {
    /** The engine type the prepared code belongs to ("webgpu", "webgl2"). */
    readonly engineKey: string;
    /** The toolkit runtime version that prepares. */
    readonly runtimeVersion: string;
    /** The Babylon version that prepares. */
    readonly babylonVersion: string;
    /**
     * Compiles every shader a scene needs; rejects when it cannot.
     * @param sceneUrl - The scene file URL.
     * @param isCancelled - True once the step was cancelled.
     * @param onProgress - The scene's progress, 0 to 1.
     */
    prepareSceneAsync(sceneUrl: string, isCancelled: () => boolean, onProgress?: (fraction: number) => void): Promise<void>;
    /** Frees what the preparer made, when a Prepare graphics step ends. */
    release?(): void;
}

/**
 * The hidden priming engine's options (`TOOLKIT.IPrimingEngineOptions` of `SceneShaderWarmup.CreatePrimingEngineAsync`),
 * typed here so the layer compiles against a toolkit without Prepare graphics.
 */
export interface IContentPrimingEngineOptions {
    /** WebGPU when the browser gives an adapter, else WebGL2 (the game's own rule); default true. */
    preferWebGPU?: boolean;
    /** Multisampled canvas; default true. */
    antialias?: boolean;
    /** Size the canvas by the device pixel ratio; default false. */
    adaptToDeviceRatio?: boolean;
    /** Extra WebGL2 engine options (e.g. `useLargeWorldRendering`, which changes the compiled shaders). */
    engineOptions?: Record<string, unknown>;
    /** Extra WebGPU engine options (e.g. `useLargeWorldRendering`, `setMaximumLimits`, `enableAllFeatures`). */
    webGPUOptions?: Record<string, unknown>;
    /** The glslang script and wasm the WebGPU engine loads (its `initAsync` first argument); Babylon's CDN when left out. */
    glslangOptions?: IContentScriptPaths;
    /** The twgsl script and wasm the WebGPU engine loads (its `initAsync` second argument); Babylon's CDN when left out. */
    twgslOptions?: IContentScriptPaths;
}

/** Where a WebGPU helper library is served: its script and its wasm. */
export interface IContentScriptPaths {
    /** The script URL, e.g. "scripts/glslang.js". */
    jsPath?: string;
    /** The wasm URL, e.g. "scripts/glslang.wasm". */
    wasmPath?: string;
}

/** The priming engine's options when the host gives none: the toolkit's defaults (WebGPU first, antialiased). */
export const DEFAULT_PRIMING_ENGINE_OPTIONS: Readonly<IContentPrimingEngineOptions> = Object.freeze({
    preferWebGPU: true,
    antialias: true,
    adaptToDeviceRatio: false,
});

/** The service worker script the app serves at its root (written by `vite-content-installer.ts`). */
const WORKER_URL: string = "./bt-content-worker.js";
/** The worker's registration scope: the app's root folder. */
const WORKER_SCOPE: string = "./";
/** File name of an export's content manifest inside its scenes folder. */
const CONTENT_MANIFEST_FILE_NAME: string = "content-manifest.json";
/** The app shell manifest the Vite plugin writes at build. */
const SHELL_MANIFEST_URL: string = "./bt-shell-manifest.json";
/** The display-mode media query of a page launched as an installed app. */
const STANDALONE_MEDIA_QUERY: string = "(display-mode: standalone)";

/** iOS Safari's own flag for a page launched from the home screen. */
interface INavigatorWithStandalone extends Navigator {
    standalone?: boolean;
}

/**
 * Resolves a URL against the document's base URL, so relative host settings work under any serving prefix.
 * @param url - An absolute or relative URL.
 * @returns The absolute URL.
 */
function resolveAgainstDocument(url: string): string {
    return new URL(url, document.baseURI).href;
}

/**
 * Builds the options of `ContentInstaller.Initialize` from the host options: the content root (and, in production
 * builds, the app shell root) resolved against `document.baseURI`, the worker "./bt-content-worker.js" and scope "./".
 * @param hostOptions - The app's installer options.
 * @returns The Initialize options.
 */
export function createContentInstallerOptions(hostOptions: IContentInstallerHostOptions): IContentInstallerOptions {
    const includeAppShell: boolean = hostOptions.includeAppShell ?? import.meta.env.PROD;
    const roots: IContentRootOptions[] = [
        { manifestUrl: resolveAgainstDocument(hostOptions.sceneBaseUrl + CONTENT_MANIFEST_FILE_NAME) },
    ];
    if (includeAppShell) roots.push({ manifestUrl: resolveAgainstDocument(SHELL_MANIFEST_URL), isAppShell: true });
    return {
        roots,
        workerUrl: resolveAgainstDocument(WORKER_URL),
        workerScope: resolveAgainstDocument(WORKER_SCOPE),
        installPolicy: hostOptions.installPolicy,
        updatePolicy: hostOptions.updatePolicy,
        enableOnLocalHost: hostOptions.enableOnLocalHost,
    };
}

/**
 * Tells whether the page runs as an installed app.
 * @returns True for `display-mode: standalone`, or `navigator.standalone` on iOS.
 */
export function isStandaloneLaunch(): boolean {
    if (typeof window === "undefined") return false;
    const matchesStandalone: boolean = typeof window.matchMedia === "function" && window.matchMedia(STANDALONE_MEDIA_QUERY).matches;
    return matchesStandalone || (navigator as INavigatorWithStandalone).standalone === true;
}

/**
 * Tells whether to offer "Install everything": the installer runs, not everything is installed, and the player has
 * not answered the offer yet. Storage access is guarded: a throwing or missing storage counts as unanswered.
 * @param state - The installer state, or null before it loaded.
 * @param storage - Where the answer is kept (usually `localStorage`), or null.
 * @param storageKey - The key of the answer.
 * @returns True when the offer should show.
 */
export function shouldOfferInstall(state: IContentInstallerState | null, storage: Pick<Storage, "getItem"> | null, storageKey: string): boolean {
    if (state == null || state.availability !== "available" || state.everythingInstalled) return false;
    if (storage == null) return true;
    try {
        return storage.getItem(storageKey) == null;
    } catch {
        return true;
    }
}

/**
 * Records the player's answer to the install offer, so it is not shown again. Storage failures are ignored.
 * @param storage - Where the answer is kept (usually `localStorage`), or null.
 * @param storageKey - The key of the answer.
 */
export function rememberInstallOfferAnswered(storage: Pick<Storage, "setItem"> | null, storageKey: string): void {
    if (storage == null) return;
    try {
        storage.setItem(storageKey, "answered");
    } catch {
        // Private mode or a full storage: the offer may show again next time, which is harmless.
    }
}
