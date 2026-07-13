"use client";

import { Scene, Tools, Vector3 } from "@babylonjs/core";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";
import { SceneManager } from "@babylonjs-toolkit/next/scenemanager";
import { LocalMessageBus } from "@babylonjs-toolkit/next/localmessagebus";

// =============================================================================================
// Side effects — register extended packages into BabylonJS at import time
// =============================================================================================
import "@babylonjs/materials";
import "@babylonjs/loaders";
import "@babylonjs/gui";
import "@babylonjs/havok";
import "@babylonjs/addons";
import "@babylonjs/serializers";
// =============================================================================================

import { INavigationState, UnifiedNavigateFunction } from "./system/platform";

// Single typed alias for the runtime globals declared in project.d.ts.
// Avoids sprinkling `(globalThis as any)` casts throughout the file.
const G = globalThis as unknown as {
  HAVOKPHYSICS_JS: any;
  SCRIPTBUNDLE_JS: any;
  HK: any;
  HKP: any;
  HavokPhysics: () => Promise<any>;
};

class GameManager {
    /** Initialize the game runtime environment */
    public static async InitializeRuntime(scene:Scene, scriptBundle:string, enablePhysics:boolean = true, showLoadingScreen:boolean = true, hideEngineLoadingUI:boolean = false): Promise<void> {
        if (scene.isDisposed) return; // Note: Strict mode safety
        await SceneManager.InitializeRuntime(scene.getEngine(), { showDefaultLoadingScreen: showLoadingScreen, hideLoadingUIWithEngine: hideEngineLoadingUI });
        // Note: Support legacy project script bundle loading for backwards compatibility.
        if (scriptBundle != null && scriptBundle.length > 0) {
            G.SCRIPTBUNDLE_JS = G.SCRIPTBUNDLE_JS || await Tools.LoadScriptAsync(scriptBundle);
        }
        await import("./classes/DefaultGameMode");
        await import("./classes/FreeCameraMode");
        await import("./classes/PlayerControllerDemo");
        await import("./classes/PlaygroundDemoScene");
        await import("./classes/VehicleControllerDemo");
        if (scene.isDisposed) return; // Note: Strict mode safety
        if (enablePhysics)
        {
            if (G.HK == null || G.HKP == null)
            {
                // @ts-ignore - This initializes fresh physics for this scene
                G.HK = await HavokPhysics({ locateFile: (file: string) => { if (file.endsWith(".wasm")) { return "scripts/havok.wasm"; } return file; }, });
                G.HKP = new HavokPlugin(false);
            }
            if (!scene.isDisposed && G.HK != null && G.HKP != null)
            {
                scene.enablePhysics(new Vector3(0,-9.81,0), G.HKP);
            }
            const cleanupGlobals = () =>
            {
                if (G.HKP) delete G.HKP;
                if (G.HK) delete G.HK;
            };
            if (!scene.isDisposed)
            {
                scene.onDisposeObservable.addOnce(cleanupGlobals);
            }
            else
            {
                cleanupGlobals(); // Note: Force clean up if scene was disposed already
            }
        }        
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Global Navigation State
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    private static ReactNavigationFunction: UnifiedNavigateFunction | null = null;
    /**
     * Executes a cross-platform navigation to the specified route.
     * @param route The route path to navigate to.
     * @param state Optional navigation state to pass to the destination route.
     *
     * @example
    * GameManager.NavigateTo("/play", {
    *     gameMode: "PlayerControllerDemo",
    *     sceneUrl: GameManager.PlaygroundRepo + "samplescene.gz.gltf",
    * });
     */
    public static NavigateTo(route: string, state: INavigationState | null = null): void {
        //////////////////////////////////////////////////////////////////////////////////////////////////////              
        // Cross Platform Router Navigation (React, Next.js, Gatsby, etc.)
        // Requires Unified Navigation Adapter to be setup in host project.
        //////////////////////////////////////////////////////////////////////////////////////////////////////              
        if (GameManager.ReactNavigationFunction != null) {
            GameManager.ReactNavigationFunction(route, state ?? undefined);
        } else {
            console.warn("React navigation hook is not set on the game manager.");
        }
    }
    /** Checks if the React router navigation hook is set on the game manager.
     * @returns True if the React navigation hook is set, false otherwise.
     */
    public static HasReactNavigationHook(): boolean {
        return GameManager.ReactNavigationFunction != null;
    }
    /** Sets the React router navigation hook on the game manager for in-game navigation from scenes and UI components.
     * @param navigateToFunction The react router navigate function.
     */
    public static SetReactNavigationHook(navigateToFunction: UnifiedNavigateFunction | null): void {
        GameManager.ReactNavigationFunction = navigateToFunction;
    }
    /** Deletes the React router navigation hook on the game manager to prevent memory leaks and unintended navigation after scene disposal. */
    public static DeleteReactNavigationHook(): void {
        if (GameManager.ReactNavigationFunction != null) {
            GameManager.ReactNavigationFunction = null;
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Global Game State
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    private static _GlobalState: any = {};
    /** Global game state */
    public static get GlobalState(): any { return GameManager._GlobalState; }
    /** Load global game state from storage */
    public static LoadGameState(storage:StorageType): void {
        if (storage === StorageType.Local) {
            const savedState = localStorage.getItem("GlobalGameState");
            if (savedState) GameManager._GlobalState = JSON.parse(savedState);
        } else if (storage === StorageType.Session) {
            const savedState = sessionStorage.getItem("GlobalGameState");
            if (savedState) GameManager._GlobalState = JSON.parse(savedState);
        }
    }
    /** Save global game state to storage */
    public static SaveGameState(storage:StorageType): void {
        if (storage === StorageType.Local) {
            localStorage.setItem("GlobalGameState", JSON.stringify(GameManager._GlobalState));
        } else if (storage === StorageType.Session) {
            sessionStorage.setItem("GlobalGameState", JSON.stringify(GameManager._GlobalState));
        }
    }
    /** Reset global game state */
    public static ResetGameState(): void {
        GameManager._GlobalState = {};
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Synchronous Message Bus
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    private static _SynchronousMessageBus: LocalMessageBus | null = null;
    /** Synchronous event message bus 
     * @examples 
     * // Handle myevent message
     * GameManager.EventBus.OnMessage("myevent", (data:string) => {
     *    console.log("My Event Data: " + data);
     * });
     * // Post myevent message
     * GameManager.EventBus.PostMessage("myevent", "Hello World!");
    */
    public static get EventBus(): LocalMessageBus {
        if (GameManager._SynchronousMessageBus == null) GameManager._SynchronousMessageBus = new LocalMessageBus();
        return GameManager._SynchronousMessageBus;
    }
    /** Post system loading progress status message */
    public static PostProgressStatus(status:string): void {
        try {
            GameManager.EventBus.PostMessage("OnLoadProgress", { message: status });
        }
        catch (error) {
            console.error("Error posting progress status:", error);
        }
    }   

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Generic Global Properties
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /** URL of the playground repository (https://repo.babylontoolkit.com/playground/) */
    public static get PlaygroundRepo(): string { return "https://repo.babylontoolkit.com/playground/"; }

    /** Indicates if the game is running in development mode */
    public static get IsDevelopmentMode(): boolean { return process.env.NODE_ENV === "development"; }
}
export enum StorageType { Local = 0, Session = 1 }

export default GameManager;