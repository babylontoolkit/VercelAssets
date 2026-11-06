import { useState, type ReactElement } from "react";
import type { IContentInstallerState } from "@babylonjs-toolkit/next";
import { shouldOfferPrepareGraphics } from "./contentGraphics";
import { useContentInstaller, type IContentInstallerActions } from "./useContentInstaller";
import { formatMegabytes } from "./useInstallProgressRefs";

/** Props of ContentUpdateToast. */
export interface IContentUpdateToastProps {
    /** Extra class names for the toast root. */
    className?: string;
}

/** What a toast announces, highest priority first. */
type ToastKind = "shell" | "changed" | "ready" | "available" | "graphics";

/** One toast's text and buttons. */
interface IToastContent {
    /** The message. */
    message: string;
    /** The primary button's label. */
    primaryLabel: string;
    /** True when the toast offers Later. */
    hasLater: boolean;
}

/**
 * Picks the toast to show, by priority: a new app shell, game content that changed on the server under this page, a
 * downloaded update, a found update, graphics to prepare on a device with all the game data. Kinds the player put off
 * with Later and an update whose download already started are skipped; an `automatic` policy never asks.
 * @param state - The installer state.
 * @param dismissedKinds - Kinds put off until the next page load.
 * @param downloadStarted - True once the player pressed Update.
 * @param isGraphicsEnabled - The host prepares graphics.
 * @returns The kind, or null for no toast.
 */
function selectToastKind(state: IContentInstallerState | null, dismissedKinds: ReadonlySet<ToastKind>, downloadStarted: boolean, isGraphicsEnabled: boolean): ToastKind | null {
    if (state == null || state.availability !== "available") return null;
    const asksPlayer: boolean = state.updatePolicy !== "automatic";
    if (state.shellUpdateReady && !dismissedKinds.has("shell")) return "shell";
    if (state.contentChangedOnServer && !dismissedKinds.has("changed")) return "changed";
    if (asksPlayer && state.updateReady && !state.applyOnNextLoad && !dismissedKinds.has("ready")) return "ready";
    if (asksPlayer && state.updateAvailable != null && !state.updateReady && !downloadStarted && !dismissedKinds.has("available")) return "available";
    if (shouldOfferPrepareGraphics(state, isGraphicsEnabled) && !dismissedKinds.has("graphics")) return "graphics";
    return null;
}

/**
 * The text of a toast kind.
 * @param kind - The kind.
 * @param state - The installer state (for the update size).
 * @returns The message and button labels.
 */
function describeToast(kind: ToastKind, state: IContentInstallerState | null): IToastContent {
    if (kind === "shell") return { message: "A new version of the game is ready", primaryLabel: "Reload", hasLater: false };
    if (kind === "changed") return { message: "Game content changed on the server", primaryLabel: "Reload", hasLater: true };
    if (kind === "ready") return { message: "Game content updated", primaryLabel: "Apply", hasLater: true };
    if (kind === "graphics") return { message: "Prepare graphics so levels load faster", primaryLabel: "Prepare", hasLater: true };
    const downloadBytes: number = state?.updateAvailable?.downloadBytes ?? 0;
    return { message: `New game content — ${formatMegabytes(downloadBytes)}`, primaryLabel: "Update", hasLater: true };
}

/**
 * Runs a toast kind's primary action.
 * @param kind - The kind.
 * @param actions - The installer actions.
 */
function runPrimaryAction(kind: ToastKind, actions: IContentInstallerActions): void {
    if (kind === "shell") actions.applyShellUpdate();
    else if (kind === "changed") window.location.reload();
    else if (kind === "ready") actions.acceptUpdate();
    else if (kind === "graphics") void actions.prepareGraphics();
    else void actions.downloadUpdate();
}

/**
 * The content update toast (unstyled; the app skins its class hooks). One toast at a time, by priority: a new app shell
 * ("A new version of the game is ready" — Reload), game content that changed on the server while this page ran ("Game
 * content changed on the server" — Reload / Later; the reload is never automatic), a downloaded update ("Game content updated" — Apply / Later), a found
 * update ("New game content — 34 MB" — Update / Later), graphics to prepare ("Prepare graphics so levels load faster" —
 * Prepare / Later). Later hides that toast until the next page load. Enter and exit
 * are CSS transitions on the `content-toast--visible` class.
 * @param props - Extra class names.
 * @returns The toast, or null while the installer is not loaded.
 */
export function ContentUpdateToast(props: IContentUpdateToastProps): ReactElement | null {
    const { className } = props;
    const { state, actions, graphicsEnabled } = useContentInstaller();
    const [dismissedKinds, setDismissedKinds] = useState<ReadonlySet<ToastKind>>(() => new Set<ToastKind>());
    const [downloadStarted, setDownloadStarted] = useState<boolean>(false);
    // The last toast shown, kept so its text stays on screen while it slides out.
    const [shownKind, setShownKind] = useState<ToastKind | null>(null);

    const activeKind: ToastKind | null = selectToastKind(state, dismissedKinds, downloadStarted, graphicsEnabled);
    // React's "information from previous renders" pattern: set during render, only when the shown toast changes.
    if (activeKind != null && activeKind !== shownKind) setShownKind(activeKind);
    if (state == null || shownKind == null) return null;

    const isVisible: boolean = activeKind != null;
    const content: IToastContent = describeToast(shownKind, state);
    const baseClassName: string = isVisible ? "content-toast content-toast--visible" : "content-toast";
    const rootClassName: string = className ? `${baseClassName} ${className}` : baseClassName;

    const onPrimary = (): void => {
        if (shownKind === "available") setDownloadStarted(true);
        runPrimaryAction(shownKind, actions);
    };
    const onLater = (): void => {
        setDismissedKinds((previous: ReadonlySet<ToastKind>) => new Set<ToastKind>([...previous, shownKind]));
    };

    return (
        <div className={rootClassName} role="status" aria-hidden={!isVisible} inert={!isVisible}>
            <p className="content-toast__message">{content.message}</p>
            <div className="content-toast__actions">
                <button type="button" className="content-toast__button content-toast__button--primary" onClick={onPrimary}>
                    {content.primaryLabel}
                </button>
                {content.hasLater && (
                    <button type="button" className="content-toast__button" onClick={onLater}>
                        Later
                    </button>
                )}
            </div>
        </div>
    );
}
