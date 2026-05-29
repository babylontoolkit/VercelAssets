'use client';

/*
 * =================================================================
 * Host Navigation Adapter - Next.js (App Router)
 * =================================================================
 * Bridges next/navigation hooks into the babylon toolkit's
 * UnifiedNavigation context.
 *
 * Note: Next.js App Router does not support history state natively
 * the way react-router-dom does. To preserve the NavigationState shape,
 * this adapter writes state to sessionStorage via the shared NAV_STATE_STORE_KEY
 * (defined in platform.tsx) so that BabylonSceneViewer can read it with
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
    (path, state) => {
      // Bridge: persist state to sessionStorage so it survives Next.js
      // App Router transitions (which don't support history state natively).
      // Uses the shared NAV_STATE_STORE_KEY so BabylonSceneViewer can read it with readNavStateStore().
      if (state) {
        // Strip reload flag from stored state so it doesn't re-trigger on restore.
        const { reloadPage, ...storedState } = state;
        try { sessionStorage.setItem(NAV_STATE_STORE_KEY, JSON.stringify(storedState)); } catch { /* ignore */ }
        // Force a full DOM reload to release all resources from the previous page
        // and give the new scene a fresh slate.
        if (reloadPage) {
          window.location.href = path;
          return;
        }
      }
      router.push(path);
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
