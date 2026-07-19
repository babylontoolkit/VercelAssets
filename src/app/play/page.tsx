import { Suspense } from "react";
import { DefaultBabylonPreloader } from "@/custom/loading";
import BabylonSceneViewer from "@/babylon/system/babylon";

export default function Play() {
  return (
    <Suspense fallback={<DefaultBabylonPreloader />}>
      <BabylonSceneViewer fullPage={true} allowQueryParams={true} enableCustomOverlay={true} />
    </Suspense>
  );
}
