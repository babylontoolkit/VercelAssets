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
 * NavigationState shape, this adapter stashes state in
 * sessionStorage keyed by pathname and rehydrates it on read.
 * =================================================================
 */

import { createElement, ReactNode, useCallback, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { NavigationProvider, UnifiedNavigateFunction, LocationState, NavigationState } from "../babylon/system/platform";
import GameManager from "../babylon/globals";

const STATE_KEY_PREFIX = "babylon-nav-state:";

function writeState(path: string, state: NavigationState | undefined) {
  if (typeof window === "undefined") return;
  try {
    const key = STATE_KEY_PREFIX + path.split("?")[0];
    if (state) {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function readState(path: string): NavigationState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY_PREFIX + path);
    return raw ? (JSON.parse(raw) as NavigationState) : undefined;
  } catch {
    return undefined;
  }
}

export function NextNavAdapter({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const navigate: UnifiedNavigateFunction = useCallback(
    (path, options) => {
      writeState(path, options?.state);
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
      state: readState(pathname),
    }),
    [pathname, search]
  );

  const value = useMemo(() => ({ navigate, location }), [navigate, location]);

  return createElement(NavigationProvider, { value }, children);
}
