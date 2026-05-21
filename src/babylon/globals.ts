"use client";

// Global Side Effects
import "babylonjs";
import "babylonjs-gui";
import "babylonjs-addons";
import "babylonjs-loaders";
import "babylonjs-materials";
import "babylonjs-toolkit";

import { INavigationState, UnifiedNavigateFunction, UnifiedNavigationOptions } from "./system/platform";

// Single typed alias for the runtime globals declared in globals.d.ts.
// Avoids sprinkling `(globalThis as any)` casts throughout the file.
const G = globalThis as unknown as {
  HAVOKPHYSCIS_JS: any;
  SCRIPTBUNDLE_JS: any;
  HK: any;
  HKP: any;
  HavokPhysics: () => Promise<any>;
};

class GameManager {
    /** Initialize the game runtime environment */
    public static async InitializeRuntime(scene:BABYLON.Scene, scriptBundle:string, enablePhysics:boolean = true, showLoadingScreen:boolean = true, hideEngineLoadingUI:boolean = false): Promise<void> {
        if (scene.isDisposed) return; // Note: Strict mode safety
        await TOOLKIT.SceneManager.InitializeRuntime(scene.getEngine(), { showDefaultLoadingScreen: showLoadingScreen, hideLoadingUIWithEngine: hideEngineLoadingUI });
        // Note: The physics engine is loaded globally on the first scene initialization that requests it, and is not re-loaded for subsequent scenes to optimize load times. If physics is enabled but fails to load, the game will continue running without physics and log an error.
        if (enablePhysics == true) {
            G.HAVOKPHYSCIS_JS = G.HAVOKPHYSCIS_JS || await BABYLON.Tools.LoadScriptAsync(GameManager.HavokEngineUrl);
        }
        // Load Project-specific script bundle if provided (e.g. for custom scene scripts, gameplay logic, etc.)
        let projectScriptBundle = scriptBundle;
        if (projectScriptBundle == null || projectScriptBundle.length == 0) {
            // Default script bundle URL (can be overridden by providing a scriptBundle parameter)
            projectScriptBundle = GameManager.PlaygroundRepo + "default.playground.js";
        }
        if (projectScriptBundle != null && projectScriptBundle.toLowerCase() === "default.playground.js") {
            projectScriptBundle = GameManager.PlaygroundRepo + "default.playground.js";
        }
        if (projectScriptBundle != null && projectScriptBundle.length > 0) {
            G.SCRIPTBUNDLE_JS = G.SCRIPTBUNDLE_JS || await BABYLON.Tools.LoadScriptAsync(projectScriptBundle);
        }
        await import("./classes/DefaultGameMode");
        await import("./classes/FreeCameraMode");
        await import("./classes/PlayerControllerDemo");
        await import("./classes/PlaygroundDemoScene");
        await import("./classes/VehicleControllerDemo");
        if (scene.isDisposed) return; // Note: Strict mode safety
        // Havok is only loaded once globally AFTER SceneManager.InitializeRuntime
        if (enablePhysics)
        {
            if (G.HK == null || G.HKP == null)
            {
                G.HK = await G.HavokPhysics();
                G.HKP = new BABYLON.HavokPlugin(false);
            }
            if (!scene.isDisposed && G.HK != null && G.HKP != null)
            {
                scene.enablePhysics(new BABYLON.Vector3(0,-9.81,0), G.HKP);
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
    *     sceneUrl: GameManager.PlaygroundRepo + "samplescene.gltf",
    *     projectUrl: GameManager.PlaygroundRepo + "default.playground.js",
    * });
     */
    public static NavigateTo(route: string, state: INavigationState | null = null): void {
        //////////////////////////////////////////////////////////////////////////////////////////////////////              
        // Cross Platform Router Navigation (React, Next.js, Gatsby, etc.)
        // Requires Unified Navigation Adapter to be setup in host project.
        //////////////////////////////////////////////////////////////////////////////////////////////////////              
        if (GameManager.ReactNavigationFunction != null) {
            const navOptions: UnifiedNavigationOptions = {
                state: {
                    ...(state ?? {}),
                    fromApp: true,
                },
            };
            GameManager.ReactNavigationFunction(route, navOptions);
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
    /** Deletes the React router navigation hook on the game manager to prevent memory leaks and unintended navigation after scene disposal.
     */
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
    private static _SynchronousMessageBus: TOOLKIT.LocalMessageBus | null = null;
    /** Synchronous event message bus 
     * @examples 
     * // Handle myevent message
     * GameManager.EventBus.OnMessage("myevent", (data:string) => {
     *    console.log("My Event Data: " + data);
     * });
     * // Post myevent message
     * GameManager.EventBus.PostMessage("myevent", "Hello World!");
    */
    public static get EventBus(): TOOLKIT.LocalMessageBus {
        if (GameManager._SynchronousMessageBus == null) GameManager._SynchronousMessageBus = new TOOLKIT.LocalMessageBus();
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
    // Development Properties
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /** URL of the playground repository (https://repo.babylontoolkit.com/playground/) */
    public static get PlaygroundRepo(): string { return "https://repo.babylontoolkit.com/playground/"; }

    /** Indicates if the game is running in development mode */
    public static get IsDevelopmentMode(): boolean { return process.env.NODE_ENV === "development"; }

    /** URL of the Havok physics engine script */
    public static HavokEngineUrl: string = "scripts/havok.js";
}
export enum StorageType { Local = 0, Session = 1 }

export default GameManager;