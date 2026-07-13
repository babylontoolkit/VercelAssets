"use client";

// SSR-safe, router-agnostic mount point for the Babylon Toolkit scene.
//
// All Babylon imports are deferred behind React.lazy so the heavy 3D engine
// and the `BABYLON` / `TOOLKIT` UMD globals are only touched in the browser,
// after this component mounts. Use this from any host (BrowserRouter,
// TanStack Start, Next.js App Router, Remix) instead of importing
// `./system/babylon` directly from a route file.
//
// Hosts that run their own router (BrowserRouter, MemoryRouter) should pass
// `wrapWithReactRouterAdapter={false}` and provide their own adapter (see
// `src/routing/router.tsx` for the reference adapter pattern).
//
// In SSR frameworks:
//   - Next.js (App Router):
//       const BabylonMount = dynamic(() => import('@/babylon/mount'), { ssr: false });
//   - TanStack Start (route file):
//       export const Route = createFileRoute('/play')({ ssr: false, ... });
//   - Plain BrowserRouter SPA:
//       <BabylonMount /> works as-is.

import { lazy, Suspense, type ReactNode } from "react";
import { DefaultBabylonPreloader } from "./custom/loading";

const InnerScene = lazy(async () => {
  const { default: BabylonSceneViewer } = await import("./system/babylon");
  return {
    default: ({
      fullPage = true,
      allowQueryParams = true,
      enableCustomOverlay = false,
    }: SceneProps) => (
      <BabylonSceneViewer
        fullPage={fullPage}
        allowQueryParams={allowQueryParams}
        enableCustomOverlay={enableCustomOverlay}
      />
    ),
  };
});

export type SceneProps = {
  fullPage?: boolean;
  allowQueryParams?: boolean;
  enableCustomOverlay?: boolean;
};

export type BabylonMountProps = SceneProps & {
  fallback?: ReactNode;
};

export default function BabylonMount({ fallback, ...sceneProps }: BabylonMountProps) {
  return (
    <Suspense fallback={fallback ?? <DefaultBabylonPreloader />}>
      <InnerScene {...sceneProps} />
    </Suspense>
  );
}
