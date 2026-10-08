"use client";

import { Suspense } from "react";
import { DefaultBabylonPreloader } from "@/chrome/loading";
import BabylonSceneViewer from "@/babylon/system/babylon";
import { useSceneLoadRequests } from "@/babylon/system/sceneload";

/**
 * The /play page: mounts the Babylon scene viewer and remounts it (new key) for every toolkit `SceneLoad` request,
 * so a scene change loads the destination without a page reload.
 */
export default function Play() {
  const generation = useSceneLoadRequests();
  return (
    <Suspense fallback={<DefaultBabylonPreloader />}>
      <BabylonSceneViewer key={generation} fullPage={true} allowQueryParams={true} enableCustomOverlay={true} />
    </Suspense>
  );
}
