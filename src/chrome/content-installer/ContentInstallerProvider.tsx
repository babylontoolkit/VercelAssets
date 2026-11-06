import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import type { ContentInstaller, IContentInstallerState, IContentInstallProgress } from "@babylonjs-toolkit/next";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { IContentGraphicsStateFields } from "./contentGraphics";
import {
    createContentInstallerOptions,
    DEFAULT_PRIMING_ENGINE_OPTIONS,
    type IContentInstallerHostOptions,
    type IContentPrimingEngineOptions,
    type IContentScenePreparer,
} from "./contentInstallerConfig";
import {
    ContentInstallerContext,
    type IContentInstallActionOptions,
    type IContentInstallerActions,
    type IContentInstallerContextValue,
} from "./useContentInstaller";

/** The toolkit's installer class (a type only: the module itself is loaded with `import()`). */
export type ContentInstallerClass = typeof ContentInstaller;

/** A progress subscriber. */
type ProgressListener = (progress: IContentInstallProgress) => void;

/**
 * A graphics preparer (`TOOLKIT.IContentGraphicsPreparer`, faster-scene-loading T4). The provider only hands it from the
 * toolkit's scene module to the installer, so it stays opaque here.
 */
type GraphicsPreparer = object;

/**
 * The installer's Prepare graphics calls (T4), typed here and checked before each use, so the layer compiles and runs
 * against a toolkit without them.
 */
interface IGraphicsCapableInstaller {
    /** Sets, replaces or clears the installer's graphics preparer. */
    SetGraphicsPreparer?(preparer: GraphicsPreparer | null): void;
    /** Prepares the graphics of stored scene groups (null = all of them); resolves true when every group was prepared. */
    PrepareGraphicsAsync?(groupIds?: string[] | null, options?: { background?: boolean }): Promise<boolean>;
}

/** What the provider needs from `SceneShaderWarmup` of `@babylonjs-toolkit/next` (T4); checked before use. */
interface IPrimingSceneWarmup {
    /** Makes a preparer for a page with no engine: one hidden priming engine per step; null when none can be made. */
    CreatePrimingGraphicsPreparerAsync?(options?: IContentPrimingEngineOptions): Promise<GraphicsPreparer | null>;
    /** Primes each level with the shader variants a later load into it brings (more lights after a container load). */
    PrimingMatchesLaterLoads?: boolean;
}

/** Props of ContentInstallerProvider. */
export interface IContentInstallerProviderProps {
    /** The app's installer options. */
    options: IContentInstallerHostOptions;
    /** The app. */
    children: ReactNode;
}

/** Reason shown when the toolkit package has no content installer (D34). */
const NO_INSTALLER_REASON: string = "this @babylonjs-toolkit/next has no content installer";
/** Fallback delay before loading the installer where `requestIdleCallback` is missing, in milliseconds. */
const IDLE_FALLBACK_DELAY_MS: number = 1500;
/** The installer's default install policy (D19), shown while it is unavailable. */
const DEFAULT_INSTALL_POLICY: IContentInstallerState["installPolicy"] = "as-you-play";
/** The installer's default update policy (D19), shown while it is unavailable. */
const DEFAULT_UPDATE_POLICY: IContentInstallerState["updatePolicy"] = "prompt";
/** Prefix of the one console warning a Prepare graphics that cannot run here gives. */
const GRAPHICS_WARNING_PREFIX: string = "[ContentInstaller] Prepare graphics is not available here: ";
/** The page globals the toolkit's package index sets; an exported project script bundle reads them when its scene loads. */
interface IToolkitPageGlobals {
    /** The toolkit namespace. */
    TOOLKIT?: unknown;
    /** The Babylon namespace. */
    BABYLON?: unknown;
}

/** Reason when the toolkit's package index did not set its page globals. */
const NO_TOOLKIT_GLOBALS_REASON: string = "the @babylonjs-toolkit/next index did not set window.TOOLKIT and window.BABYLON";
/** Reason when the toolkit's scene module has no priming preparer. */
const NO_PRIMING_PREPARER_REASON: string = "this @babylonjs-toolkit/next has no SceneShaderWarmup.CreatePrimingGraphicsPreparerAsync";
/** Reason when the installer has no Prepare graphics step. */
const NO_GRAPHICS_STEP_REASON: string = "this @babylonjs-toolkit/next ContentInstaller has no Prepare graphics step";
/** Reason when the browser can make neither a WebGPU nor a WebGL2 engine. */
const NO_PRIMING_ENGINE_REASON: string = "no hidden WebGPU or WebGL2 engine can be made in this browser";

/** The loaded and initialized installer class, shared with `sceneLoad.ts`; null until then. */
let loadedContentInstaller: ContentInstallerClass | null = null;
/** Starts (or joins) the mounted provider's load; null while no enabled provider is mounted. */
let startMountedProvider: (() => Promise<ContentInstallerClass | null>) | null = null;

