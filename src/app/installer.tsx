'use client';

/*
 * =================================================================
 * Content Installer Host - Next.js (App Router)
 * =================================================================
 * Mounts the content installer layer (src/chrome/content-installer)
 * around every route from the root layout, which is a server
 * component: the provider, its update toast and its installed-app
 * offer use browser APIs, so they live behind this client boundary.
 * The installer module itself loads with import() once the page is
 * idle, so no page loads Babylon code for it first.
 * =================================================================
 */

import type { ReactElement, ReactNode } from "react";
import { ContentInstallerProvider, ContentInstallOffer, ContentUpdateToast } from "@/chrome/content-installer";
import { CONTENT_INSTALLER_OPTIONS } from "@/config/contentInstaller";

/** Props of ContentInstallerHost. */
interface IContentInstallerHostProps {
  /** The app. */
  children: ReactNode;
}

/**
 * Wraps the app in the content installer (off unless NEXT_PUBLIC_CONTENT_INSTALLER=on) and renders its update toast
 * and installed-app offer beside the app.
 * @param props - The app.
 * @returns The app inside the installer context.
 */
export function ContentInstallerHost(props: IContentInstallerHostProps): ReactElement {
  return (
    <ContentInstallerProvider options={CONTENT_INSTALLER_OPTIONS}>
      {props.children}
      <ContentUpdateToast />
      <ContentInstallOffer />
    </ContentInstallerProvider>
  );
}
