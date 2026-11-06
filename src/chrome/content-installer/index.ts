/**
 * The React content installer layer (pwa-content-installer D25): provider, hooks, the Download Game Data panel (its
 * download and Prepare graphics steps), update toast and the installed-app offer. Nothing here imports Babylon or the
 * toolkit with a value import, so Home can use it freely; the installer is loaded by the provider with `import()`, and
 * the toolkit's scene module only when Prepare graphics runs. `sceneLoad.ts` is not re-exported: only `babylon.tsx`
 * imports it.
 */
import "./content-installer.css";

export {
    createContentInstallerOptions,
    DEFAULT_PRIMING_ENGINE_OPTIONS,
    isStandaloneLaunch,
    rememberInstallOfferAnswered,
    shouldOfferInstall,
    type ContentInstallPolicyOption,
    type ContentUpdatePolicyOption,
    type IContentInstallerHostOptions,
    type IContentPrimingEngineOptions,
    type IContentScenePreparer,
    type IContentScriptPaths,
} from "./contentInstallerConfig";
export {
    DOWNLOADED_AND_PREPARED_TEXT,
    formatGraphicsProgress,
    GRAPHICS_NEEDED_TEXT,
    isDownloadedAndPrepared,
    isGraphicsProgress,
    PREPARE_GRAPHICS_LABEL,
    PREPARING_GRAPHICS_TEXT,
    readContentGraphics,
    shouldOfferPrepareGraphics,
    type IContentGraphicsProgressFields,
    type IContentGraphicsStateFields,
    type IContentGraphicsSummary,
} from "./contentGraphics";
export {
    ContentInstallerProvider,
    getLoadedContentInstaller,
    isContentInstallerMounted,
    loadContentInstallerNow,
    type ContentInstallerClass,
    type IContentInstallerProviderProps,
} from "./ContentInstallerProvider";
export {
    ContentInstallerContext,
    useContentInstaller,
    type IContentInstallActionOptions,
    type IContentInstallerActions,
    type IContentInstallerContextValue,
} from "./useContentInstaller";
export { formatMegabytes, formatProgressBytes, useInstallProgressRefs, type IInstallProgressRefs } from "./useInstallProgressRefs";
export { ContentInstallPanel, type IContentInstallPanelProps } from "./ContentInstallPanel";
export { ContentUpdateToast, type IContentUpdateToastProps } from "./ContentUpdateToast";
export { ContentInstallOffer, type IContentInstallOfferProps } from "./ContentInstallOffer";
