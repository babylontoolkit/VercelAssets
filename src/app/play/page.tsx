import { Suspense } from "react";
import { DefaultBabylonPreloader } from "@/babylon/custom/loading";
import ApplicationRoute from "@/babylon/system/routing";
import BabylonSceneViewer from "@/babylon/system/babylon";

export default function Play() {
  return (
    <Suspense fallback={<DefaultBabylonPreloader />}>
      <ApplicationRoute allowDevMode={true}>
        <BabylonSceneViewer fullPage={true} allowQueryParams={true} enableCustomOverlay={false} />
      </ApplicationRoute>
    </Suspense>
  );
}
