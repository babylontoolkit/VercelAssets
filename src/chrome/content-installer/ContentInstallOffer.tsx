import { useState, type ReactElement } from "react";
import { isStandaloneLaunch, rememberInstallOfferAnswered, shouldOfferInstall } from "./contentInstallerConfig";
import { useContentInstaller } from "./useContentInstaller";
import { formatMegabytes } from "./useInstallProgressRefs";

/** Props of ContentInstallOffer. */
export interface IContentInstallOfferProps {
    /** Extra class names for the card root. */
    className?: string;
}

/** Where the player's answer to the standalone offer is kept (D7: offered once). */
const STANDALONE_OFFER_STORAGE_KEY: string = "bt-content-installer.standaloneOffer.v1";

/**
 * Returns `localStorage`, or null where reading it throws (blocked storage).
 * @returns The storage, or null.
 */
function readLocalStorage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/**
 * The installed-app offer (D7; unstyled, the app skins its class hooks): on a standalone launch whose game data is not
 * all on the device, a card "Download the game data to this device — <size>" with Download and Maybe Later. Shown once:
 * either button records the answer; Download also starts downloading everything, then prepares its graphics (its
 * progress shows in the host's Download Game Data dialog).
 * @param props - Extra class names.
 * @returns The card, or null when there is nothing to offer.
 */
export function ContentInstallOffer(props: IContentInstallOfferProps): ReactElement | null {
    const { className } = props;
    const { state, actions } = useContentInstaller();
    const [answered, setAnswered] = useState<boolean>(false);

    if (answered || state == null || !isStandaloneLaunch()) return null;
    if (!shouldOfferInstall(state, readLocalStorage(), STANDALONE_OFFER_STORAGE_KEY)) return null;

    const answer = (downloadEverything: boolean): void => {
        rememberInstallOfferAnswered(readLocalStorage(), STANDALONE_OFFER_STORAGE_KEY);
        setAnswered(true);
        if (downloadEverything) void actions.install(null, { prepareGraphics: true });
    };
    const rootClassName: string = className ? `content-install-offer ${className}` : "content-install-offer";

    return (
        <aside className={rootClassName} aria-label="Download game data">
            <p className="content-install-offer__message">Download the game data to this device — {formatMegabytes(state.totalBytes)}</p>
            <div className="content-install-offer__actions">
                <button type="button" className="content-install-offer__button" onClick={() => answer(true)}>
                    Download
                </button>
                <button type="button" className="content-install-offer__button" onClick={() => answer(false)}>
                    Maybe Later
                </button>
            </div>
        </aside>
    );
}
