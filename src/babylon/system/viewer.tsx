"use client";

import { useEffect, useRef } from "react";
import GameManager from "../globals";

// Note: BABYLON (babylonjs) and TOOLKIT (babylonjs-toolkit) are UMD globals
// resolved via the "types" array in tsconfig.app.json. The loading screen is
// already bundled in the babylonjs UMD distribution, so no side-effect import.

const DEFAULT_ENGINE_OPTIONS = {};

export declare type BabylonjsProps = {
  webgpu?: boolean;
  antialias?: boolean;
  engineOptions?: any;
  adaptToDeviceRatio?: boolean;
  renderChildrenWhenReady?: boolean;
  sceneOptions?: any;
  onCreateScene: (scene: BABYLON.Scene) => void;
  /**
   * Automatically trigger engine resize when the canvas resizes (default: true)
   */
  observeCanvasResize?: boolean;
  onRender?: (scene: BABYLON.Scene) => void;
  children?: React.ReactNode;
};

function BaseSceneViewer(props: BabylonjsProps & React.CanvasHTMLAttributes<HTMLCanvasElement>) {
  const { webgpu, antialias, engineOptions = DEFAULT_ENGINE_OPTIONS, adaptToDeviceRatio, sceneOptions, onRender, onCreateScene, ...rest } = props;
  const reactCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
      let disposeRequested = false;
      let engine: BABYLON.AbstractEngine | null = null;
      let scene: BABYLON.Scene | null = null;
      let resizeListener: (() => void) | null = null;
      let readyObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

      // Initialize the engine and scene (Note: Strict mode safety)
      const initializeEngineAndScene = async (): Promise<void> => {
          const canvas = reactCanvas.current;
          if (!canvas) return;

          try {
              if (typeof navigator !== "undefined" && (navigator as any).gpu && webgpu) {
                  try {
                      const webgpuEngine = new BABYLON.WebGPUEngine(canvas, {
                          ...engineOptions,
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

                      engine = webgpuEngine as unknown as BABYLON.AbstractEngine;
                  } catch (webgpuError) {
                      console.warn("WebGPU initialization failed, falling back to WebGL.", webgpuError);
                      engine = null;
                  }
              }

              if (!engine) {
                  const fallbackEngine = new BABYLON.Engine(canvas, antialias, engineOptions, adaptToDeviceRatio);

                  if (disposeRequested) {
                      try { fallbackEngine.dispose(); } catch (e) { console.warn(e); }
                      return;
                  }

                  engine = fallbackEngine;
              }
              if (!engine) return;

              scene = new BABYLON.Scene(engine, sceneOptions);
              if (disposeRequested) {
                  try { scene.dispose(); } catch (e) { console.warn(e); }
                  try { engine.dispose(); } catch (e) { console.warn(e); }
                  engine = null;
                  scene = null;
                  return;
              }

              const defaultCamera = new BABYLON.FreeCamera("defaultCamera", new BABYLON.Vector3(0, 5, -10), scene);
              defaultCamera.setTarget(BABYLON.Vector3.Zero());
              scene.activeCamera = defaultCamera;

              const handleSceneReady = (readyScene: BABYLON.Scene): void => {
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
              try { TOOLKIT.SceneManager.HideLoadingScreen(engine, false); } catch (e) { console.warn(e); }
              try { TOOLKIT.SceneManager.HideSplashScreen(scene); } catch (e) { console.warn(e); }
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
  }, [webgpu, antialias, engineOptions, adaptToDeviceRatio, sceneOptions, onRender, onCreateScene]);

  return <canvas ref={reactCanvas} tabIndex={0} {...rest} />;
}

export default BaseSceneViewer;
