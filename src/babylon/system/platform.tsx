"use client";

/*
 * =================================================================
 * ES6 React Framework Platform Services
 * =================================================================
 * Cross-platform navigation via React Context injection (A2).
 *
 * The babylon/ folder is router-agnostic. Host apps provide an
 * adapter that wraps their router's hooks and supplies the value
 * to <NavigationProvider>. Works with react router dom,
 * @tanstack/react-router, next/navigation, etc.
 * =================================================================
 */

import { createContext, createElement, useContext, ReactNode } from "react";

export interface INavigationState {
    gameMode?: string;
    sceneUrl?: string;
    scriptUrl?: string;
    reloadPage?: boolean;
    auxiliaryData?: any;
}

export type NavigationState = INavigationState & {
    [key: string]: any;
};

export type UnifiedNavigationOptions = {
    replace?: boolean;
};

export type UnifiedNavigateFunction = (
    path: string,
    state?: NavigationState
) => void;

export type LocationState = {
  pathname: string;
  search: string;
  state?: NavigationState;
};

export type UnifiedNavigation = {
  navigate: UnifiedNavigateFunction;
  location: LocationState;
};

const NavigationContext = createContext<UnifiedNavigation | null>(null);

// =================================================================
// Navigation State Bridge
// =================================================================
// sessionStorage key used to persist navigation state across
// page reloads in iframe-based environments (e.g. Lovable preview).
// Written by the adapter on every navigation; consumed and
// cleared by the Babylon viewer after it reads gameMode/sceneUrl.
// Never put in the URL — users cannot craft a shareable link.
// =================================================================
export const NAV_STATE_STORE_KEY = "__bt_nav_state";

/** Read persisted nav state from sessionStorage (returns null if absent/unparseable). */
export function readNavStateStore(): NavigationState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(NAV_STATE_STORE_KEY);
    return raw ? (JSON.parse(raw) as NavigationState) : null;
  } catch {
    return null;
  }
}

/** Consume and clear persisted nav state (call after reading in the viewer). */
export function clearNavStateStore(): void {
  if (typeof sessionStorage === "undefined") return;
  try { sessionStorage.removeItem(NAV_STATE_STORE_KEY); } catch { /* ignore */ }
}

/**
 * Host apps wrap their tree with <NavigationProvider value={...}>.
 * The value is supplied by a tiny per-host adapter that bridges the
 * host router (react router dom, @tanstack/react-router, next, ...)
 * to the UnifiedNavigation shape.
 */
export function NavigationProvider({ value, children }: { value: UnifiedNavigation; children?: ReactNode }) {
  return createElement(NavigationContext.Provider, { value }, children);
}

/**
 * Consumer hook used everywhere inside babylon/.
 * Throws if no <NavigationProvider> is mounted above.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useUnifiedNavigation(): UnifiedNavigation {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error(
      "useUnifiedNavigation: missing <NavigationProvider>. " +
      "Wrap your app with a host-specific navigation adapter."
    );
  }
  return ctx;
}