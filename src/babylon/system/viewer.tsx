"use client";

import { useEffect, useRef } from "react";
import { AbstractEngine, Engine, FreeCamera, Nullable, Observer, Scene, Vector3, WebGPUEngine } from "@babylonjs/core";
import { SceneManager } from "@babylonjs-toolkit/next/scenemanager";
import GameManager from "../globals";

const DEFAULT_ENGINE_OPTIONS = {};

export declare type BabylonjsProps = {
  webgpu?: boolean;
  antialias?: boolean;
  legacyAudio?: boolean;
  engineOptions?: any;
  adaptToDeviceRatio?: boolean;
  renderChildrenWhenReady?: boolean;
  sceneOptions?: any;
  onCreateScene: (scene: Scene) => void;
  /**
   * Automatically trigger engine resize when the canvas resizes (default: true)
   */
  observeCanvasResize?: boolean;
  onRender?: (scene: Scene) => void;
  children?: React.ReactNode;
};

function BaseSceneViewer(props: BabylonjsProps & React.CanvasHTMLAttributes<HTMLCanvasElement>) {
  const { webgpu, antialias, legacyAudio, engineOptions = DEFAULT_ENGINE_OPTIONS, adaptToDeviceRatio, sceneOptions, onRender, onCreateScene, ...rest } = props;
  const reactCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
      let disposeRequested = false;
      let engine: AbstractEngine | null = null;
      let scene: Scene | null = null;
      let resizeListener: (() => void) | null = null;
      let readyObserver: Nullable<Observer<Scene>> = null;

// TODO: Handle Audio Engine Unlock in a more robust way that doesn't rely on global state or event listeners, and that works with both legacy and modern audio engines. This is a temporary workaround to ensure audio can be unlocked on user interaction, which is required by many browsers for audio playback to work properly. We should consider implementing a more integrated solution within the Babylon.js engine initialization process in the future.      
// window.prepareBabylonEngineProperties = async () => {
//     // ************************************************************************ //
//     window.audioEngineClicked = false;    
//     window.doAudioEngineClick = async () => {
//         if (window.audioEngineClicked === false) {
//             window.audioEngineClicked = true;
//             document.removeEventListener("click", window.doAudioEngineClick);
//             if (legacyAudio === true) {
//                 if (TOOLKIT.AudioSource.UnlockLegacyAudio) {
//                     TOOLKIT.AudioSource.UnlockLegacyAudio();
//                     // BABYLON.Tools.Warn("Unlocked legacy audio engine");
//                 }
//             } else {
//                 if (TOOLKIT.AudioSource.UnlockAudioEngine) {
//                     await TOOLKIT.AudioSource.UnlockAudioEngine();
//                     // BABYLON.Tools.Warn("Unlocked audio engine context");
//                 }
//             }   
//         }
//     }
//     document.addEventListener("click", window.doAudioEngineClick);
// };

      // Initialize the engine and scene (Note: Strict mode safety)
      const initializeEngineAndScene = async (): Promise<void> => {
          const canvas = reactCanvas.current;
          if (!canvas) return;

          let engineOptionsToUse = engineOptions != null ? { ...engineOptions } : { ...DEFAULT_ENGINE_OPTIONS };
          if (legacyAudio === true) engineOptionsToUse.audioEngine = legacyAudio;

          try {
              if (typeof navigator !== "undefined" && (navigator as any).gpu && webgpu) {
                  try {
                      const webgpuEngine = new WebGPUEngine(canvas, {
                          ...engineOptionsToUse,
                          antialias,
                          adaptToDeviceRatio,
                          setMaximumLimits: true,
                          enableAllFeatures: true,
                      });
                      await webgpuEngine.initAsync(
                          { jsPath: "scripts/glslang.js", wasmPath: "scripts/glslang.wasm" },
                          { jsPath: "scripts/twgsl.js", wasmPath: "scripts/twgsl.wasm" }
                      );

                      if (disposeRequested) {
                          try { webgpuEngine.dispose(); } catch (e) { console.warn(e); }
                          return;
                      }

                      engine = webgpuEngine as unknown as AbstractEngine;
                  } catch (webgpuError) {
                      console.warn("WebGPU initialization failed, falling back to WebGL.", webgpuError);
                      engine = null;
                  }
              }

              if (!engine) {
                  const fallbackEngine = new Engine(canvas, antialias, engineOptionsToUse, adaptToDeviceRatio);

                  if (disposeRequested) {
                      try { fallbackEngine.dispose(); } catch (e) { console.warn(e); }
                      return;
                  }

                  engine = fallbackEngine;
              }
              if (!engine) return;

              scene = new Scene(engine, sceneOptions);
              if (disposeRequested) {
                  try { scene.dispose(); } catch (e) { console.warn(e); }
                  try { engine.dispose(); } catch (e) { console.warn(e); }
                  engine = null;
                  scene = null;
                  return;
              }

              const defaultCamera = new FreeCamera("defaultCamera", new Vector3(0, 5, -10), scene);
              defaultCamera.setTarget(Vector3.Zero());
              scene.activeCamera = defaultCamera;

              const handleSceneReady = (readyScene: Scene): void => {
                  if (!disposeRequested) onCreateScene(readyScene);
              };
              if (scene.isReady()) {
                  handleSceneReady(scene);
              } else {
                  readyObserver = scene.onReadyObservable.add((readyScene) => {
                      if (disposeRequested) return;
                      handleSceneReady(readyScene);
                      if (scene && readyObserver) {
                          try { scene.onReadyObservable.remove(readyObserver); } catch (e) { console.warn(e); }
                          readyObserver = null;
                      }
                  });
              }

              if (disposeRequested) return;
              engine.runRenderLoop(() => {
                  if (disposeRequested || !scene || scene.isDisposed) return;
                  if (typeof onRender === "function") onRender(scene);
                  scene.render();
              });

              resizeListener = () => { if (!disposeRequested && engine) engine.resize(); };
              if (typeof window !== "undefined") window.addEventListener("resize", resizeListener);
          } catch (error) {
              console.error("Failed to initialize Babylon viewer", error);

              if (typeof window !== "undefined" && resizeListener) {
                  try { window.removeEventListener("resize", resizeListener); } catch (e) { console.warn(e); }
                  resizeListener = null;
              }

              if (scene && !scene.isDisposed) {
                  try { scene.dispose(); } catch (e) { console.warn(e); }
              }

              if (engine) {
                  try { engine.dispose(); } catch (e) { console.warn(e); }
              }

              engine = null;
              scene = null;
          }
      };

      initializeEngineAndScene();

      return () => {
          disposeRequested = true;

          if (typeof window !== "undefined" && resizeListener) {
              try { window.removeEventListener("resize", resizeListener); } catch (e) { console.warn(e); }
          }

          if (scene && readyObserver) {
              try { scene.onReadyObservable.remove(readyObserver); } catch (e) { console.warn(e); }
              readyObserver = null;
          }

          if (engine) {
              try { engine.stopRenderLoop(); } catch (e) { console.warn(e); }
              try { SceneManager.HideLoadingScreen(engine, false); } catch (e) { console.warn(e); }
              try { SceneManager.HideSplashScreen(scene); } catch (e) { console.warn(e); }
          }

          // Note: The React navigation hook is owned by ReactRouterNavAdapter (app-wide),
          // so it is intentionally NOT deleted here when the scene viewer unmounts.

          if (scene && !scene.isDisposed) {
              try { scene.dispose(); } catch (e) { console.warn(e); }
          }

          if (engine) {
              try { engine.dispose(); } catch (e) { console.warn(e); }
              engine = null;
          }

          scene = null;
          resizeListener = null;
      };
  }, [webgpu, antialias, legacyAudio, engineOptions, adaptToDeviceRatio, sceneOptions, onRender, onCreateScene]);

  return <canvas ref={reactCanvas} tabIndex={0} {...rest} />;
}

export default BaseSceneViewer;
