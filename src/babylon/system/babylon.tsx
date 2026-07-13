"use client";

import { useCallback } from "react";
import { useUnifiedNavigation, readNavStateStore } from "./platform";
import BaseSceneViewer from "./viewer";
import CustomOverlay from "../custom/overlay";
import SplashScreen from "../custom/splash";
import GameManager from "../globals";
import { SceneManager, ScriptComponent, Utilities } from "@babylonjs-toolkit/next/scenemanager";
import { ImportMeshAsync, ISceneLoaderProgressEvent, Scene, Tools, TransformNode } from "@babylonjs/core";

import "./babylon.css";

export declare type SceneViewerProps = {
  fullPage?: boolean;
  gameMode?: string;
  sceneUrl?: string;
  scriptUrl?: string;
  auxiliaryData?: any;
  allowQueryParams?: boolean;
  enableCustomOverlay?: boolean;
};

export declare type AssetProgressMessage = {
  assetName?: string;
  fileName?: string;
  rootPath?: string;
  sceneFile?: string;
  loadedBytes?: number;
  totalBytes?: number;
  percent?: number;
  aggregateLoadedBytes?: number;
  aggregateTotalBytes?: number;
  aggregatePercent?: number;
  completedAssets?: number;
  totalAssets?: number;
  overallPercent?: number;
  dependencyUrl?: string;
  message?: string;
};

/**
 * UMD Interactive Babylon Toolkit Scene Viewer (GLTF)
 */