/**
 * Returns the installer class once the provider has loaded and initialized it.
 * @returns The class, or null before that (or when the layer is disabled).
 */
export function getLoadedContentInstaller(): ContentInstallerClass | null {
    return loadedContentInstaller;
}

/**
 * Tells whether an enabled provider is mounted (the layer is on for this app).
 * @returns True while an enabled ContentInstallerProvider is mounted.
 */
export function isContentInstallerMounted(): boolean {
    return startMountedProvider != null;
}

/**
 * Loads and initializes the installer now instead of waiting for idle (a scene is about to load). Joins a load that
 * is already running.
 * @returns The initialized class, or null when no enabled provider is mounted or the installer could not load.
 */
export function loadContentInstallerNow(): Promise<ContentInstallerClass | null> {
    if (startMountedProvider == null) return Promise.resolve(loadedContentInstaller);
    return startMountedProvider();
}

/**
 * A full state for an installer that cannot run.
 * @param hostOptions - The app's installer options (their policies are shown).
 * @param reason - Why it cannot run.
 * @returns The state.
 */
function createUnavailableState(hostOptions: IContentInstallerHostOptions, reason: string): IContentInstallerState {
    // The graphics fields are typed by the layer, so the state compiles with and without a toolkit that has them.
    const unavailableState: IContentInstallerState & IContentGraphicsStateFields = {
        availability: "unavailable",
        reason,
        installPolicy: hostOptions.installPolicy ?? DEFAULT_INSTALL_POLICY,
        updatePolicy: hostOptions.updatePolicy ?? DEFAULT_UPDATE_POLICY,
        isLeader: false,
        installing: false,
        paused: false,
        persisted: null,
        totalBytes: 0,
        installedBytes: 0,
        everythingInstalled: false,
        updateAvailable: null,
        updateReady: false,
        applyOnNextLoad: false,
        shellUpdateReady: false,
        lastError: null,
        contentChangedOnServer: false,
        graphicsAvailable: false,
        graphicsPreparing: false,
        graphicsNeeded: false,
        graphicsPreparedCount: 0,
        graphicsGroupCount: 0,
    };
    return unavailableState;
}

/**
 * Shallow equality of two states (nested objects compare by reference; the installer replaces them when they change).
 * @param previous - The current React state.
 * @param next - The new installer state.
 * @returns True when every field is identical.
 */
function statesEqual(previous: IContentInstallerState | null, next: IContentInstallerState): boolean {
    if (previous == null) return false;
    const keys: Array<keyof IContentInstallerState> = Object.keys(next) as Array<keyof IContentInstallerState>;
    return keys.every((key: keyof IContentInstallerState) => previous[key] === next[key]);
}

/**
 * Runs a callback when the browser is idle (or after a short delay where idle callbacks are missing).
 * @param callback - What to run.
 * @returns Cancels the callback when it has not run yet.
 */
function scheduleIdle(callback: () => void): () => void {
    if (typeof window.requestIdleCallback === "function") {
        const idleHandle: number = window.requestIdleCallback(callback);
        return () => window.cancelIdleCallback(idleHandle);
    }
    const timeoutHandle: number = window.setTimeout(callback, IDLE_FALLBACK_DELAY_MS);
    return () => window.clearTimeout(timeoutHandle);
}

/**
 * Describes a thrown value in one line.
 * @param error - The thrown value.
 * @returns Its message.
 */
function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Gives the installer its graphics preparer: loads the toolkit's package index (only for a player who downloaded or
 * prepares, never on idle for everyone, so a player who never downloads never loads Babylon on the menu), runs the
 * host's set-up, and makes a priming preparer with the host's engine options. The index, not just the scene module:
 * it sets `window.TOOLKIT` and `window.BABYLON`, which the project script bundle of an exported scene reads when the
 * preparer loads that scene, as the game's own page sets them before its first scene. The preparer makes its hidden
 * engine when the first scene is prepared and disposes it when the step ends.
 * @param installer - The loaded installer.
 * @param hostOptions - The app's installer options.
 * @returns Null when the preparer is set, else why it cannot be.
 */
