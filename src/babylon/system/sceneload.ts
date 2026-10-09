import { useEffect, useState } from "react";
import { SceneManager, SceneChange } from "@babylonjs-toolkit/next/scenemanager";
import { readNavStateStore, useUnifiedNavigation } from "./platform";

/** The event-bus message the toolkit posts when a scene asks for another scene (TOOLKIT.SceneChange.MessageName). */
const SCENE_LOAD_MESSAGE = "SceneLoad";

/** The play route the scene viewer is mounted on. */
const PLAY_ROUTE_PATH = "/play";

/**
 * The fields of a `SceneLoad` message that the host reads: the toolkit's full message (TOOLKIT.ISceneLoadMessage), or a
 * bare `{ scene }` posted by any same-origin page, resolved against the scene now on /play.
 */
interface SceneLoadRequest {
    /** Absolute URL of the destination scene file (the toolkit's message). */
    sceneUrl?: string;
    /** The destination scene file, relative to the current scene's folder or absolute (a bare request). */
    scene?: string;
    /** The destination's display name, for a splash screen that shows one. */
    title?: string;
    /** A CSS colour for a splash screen that tints itself, such as the colour on screen at the hand-off. */
    color?: string;
    /** Game mode class for the destination, or null to keep the current one. */
    gameMode?: string | null;
}

/**
 * The absolute destination URL of a request: its `sceneUrl`, else its `scene` resolved against the current scene URL.
 * @param request The message data.
 * @param currentSceneUrl The scene URL now on /play, if any.
 * @returns The destination URL, or null when the request names none.
 */
function resolveSceneUrl(request: SceneLoadRequest, currentSceneUrl: string | undefined): string | null {
    if (typeof request.sceneUrl === "string" && request.sceneUrl !== "") return request.sceneUrl;
    if (typeof request.scene !== "string" || request.scene === "") return null;
    return new URL(request.scene, new URL(currentSceneUrl || "./", window.location.href)).href;
}

/**
 * Handles `SceneLoad` requests on the /play route: navigates to /play with the destination scene (same-origin messages
 * only, never a page reload) and returns a generation number that keys the scene viewer, so the viewer remounts and
 * loads the destination like any scene, behind the splash screen. The request's title and colour go into the
 * navigation state as `splashTitle` and `splashColor` for a splash screen that uses them.
 * While mounted, it tells the toolkit that the host handles scene change requests.
 * @returns The generation; it starts at 0 and increases by one for each accepted request.
 */
export function useSceneLoadRequests(): number {
    const { navigate } = useUnifiedNavigation();
    const [generation, setGeneration] = useState<number>(0);
    useEffect(() => {
        /**
         * Accepts a same-origin `SceneLoad` request: routes to /play with the destination scene and bumps the generation.
         * @param request The message data posted by the toolkit.
         * @param event The window message event, used for the origin check.
         */
        const handleRequest = (request: SceneLoadRequest, event?: MessageEvent): void => {
            if (event == null || event.origin !== window.location.origin) return;
            if (request == null) return;
            const currentNavState = readNavStateStore();
            const sceneUrl = resolveSceneUrl(request, currentNavState?.sceneUrl);
            if (sceneUrl == null) return;
            navigate(PLAY_ROUTE_PATH, {
                gameMode: request.gameMode ?? currentNavState?.gameMode,
                sceneUrl: sceneUrl,
                scriptUrl: currentNavState?.scriptUrl,
                reloadPage: false,
                splashTitle: request.title ?? "",
                splashColor: request.color ?? "",
            });
            setGeneration((previousGeneration: number) => previousGeneration + 1);
        };
        SceneChange.HostHandlesRequests = true;
        SceneManager.EventBus.OnMessage<SceneLoadRequest>(SCENE_LOAD_MESSAGE, handleRequest);
        return () => {
            SceneManager.EventBus.RemoveHandler(SCENE_LOAD_MESSAGE, handleRequest);
            SceneChange.HostHandlesRequests = false;
        };
    }, [navigate]);
    return generation;
}
