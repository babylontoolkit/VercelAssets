import { createContext, useContext } from "react";
import type { IContentGroupStatus, IContentInstallerState, IContentInstallProgress, IContentStorageEstimate } from "@babylonjs-toolkit/next";

/** Options of `IContentInstallerActions.install`. */
export interface IContentInstallActionOptions {
    /** Waits while the game is busy (SetBusy), one file at a time. */
    background?: boolean;
    /**
     * After the download, prepares the graphics of every stored level and container (compiles their shaders on a hidden
     * engine, so each later load starts faster). Ignored when the host turned Prepare graphics off or the toolkit has none.
     */
    prepareGraphics?: boolean;
}

/** The installer calls a host component can make; each is a safe no-op until the installer has loaded. */
export interface IContentInstallerActions {
    /** Installs groups (null or empty = everything, app shell included); resolves true when all of them are installed. */
    install(groupIds?: string[] | null, options?: IContentInstallActionOptions): Promise<boolean>;
    /**
     * Prepares the graphics of stored scene groups (null or empty = every stored level and container): loads each one on
     * a hidden engine made for the step, compiles its shaders and disposes it. Pause, Resume and Cancel control it as
     * they control a download. Resolves true when every group was prepared; false at once when it cannot run.
     */
    prepareGraphics(groupIds?: string[] | null): Promise<boolean>;
    /**
     * Gives the installer its graphics preparer once the browser is idle (once per page), without preparing anything:
     * until then the installer cannot tell graphics prepared for another engine (WebGPU versus WebGL2) or another toolkit
     * runtime from current ones. Call it where a player who downloaded the game data sees whether its graphics are
     * prepared (the dialog's Downloaded state); it loads the toolkit, so never call it for everyone.
     */
    loadGraphicsPreparer(): void;
    /** Pauses the running install after the files already downloading. */
    pause(): void;
    /** Resumes a paused install. */
    resume(): void;
    /** Cancels every queued install. */
    cancel(): void;
    /** Removes stored groups (null or empty = everything). */
    remove(groupIds?: string[] | null): Promise<void>;
    /** Free space versus what installing the groups needs; null before the installer loaded or when it failed. */
    estimate(groupIds?: string[] | null): Promise<IContentStorageEstimate | null>;
    /** Downloads a found content update in the background; resolves true when it is ready to apply. */
    downloadUpdate(): Promise<boolean>;
    /** Applies the ready update at the next scene load or page start. */
    acceptUpdate(): void;
    /** Activates a waiting app shell update and reloads the page. */
    applyShellUpdate(): void;
    /** Holds background installs while true (D20); hosts call it around play. */
    setBusy(busy: boolean): void;
    /** Install status of groups of the active version (every group when omitted); empty before the installer loaded. */
    groupStatus(groupIds?: string[]): IContentGroupStatus[];
}

/** What `useContentInstaller` returns. */
export interface IContentInstallerContextValue {
    /** Null until the installer module has loaded (or forever when disabled). */
    state: IContentInstallerState | null;
    /** The installer calls. */
    actions: IContentInstallerActions;
    /** Subscribes to throttled progress (telemetry: write it through refs, never React state); returns the unsubscribe. */
    subscribeProgress(listener: (progress: IContentInstallProgress) => void): () => void;
    /**
     * True while the host prepares graphics (its `prepareGraphics` option, on by default) and no attempt found that no
     * hidden engine can be made in this browser; read with the state to show the Prepare graphics button.
     */
    graphicsEnabled: boolean;
}

/** Actions used outside a provider, or while the layer is disabled: they do nothing. */
const INERT_ACTIONS: IContentInstallerActions = {
    install: () => Promise.resolve(false),
    prepareGraphics: () => Promise.resolve(false),
    loadGraphicsPreparer: () => undefined,
    pause: () => undefined,
    resume: () => undefined,
    cancel: () => undefined,
    remove: () => Promise.resolve(),
    estimate: () => Promise.resolve(null),
    downloadUpdate: () => Promise.resolve(false),
    acceptUpdate: () => undefined,
    applyShellUpdate: () => undefined,
    setBusy: () => undefined,
    groupStatus: () => [],
};

/** The context value outside a provider: no state, inert actions, no progress. */
const INERT_CONTEXT_VALUE: IContentInstallerContextValue = {
    state: null,
    actions: INERT_ACTIONS,
    subscribeProgress: () => () => undefined,
    graphicsEnabled: false,
};

/** The content installer context, filled by `ContentInstallerProvider`. */
export const ContentInstallerContext = createContext<IContentInstallerContextValue>(INERT_CONTEXT_VALUE);

/**
 * Reads the content installer's discrete state, its actions and the progress subscription.
 * Outside a provider (or with the layer disabled) the state stays null and the actions do nothing.
 * @returns The installer context value.
 */
export function useContentInstaller(): IContentInstallerContextValue {
    return useContext(ContentInstallerContext);
}
