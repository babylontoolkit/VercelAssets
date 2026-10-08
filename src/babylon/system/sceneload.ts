import { useEffect, useState } from "react";
import { SceneManager, SceneChange } from "@babylonjs-toolkit/next/scenemanager";
import { readNavStateStore, useUnifiedNavigation } from "./platform";

/** The event-bus message the toolkit posts when a scene asks for another scene (TOOLKIT.SceneChange.MessageName). */
const SCENE_LOAD_MESSAGE = "SceneLoad";

/** The play route the scene viewer is mounted on. */
const PLAY_ROUTE_PATH = "/play";

/** The fields of the toolkit's `SceneLoad` message data (TOOLKIT.ISceneLoadMessage) that the host reads. */
interface SceneLoadRequest {
    /** Absolute URL of the destination scene file. */
    sceneUrl: string;
    /** Game mode class for the destination, or null to keep the current one. */
    gameMode: string | null;
}

/**
 * Handles toolkit `SceneLoad` requests on the /play route: navigates to /play with the destination `sceneUrl`
 * (same-origin messages only, never a page reload) and returns a generation number that keys the scene viewer,
 * so the viewer remounts and loads the destination under the toolkit's transition overlay.
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
            if (request == null || typeof request.sceneUrl !== "string") return;
            const currentNavState = readNavStateStore();
            navigate(PLAY_ROUTE_PATH, {
                gameMode: request.gameMode ?? currentNavState?.gameMode,
                sceneUrl: request.sceneUrl,
                scriptUrl: currentNavState?.scriptUrl,
                reloadPage: false,
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