function BabylonSceneViewer(props: SceneViewerProps & React.CanvasHTMLAttributes<HTMLCanvasElement>) {
  const { fullPage, gameMode, sceneUrl, scriptUrl, auxiliaryData, allowQueryParams, enableCustomOverlay  } = props;
  const { location } = useUnifiedNavigation();
  const createScene = useCallback(async (scene:Scene) => {
    if (scene.isDisposed) return; // Note: Strict mode safety
    let disposed = false;
    let disposeObserver = scene.onDisposeObservable.add(() => { disposed = true; });
    let rootPath: string | null = sceneUrl != null && sceneUrl !== "" ? sceneUrl.substring(0, sceneUrl.lastIndexOf("/") + 1) : null;
    let sceneFile: string | null = sceneUrl != null && sceneUrl !== "" ? sceneUrl.substring(sceneUrl.lastIndexOf("/") + 1) : null;
    let sceneController: ScriptComponent = null;
    let gameModeAuxiliaryData:any | undefined = auxiliaryData;
    let gameModeReadyInvoked: boolean = false;
    let gameProjectScriptBundle: string = scriptUrl || null;
    // Resolve nav state once: location.state is the normal SPA path; sessionStorage
    // is the iframe-reload fallback. Data is never in the URL.
    const _resolvedNavState = (location?.state?.gameMode || location?.state?.sceneUrl || location?.state?.auxiliaryData || location?.state?.scriptUrl)
        ? location.state
        : readNavStateStore();
    if (allowQueryParams === true) {
        gameProjectScriptBundle = _resolvedNavState?.scriptUrl || gameProjectScriptBundle;
    }
    const invokeGameModeReady = async (): Promise<void> => {
      if (gameModeReadyInvoked || disposed || scene.isDisposed) return;
      if (sceneController != null) {
        if (sceneController["preCreateScene"] != null && typeof sceneController["preCreateScene"] === "function") {
          gameModeReadyInvoked = true;
          await sceneController["preCreateScene"](gameModeAuxiliaryData);
        }
      }
    };
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // STEP 1 - Initialize the global runtime scene properties and react navigation system
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    try {
      SceneManager.ShowSplashScreen(); // Note: Always Show Game Manager Splash Screen
      await GameManager.InitializeRuntime(scene, gameProjectScriptBundle, true, false, false);
      if (disposed || scene.isDisposed) return; // Note: Strict mode safety
      ////////////////////////////////////////////////////////////////////////////////////////////////////////
      // STEP 2 - Load the babylon scene assets (GLTF) using the toolkit assets manager
      ////////////////////////////////////////////////////////////////////////////////////////////////////////
      let isDevelopment: boolean = process.env.NODE_ENV === "development";
      let defaultPageUrl: URL = new URL(window.location.href.replace("#?", "?"));
      let babylonGameMode:string | undefined = gameMode || "DefaultGameMode";
      if (allowQueryParams === true) {
        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Unified Navigation Adapter Support (React Router, Next.js, Remix, etc.)
        // Uses _resolvedNavState which prefers location.state and falls back to
        // sessionStorage so state survives iframe reloads (e.g. Lovable preview).
        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        babylonGameMode = _resolvedNavState?.gameMode || babylonGameMode;
        let locSceneUrl = _resolvedNavState?.sceneUrl || null;
        if (locSceneUrl != null && locSceneUrl !== "") {
          rootPath = locSceneUrl.substring(0, locSceneUrl.lastIndexOf("/") + 1);
          sceneFile = locSceneUrl.substring(locSceneUrl.lastIndexOf("/") + 1);
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        gameModeAuxiliaryData = _resolvedNavState?.auxiliaryData || gameModeAuxiliaryData;
        ////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (isDevelopment === true) { // Note: Unity Editor Development Preview Query Param Support
          // babylonGameMode = defaultPageUrl.searchParams.get("mode") || babylonGameMode;
          // let devSceneUrl = defaultPageUrl.searchParams.get("scene") || null;
          // if (devSceneUrl != null && devSceneUrl !== "") {
          //   rootPath = devSceneUrl.substring(0, devSceneUrl.lastIndexOf("/") + 1);
          //   sceneFile = devSceneUrl.substring(devSceneUrl.lastIndexOf("/") + 1);
          // }
          babylonGameMode = defaultPageUrl.searchParams.get("mode") || babylonGameMode;
          const qpSceneUrl = defaultPageUrl.searchParams.get("scene");
          if (qpSceneUrl) {
            rootPath = qpSceneUrl.substring(0, qpSceneUrl.lastIndexOf("/") + 1);
            sceneFile = qpSceneUrl.substring(qpSceneUrl.lastIndexOf("/") + 1);
          }
          const qpScriptUrl = defaultPageUrl.searchParams.get("script");
          if (qpScriptUrl) gameProjectScriptBundle = qpScriptUrl;
        }
      }
      let babylonRootPath: string = rootPath || GameManager.PlaygroundRepo; // Note: Default to AWS Playground Repo
      let babylonSceneFile: string = sceneFile || "_blank";
      // Instantiate Game Mode Script Component Before Loading Assets (Set Auxiliary Data As Script Component Property Bag)
      if (babylonGameMode != null && babylonGameMode !== "") {
        const ScriptComponentClass = Utilities.InstantiateClass(babylonGameMode);
        if (ScriptComponentClass != null) {
            sceneController = new ScriptComponentClass(new TransformNode("GameMode", scene), scene, {});
            if (sceneController != null) {
              SceneManager.AttachScriptComponent(sceneController, babylonGameMode, false);
            } else {
              Tools.Warn("Failed to instantiate script class: " + babylonGameMode);
            }
        } else {
            Tools.Warn("Failed to locate script class: " + babylonGameMode);
        }
      }
      // Validate blank scene file case (Allow blank scene file names and bail out early if detected. This allows the scene to be loaded without assets.
      if (babylonSceneFile == null || babylonSceneFile === "" || (babylonSceneFile != null && (babylonSceneFile.toLowerCase() === "_blank" || babylonSceneFile.toLowerCase() === "blank") || babylonSceneFile.toLowerCase() === "none")) {
        await invokeGameModeReady();
        return; // Note: Bail Out Early
      }
      // Load base scene with granular progress fallback: percent → MB → static text.
      const formatMb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(0);
      const postAssetMessage = (messageName: string, data: AssetProgressMessage): void => { GameManager.EventBus.PostMessage(messageName, data); };
      // Post initial load start.
      postAssetMessage("OnLoadProgress", {
        assetName: babylonSceneFile,
        fileName: babylonSceneFile,
        rootPath: babylonRootPath,
        sceneFile: babylonSceneFile,
        completedAssets: 0,
        totalAssets: 1,
        overallPercent: 0,
        message: "Loading Scene ..."
      });
      await ImportMeshAsync(babylonSceneFile, scene, {
        meshNames: null,
        rootUrl: babylonRootPath,
        onProgress: (event: ISceneLoaderProgressEvent) => {
          let percent: number | undefined;
          let message: string;
          if (event.lengthComputable && event.total > 0) {
            // Best: granular percent 0–100
            percent = (event.loaded / event.total) * 100;
            message = `Loading Scene ${percent.toFixed(0)}%`;
          } else if (event.loaded > 0) {
            // Second best: MB downloaded
            message = `Loading Scene ${formatMb(event.loaded)} MB`;
          } else {
            // Fallback: static text
            message = "Loading Scene ...";
          }
          postAssetMessage("OnLoadProgress", {
            assetName: babylonSceneFile,
            fileName: babylonSceneFile,
            rootPath: babylonRootPath,
            sceneFile: babylonSceneFile,
            loadedBytes: event.loaded,
            totalBytes: event.lengthComputable ? event.total : undefined,
            percent,
            completedAssets: 0,
            totalAssets: 1,
            overallPercent: percent,
            message
          });
        },
        pluginOptions: {
          gltf: {
            preprocessUrlAsync: async (url: string) => {
              postAssetMessage("OnAssetDependency", {
                assetName: babylonSceneFile,
                fileName: babylonSceneFile,
                rootPath: babylonRootPath,
                sceneFile: babylonSceneFile,
                dependencyUrl: url,
                completedAssets: 0,
                totalAssets: 1,
                message: `Dependency: ${url}`
              });
              return url;
            }
          }
        }
      });
      // Post scene load completion messages.
      postAssetMessage("OnAssetComplete", {
        assetName: babylonSceneFile,
        fileName: babylonSceneFile,
        rootPath: babylonRootPath,
        sceneFile: babylonSceneFile,
        completedAssets: 1,
        totalAssets: 1,
        message: `Completed ${babylonSceneFile}`
      });
      postAssetMessage("OnLoadComplete", {
        assetName: babylonSceneFile,
        fileName: babylonSceneFile,
        rootPath: babylonRootPath,
        sceneFile: babylonSceneFile,
        completedAssets: 1,
        totalAssets: 1,
        overallPercent: 100,
        message: `Load complete: ${babylonSceneFile}`
      });
      if (disposed || scene.isDisposed) return; // Note: Strict mode safety
    } catch (error) {
      console.error("Failed to load babylon scene assets", error);
    } finally {
      /////////////////////////////////////////////////////////////////////////////////////////////////////
      // STEP 3 - Finalize scene setup after assets are loaded and hide the loading screen
      /////////////////////////////////////////////////////////////////////////////////////////////////////
      try {
        await invokeGameModeReady();
      } catch (e) {
        console.error("Failed to initialize game mode", e);
      }
      try {
        if (!disposed && !scene.isDisposed && disposeObserver) {
          scene.onDisposeObservable.remove(disposeObserver);
        }
      } catch (e) {
        console.error("Failed to remove dispose observer", e);
      }
    }
  }, [gameMode, sceneUrl, scriptUrl, auxiliaryData, allowQueryParams, location]);

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////
  // OPTIONAL: Add custom loading div over the root div and disable the default loading screen
  ///////////////////////////////////////////////////////////////////////////////////////////////////////////
  return (
    <div className={fullPage ? "page-viewer" : "div-viewer"}>
      <SplashScreen />
      <BaseSceneViewer webgpu={true} antialias={true} legacyAudio={true} adaptToDeviceRatio={true} onCreateScene={createScene} className="canvas" />
      {props.enableCustomOverlay && <CustomOverlay />}
    </div>
  );
}

export default BabylonSceneViewer;
