"use client";

import { useEffect } from "react";
import { useUnifiedNavigation } from "./platform";

interface ApplicationRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  allowDevMode?: boolean;
}

/**
 * To properly access application routes, the user must navigate from within the app.
 * If they try to access it directly (e.g., via browser URL), they will be redirected.
 * The navigation within the app should set location state { fromApp: true }.
 * Example: navigate('/play', { state: { fromApp: true } });
 * OR
 * @example
 * GameManager.NavigateTo("/play", {
 *     gameMode: "PlayerControllerDemo",
 *     sceneUrl: GameManager.PlaygroundRepo + "samplescene.gltf",
 * });
 */
export default function ApplicationRoute({ children, redirectTo = '/', allowDevMode = false }: ApplicationRouteProps) {
  const { navigate, location } = useUnifiedNavigation();
  const allowByState: boolean = Boolean(location.state?.fromApp);
  // const isDevelopment: boolean = process.env.NODE_ENV === "development";
  // const isRouteAllowed: boolean = allowByState || (allowDevMode && isDevelopment);
  const hasQueryHints = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mode");
  const isRouteAllowed = allowByState || allowDevMode || hasQueryHints;  

  useEffect(() => {
    // If no state was passed (direct browser access), redirect
    if (!isRouteAllowed) {
      navigate(redirectTo, { replace: true });
    }
  }, [isRouteAllowed, navigate, redirectTo]);

  // Only render if accessed from within app
  if (!isRouteAllowed) {
    return null;
  }

  return <>{children}</>;
}
