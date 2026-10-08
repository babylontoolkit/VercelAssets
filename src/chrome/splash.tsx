"use client";

import { useEffect, useState } from "react";
import { babylonLogo, spinnerLogo } from "./loading";
import GameManager from "../babylon/globals";
import { SceneManager } from "@babylonjs-toolkit/next/scenemanager";
import "./splash.css";

type AssetProgressMessage = {
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

/** Scene loader status from the toolkit runtime (SceneManager.OnLoaderStatusObservable): asset preloader counts, terrain build stages, splash status text. */
type LoaderStatus = {
  status: string | null;
  details: string | null;
  progress: number | null;
  state: number;
};

/** "LOADING TERRAIN TEXTURES" → "Loading terrain textures" (the runtime posts the engine.html loader's upper case). */
const toSentenceCase = (text: string): string => {
  if (text == null || text === "" || text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

function SplashScreen() {
  const logoSrc = babylonLogo;
  const spinnerSrc = spinnerLogo;
  const [statusText, setStatusText] = useState<string>("Loading Scene ...");
  const [detailsText, setDetailsText] = useState<string>("");
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    // the toolkit's own scene build stages (BUILDING SCENE NN%, SETTING UP SCENE) take over the status line and bar once the
    // scene file has downloaded, instead of the download percent sitting at 100% (runtime 9.29+)
    (SceneManager as any).HostDefersSceneStatus = true;
    let loaderState: number = -1;
    // 1. the scene file download (glTF + bin), posted by the scene viewer and GameManager.PostProgressStatus - until the toolkit
    // posts its own stages (a loader state from 1 on): later download events would overwrite them
    const onLoadProgress = (data: AssetProgressMessage) => {
      if (data == null || loaderState >= 1) return;
      if (data.message != null) setStatusText(data.message);
      const percent = data.overallPercent ?? data.percent;
      if (typeof percent === "number" && isFinite(percent)) setProgress(Math.max(0, Math.min(1, percent / 100)));
    };
    GameManager.EventBus.OnMessage<AssetProgressMessage>("OnLoadProgress", onLoadProgress);
    // 2. the toolkit asset preloader that runs after the download: terrains, skins, probes, audio (runtime 9.29+)
    // terrain stages and asset counts report their own fractions while the preloader runs: the bar only moves forward
    // within one loading state and starts over when the state changes
    const loaderStatus: any = (SceneManager as any).OnLoaderStatusObservable;
    const observer: any = (loaderStatus != null) ? loaderStatus.add((data: LoaderStatus) => {
      if (data == null) return;
      if (data.status != null && data.status !== "") setStatusText(toSentenceCase(data.status));
      if (data.details != null) setDetailsText(toSentenceCase(data.details));
      if (typeof data.progress === "number" && isFinite(data.progress)) {
        const value = Math.max(0, Math.min(1, data.progress));
        const restart = (data.state !== loaderState);
        loaderState = data.state;
        setProgress((previous) => (restart || previous == null) ? value : Math.max(previous, value));
      }
    }) : null;
    return () => {
      GameManager.EventBus.RemoveHandler("OnLoadProgress", onLoadProgress);
      if (loaderStatus != null && observer != null) loaderStatus.remove(observer);
    };
  }, []);

  const percent: number | null = (progress != null) ? Math.round(progress * 100) : null;
  return (
    <div className="splash" id="xbabylonjsSplashScreen">
      <div
        id="xbabylonjsLoadingDiv"
        style={{
          backgroundColor: "#2A2342",
          pointerEvents: "none",
          display: "grid",
          gridTemplateRows: "100%",
          gridTemplateColumns: "100%",
          justifyItems: "center",
          alignItems: "center",
          zIndex: 10001,
          position: "absolute",
          inset: 0,
        }}
      >
        <div
          id="xbabylonjsStatusTextDiv"
          style={{
            position: "absolute",
            right: "18px",
            bottom: "12px",
            fontFamily: "Arial",
            fontSize: "12px",
            color: "white",
            textAlign: "right",
            zIndex: 2,
            opacity: 0.9,
            letterSpacing: "0.3px",
          }}
        >
         {detailsText}
        </div>
        <div
          id="xbabylonjsLoadingTextDiv"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          aria-valuetext={statusText}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            marginTop: "180px",
            transform: "translateX(-50%)",
            width: "min(320px, calc(100% - 32px))",
            fontFamily: "Arial",
            fontSize: "14px",
            color: "white",
            textAlign: "center",
            zIndex: 1,
          }}
        >
          <div style={{ minHeight: "18px", marginBottom: "10px", letterSpacing: "0.3px" }}>{statusText}</div>
          <div className="splash-progress">
            <div
              className={(percent == null) ? "splash-progress-fill splash-progress-indeterminate" : "splash-progress-fill"}
              style={(percent == null) ? undefined : { width: percent + "%" }}
            />
          </div>
        </div>
        <img
          id="xbabylonjsLoadingImage"
          src={logoSrc}
          alt="Babylon loading logo"
          style={{
            width: "150px",
            gridColumn: 1,
            gridRow: 1,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            position: "absolute",
          }}
        />
        <div
          style={{
            width: "320px",
            height: "320px",
            gridColumn: 1,
            gridRow: 1,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            position: "absolute",
            display: "grid",
            placeItems: "center",
          }}
        >
          <img
            id="xbabylonjsLoadingSpinner"
            src={spinnerSrc}
            alt="Babylon loading spinner"
            style={{
              width: "320px",
              height: "320px",
              animation: "spin1 0.75s infinite linear",
              transformOrigin: "50% 50%",
              willChange: "transform", // Note: own compositor layer from the first frame, so the spin never waits on the main thread
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default SplashScreen;