async function setGraphicsPreparer(installer: ContentInstallerClass, hostOptions: IContentInstallerHostOptions): Promise<string | null> {
    const graphicsInstaller: ContentInstallerClass & IGraphicsCapableInstaller = installer as ContentInstallerClass & IGraphicsCapableInstaller;
    if (typeof graphicsInstaller.SetGraphicsPreparer !== "function" || typeof graphicsInstaller.PrepareGraphicsAsync !== "function") return NO_GRAPHICS_STEP_REASON;
    const toolkitModule = await import("@babylonjs-toolkit/next");
    // Reading the namespace keeps the index and its global-setting side effect in production builds ("sideEffects": false).
    const toolkitExportCount: number = Object.keys(toolkitModule).length;
    const pageGlobals: Window & IToolkitPageGlobals = window as Window & IToolkitPageGlobals;
    if (toolkitExportCount === 0 || pageGlobals.TOOLKIT == null || pageGlobals.BABYLON == null) return NO_TOOLKIT_GLOBALS_REASON;
    const sceneWarmup: typeof toolkitModule.SceneShaderWarmup & IPrimingSceneWarmup = toolkitModule.SceneShaderWarmup as typeof toolkitModule.SceneShaderWarmup & IPrimingSceneWarmup;
    if (typeof sceneWarmup.CreatePrimingGraphicsPreparerAsync !== "function") return NO_PRIMING_PREPARER_REASON;
    if (hostOptions.primingMatchesLaterLoads === true && sceneWarmup.PrimingMatchesLaterLoads !== undefined) sceneWarmup.PrimingMatchesLaterLoads = true;
    await hostOptions.beforeGraphicsPreparation?.();
    const primingEngineOptions: IContentPrimingEngineOptions = hostOptions.primingEngineOptions ?? DEFAULT_PRIMING_ENGINE_OPTIONS;
    const preparer: GraphicsPreparer | null = await sceneWarmup.CreatePrimingGraphicsPreparerAsync(primingEngineOptions);
    if (preparer == null) return NO_PRIMING_ENGINE_REASON;
    const hostPreparer: GraphicsPreparer = hostOptions.wrapGraphicsPreparer?.(preparer as IContentScenePreparer) ?? preparer;
    graphicsInstaller.SetGraphicsPreparer(hostPreparer);
    return null;
}

/**
 * The installer calls, each made on the loaded installer at call time (inert before it loaded). Prepare graphics (an
 * install with `prepareGraphics`, or `prepareGraphics()`) first gives the installer its preparer, once per page; when
 * that fails the step is skipped, `onGraphicsUnavailable` runs and the download goes on as before.
 * @param hostOptions - The app's installer options (`prepareGraphics`, the priming engine's options and set-up).
 * @param onGraphicsUnavailable - Runs once when Prepare graphics cannot run in this browser.
 * @returns The actions.
 */
function createActions(hostOptions: IContentInstallerHostOptions, onGraphicsUnavailable: () => void): IContentInstallerActions {
    const isGraphicsEnabled: boolean = hostOptions.prepareGraphics !== false;
    // The one attempt of this page to set the preparer; later calls share its answer.
    let graphicsReady: Promise<boolean> | null = null;
    const trySetGraphicsPreparer = async (installer: ContentInstallerClass): Promise<boolean> => {
        let unavailableReason: string | null;
        try {
            unavailableReason = await setGraphicsPreparer(installer, hostOptions);
        } catch (error) {
            unavailableReason = describeError(error);
        }
        if (unavailableReason == null) return true;
        console.warn(GRAPHICS_WARNING_PREFIX + unavailableReason);
        onGraphicsUnavailable();
        return false;
    };
    const ensureGraphicsPreparer = (installer: ContentInstallerClass): Promise<boolean> => {
        if (!isGraphicsEnabled) return Promise.resolve(false);
        graphicsReady ??= trySetGraphicsPreparer(installer);
        return graphicsReady;
    };
    const install = async (groupIds?: string[] | null, options?: IContentInstallActionOptions): Promise<boolean> => {
        const installer: ContentInstallerClass | null = loadedContentInstaller;
        if (installer == null) return false;
        // The preparer is set before the download starts, so the installer finds it when the download ends.
        const prepareGraphics: boolean = options?.prepareGraphics === true && await ensureGraphicsPreparer(installer);
        const installOptions: IContentInstallActionOptions = { ...options, prepareGraphics };
        return installer.Install(groupIds ?? null, installOptions);
    };
    const prepareGraphics = async (groupIds?: string[] | null): Promise<boolean> => {
        const installer: ContentInstallerClass | null = loadedContentInstaller;
        if (installer == null || !(await ensureGraphicsPreparer(installer))) return false;
        const graphicsInstaller: ContentInstallerClass & IGraphicsCapableInstaller = installer as ContentInstallerClass & IGraphicsCapableInstaller;
        try {
            return (await graphicsInstaller.PrepareGraphicsAsync?.(groupIds ?? null)) === true;
        } catch (error) {
            console.warn(GRAPHICS_WARNING_PREFIX + describeError(error));
            return false;
        }
    };
    const loadGraphicsPreparer = (): void => {
        const installer: ContentInstallerClass | null = loadedContentInstaller;
        if (installer == null || !isGraphicsEnabled || graphicsReady != null) return;
        scheduleIdle(() => {
            void ensureGraphicsPreparer(installer);
        });
    };
    return {
        install,
        prepareGraphics,
        loadGraphicsPreparer,
        pause: () => loadedContentInstaller?.Pause(),
        resume: () => loadedContentInstaller?.Resume(),
        cancel: () => loadedContentInstaller?.Cancel(),
        remove: (groupIds) => loadedContentInstaller?.Remove(groupIds ?? null) ?? Promise.resolve(),
        estimate: async (groupIds) => {
            if (loadedContentInstaller == null) return null;
            try {
                return await loadedContentInstaller.EstimateInstall(groupIds ?? undefined);
            } catch {
                return null;
            }
        },
        downloadUpdate: () => loadedContentInstaller?.DownloadUpdate() ?? Promise.resolve(false),
        acceptUpdate: () => loadedContentInstaller?.AcceptUpdate(),
        applyShellUpdate: () => loadedContentInstaller?.ApplyShellUpdate(),
        setBusy: (busy) => loadedContentInstaller?.SetBusy(busy),
        groupStatus: (groupIds) => loadedContentInstaller?.GetGroupStatus(groupIds) ?? [],
    };
}

