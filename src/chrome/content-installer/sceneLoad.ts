import { loadContentInstallerNow, type ContentInstallerClass } from "./ContentInstallerProvider";

/**
 * Prepares the content installer for a scene load (D22): applies an accepted update, pins this page's version and puts
 * the scene's group first. When an enabled provider is mounted but has not loaded the installer yet (a direct visit
 * to the play route), it loads it now instead of waiting for idle. Imported only by `babylon.tsx`, never by Home.
 * @param sceneUrl - The scene file's URL.
 * @returns True when the scene's files are all on this device; false at once when the layer is disabled or failed.
 */
export async function prepareContentSceneLoad(sceneUrl: string): Promise<boolean> {
    const installer: ContentInstallerClass | null = await loadContentInstallerNow();
    if (installer == null) return false;
    try {
        return await installer.PrepareSceneLoad(sceneUrl);
    } catch {
        return false;
    }
}
