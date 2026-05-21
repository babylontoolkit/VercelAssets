"use client";

/*
 * =================================================================
 * ES6 React Framework Platform Services
 * =================================================================
 * Cross-platform navigation via React Context injection (A2).
 *
 * The babylon/ folder is router-agnostic. Host apps provide an
 * adapter that wraps their router's hooks and supplies the value
 * to <NavigationProvider>. Works with react-router-dom,
 * @tanstack/react-router, next/navigation, etc.
 * =================================================================
 */

import { createContext, createElement, useContext, ReactNode } from "react";

export interface INavigationState {
    gameMode?: string;
    sceneUrl?: string;
    projectUrl?: string;
    auxiliaryData?: any;
}

export type NavigationState = INavigationState & {
    fromApp?: boolean;
    [key: string]: any;
};

export type UnifiedNavigationOptions = {
    state?: NavigationState;
    replace?: boolean;
};

export type UnifiedNavigateFunction = (
    path: string,
    options?: UnifiedNavigationOptions
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

/**
 * Host apps wrap their tree with <NavigationProvider value={...}>.
 * The value is supplied by a tiny per-host adapter that bridges the
 * host router (react-router-dom, @tanstack/react-router, next, ...)
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