/**
 * Hosts the content installer for the app (pwa-content-installer D6, D18, D25). When enabled it loads
 * `@babylonjs-toolkit/next/contentinstaller` with `import()` once the page is idle (so Home loads no Babylon code first),
 * initializes it and keeps its discrete state in React state, set only when it changed. Progress never touches React
 * state: components subscribe to it and write the DOM through refs (`useInstallProgressRefs`).
 * @param props - The options and the app.
 * @returns The app inside the installer context.
 */
export function ContentInstallerProvider(props: IContentInstallerProviderProps): ReactElement {
    const { options, children } = props;
    const [state, setState] = useState<IContentInstallerState | null>(null);
    // Set once a Prepare graphics found that no preparer can be made here: the Prepare graphics button then stays hidden.
    const [isGraphicsUnavailable, setGraphicsUnavailable] = useState<boolean>(false);
    const progressListeners = useRef<Set<ProgressListener>>(new Set<ProgressListener>());
    const actions: IContentInstallerActions = useMemo(() => createActions(options, () => setGraphicsUnavailable(true)), [options]);
    const graphicsEnabled: boolean = options.prepareGraphics !== false && !isGraphicsUnavailable;

    const subscribeProgress = useCallback((listener: ProgressListener): (() => void) => {
        progressListeners.current.add(listener);
        return () => {
            progressListeners.current.delete(listener);
        };
    }, []);

    useEffect(() => {
        if (!options.enabled) return undefined;
        let disposed: boolean = false;
        let startPromise: Promise<ContentInstallerClass | null> | null = null;
        let removeObservers: (() => void) | null = null;

        const applyState = (next: IContentInstallerState): void => {
            if (disposed) return;
            setState((previous: IContentInstallerState | null) => (statesEqual(previous, next) ? previous : next));
        };
        const forwardProgress = (progress: IContentInstallProgress): void => {
            progressListeners.current.forEach((listener: ProgressListener) => listener(progress));
        };
        const loadAndInitialize = async (): Promise<ContentInstallerClass | null> => {
            let installer: ContentInstallerClass;
            try {
                installer = (await import("@babylonjs-toolkit/next/contentinstaller")).ContentInstaller;
            } catch {
                applyState(createUnavailableState(options, NO_INSTALLER_REASON));
                return null;
            }
            if (disposed) return null;
            const stateObserver: Observer<IContentInstallerState> | null = installer.OnStateChangedObservable.add(applyState);
            const progressObserver: Observer<IContentInstallProgress> | null = installer.OnProgressObservable.add(forwardProgress);
            removeObservers = () => {
                installer.OnStateChangedObservable.remove(stateObserver);
                installer.OnProgressObservable.remove(progressObserver);
            };
            try {
                applyState(await installer.Initialize(createContentInstallerOptions(options)));
            } catch (error) {
                applyState(createUnavailableState(options, describeError(error)));
                return null;
            }
            loadedContentInstaller = installer;
            return installer;
        };
        const start = (): Promise<ContentInstallerClass | null> => {
            if (startPromise == null) startPromise = loadAndInitialize();
            return startPromise;
        };

        startMountedProvider = start;
        const cancelIdleStart: () => void = scheduleIdle(() => {
            void start();
        });
        return () => {
            disposed = true;
            cancelIdleStart();
            if (startMountedProvider === start) startMountedProvider = null;
            removeObservers?.();
        };
    }, [options]);

    const contextValue: IContentInstallerContextValue = useMemo(
        () => ({ state, actions, subscribeProgress, graphicsEnabled }),
        [state, actions, subscribeProgress, graphicsEnabled],
    );

    if (!options.enabled) return <>{children}</>;
    return <ContentInstallerContext.Provider value={contextValue}>{children}</ContentInstallerContext.Provider>;
}
