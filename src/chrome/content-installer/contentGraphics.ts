import type { IContentInstallerState, IContentInstallProgress } from "@babylonjs-toolkit/next";

/**
 * The Prepare graphics fields of the installer state (faster-scene-loading T4). Typed here, all optional, so the layer
 * compiles and runs against a toolkit without them: there the fields are missing and Prepare graphics never shows.
 */
export interface IContentGraphicsStateFields {
    /** A graphics preparer is set, so Prepare graphics can run. */
    graphicsAvailable?: boolean;
    /** The Prepare graphics step runs now. */
    graphicsPreparing?: boolean;
    /** Some stored scene group's graphics are not prepared (never prepared, stale after an update, or failed). */
    graphicsNeeded?: boolean;
    /** Stored scene groups whose graphics are prepared. */
    graphicsPreparedCount?: number;
    /** Stored scene groups. */
    graphicsGroupCount?: number;
}

/** The Prepare graphics fields of a progress report; download reports carry `phase: "download"` or no phase. */
export interface IContentGraphicsProgressFields {
    /** Which step the report belongs to. */
    phase?: "download" | "graphics";
    /** Graphics step: the 1-based number of the group preparing now ("n" of "n of N"). */
    graphicsCurrent?: number;
    /** Graphics step: the groups in this step ("N" of "n of N"). */
    graphicsTotal?: number;
}

/** What a dialog needs to know about prepared graphics, read from the installer state. */
export interface IContentGraphicsSummary {
    /** The toolkit reports prepared graphics (false on a toolkit without Prepare graphics). */
    isSupported: boolean;
    /** The Prepare graphics step runs now. */
    isPreparing: boolean;
    /** Some stored scene group's graphics are missing or stale. */
    isNeeded: boolean;
}

/** The phase label while graphics are prepared, before its first progress report gives the counts. */
export const PREPARING_GRAPHICS_TEXT: string = "Preparing graphics";
/** The Prepare graphics button's label. */
export const PREPARE_GRAPHICS_LABEL: string = "Prepare graphics";
/** The Downloaded line once every file is stored and every scene's graphics are prepared. */
export const DOWNLOADED_AND_PREPARED_TEXT: string = "Game data downloaded and graphics prepared";
/** The line under the Downloaded state while the graphics still need preparing. */
export const GRAPHICS_NEEDED_TEXT: string = "Prepare the graphics too, so every level starts faster.";

/**
 * Reads the Prepare graphics part of the installer state.
 * @param state - The installer state, or null before it loaded.
 * @returns The summary; everything false when the state is missing or the toolkit has no Prepare graphics.
 */
export function readContentGraphics(state: IContentInstallerState | null): IContentGraphicsSummary {
    const graphicsState: IContentGraphicsStateFields | null = state as (IContentInstallerState & IContentGraphicsStateFields) | null;
    const isSupported: boolean = typeof graphicsState?.graphicsGroupCount === "number";
    return {
        isSupported,
        isPreparing: isSupported && graphicsState?.graphicsPreparing === true,
        isNeeded: isSupported && graphicsState?.graphicsNeeded === true,
    };
}

/**
 * Tells whether to show the Prepare graphics button: the host prepares graphics, every file is stored, nothing is
 * downloading or preparing, and some scene's graphics are missing or stale.
 * @param state - The installer state, or null before it loaded.
 * @param isGraphicsEnabled - The host prepares graphics (the provider's `graphicsEnabled`).
 * @returns True when the button should show.
 */
export function shouldOfferPrepareGraphics(state: IContentInstallerState | null, isGraphicsEnabled: boolean): boolean {
    if (state == null || !isGraphicsEnabled || !state.everythingInstalled || state.installing) return false;
    const graphics: IContentGraphicsSummary = readContentGraphics(state);
    return graphics.isNeeded && !graphics.isPreparing;
}

/**
 * Tells whether every file is stored and every scene's graphics are prepared ("Game data downloaded and graphics
 * prepared"). Only once the installer has its preparer (`graphicsAvailable`): before that it cannot tell graphics
 * prepared for another engine or runtime from current ones, so the dialog keeps its plain Downloaded line until the
 * provider's `loadGraphicsPreparer` has run. On a toolkit without Prepare graphics it is never true.
 * @param state - The installer state, or null before it loaded.
 * @returns True when both are done and checked against this browser's engine.
 */
export function isDownloadedAndPrepared(state: IContentInstallerState | null): boolean {
    if (state == null || !state.everythingInstalled) return false;
    const graphics: IContentGraphicsSummary = readContentGraphics(state);
    const isPreparerSet: boolean = (state as IContentInstallerState & IContentGraphicsStateFields).graphicsAvailable === true;
    return graphics.isSupported && isPreparerSet && !graphics.isNeeded && !graphics.isPreparing;
}

/**
 * Tells whether a progress report belongs to the Prepare graphics step.
 * @param progress - The installer's progress report.
 * @returns True for `phase: "graphics"`.
 */
export function isGraphicsProgress(progress: IContentInstallProgress): boolean {
    return (progress as IContentInstallProgress & IContentGraphicsProgressFields).phase === "graphics";
}

/**
 * Formats the Prepare graphics phase line, e.g. "Preparing graphics — 3 of 18".
 * @param progress - A graphics progress report.
 * @returns The line; the bare label while the report has no counts.
 */
export function formatGraphicsProgress(progress: IContentInstallProgress): string {
    const graphicsProgress: IContentGraphicsProgressFields = progress as IContentInstallProgress & IContentGraphicsProgressFields;
    const current: number | undefined = graphicsProgress.graphicsCurrent;
    const total: number | undefined = graphicsProgress.graphicsTotal;
    if (current == null || total == null || total <= 0) return PREPARING_GRAPHICS_TEXT;
    return `${PREPARING_GRAPHICS_TEXT} — ${Math.min(current, total)} of ${total}`;
}
