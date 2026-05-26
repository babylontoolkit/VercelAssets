'use client';

/*
 * =================================================================
 * Host Navigation Adapter - Next.js (App Router)
 * =================================================================
 * Bridges next/navigation hooks into the babylon toolkit's
 * UnifiedNavigation context.
 *
 * Note: Next.js App Router does not support history state natively
 * the way react-router-dom does. To preserve the { fromApp, ... }
 * NavigationState shape, this adapter writes state to sessionStorage
 * via the shared NAV_STATE_STORE_KEY (defined in platform.tsx) so
 * that ApplicationRoute and BabylonSceneViewer can read it with
 * readNavStateStore() regardless of which adapter is in use.
 * =================================================================
 */

import { createElement, ReactNode, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavigationProvider, UnifiedNavigateFunction, LocationState, NAV_STATE_STORE_KEY, readNavStateStore } from "../babylon/system/platform";
import GameManager from "../babylon/globals";

export function NextNavAdapter({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const navigate: UnifiedNavigateFunction = useCallback(
    (path, options) => {
      // Bridge: persist fromApp state to sessionStorage so it survives Next.js
      // App Router transitions (which don't support history state natively).
      // Uses the shared NAV_STATE_STORE_KEY so ApplicationRoute and
      // BabylonSceneViewer can read it with readNavStateStore().
      if (options?.state?.fromApp) {
        try { sessionStorage.setItem(NAV_STATE_STORE_KEY, JSON.stringify(options.state)); } catch { /* ignore */ }
      }
      if (options?.replace) {
        router.replace(path);
      } else {
        router.push(path);
      }
    },
    [router]
  );

  // Note: Register the navigation hook globally so GameManager.NavigateTo works on
  // every page, even before the Babylon runtime has initialized. NextNavAdapter
  // wraps the whole app (in app/layout) and already owns the navigate function.
  useEffect(() => {
    GameManager.SetReactNavigationHook(navigate);
    return () => GameManager.DeleteReactNavigationHook();
  }, [navigate]);

  const search = useMemo(() => {
    const s = searchParams?.toString() ?? "";
    return s ? `?${s}` : "";
  }, [searchParams]);

  const location: LocationState = useMemo(
    () => ({
      pathname,
      search,
      state: readNavStateStore(),
    }),
    [pathname, search]
  );

  const value = useMemo(() => ({ navigate, location }), [navigate, location]);

  return createElement(NavigationProvider, { value }, children);
}
