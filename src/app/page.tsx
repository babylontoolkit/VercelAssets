'use client';

import Image from "next/image";
import { useRef, useState } from "react";
import { useUnifiedNavigation } from "@/babylon/system/platform";
import { ContentInstallPanel, useContentInstaller } from "@/chrome/content-installer";

/** The look of Home's secondary buttons, shared by the Download button. */
const SECONDARY_BUTTON_CLASS_NAME = "flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]";

export default function Home() {
  const { navigate } = useUnifiedNavigation();
  const { state: installerState } = useContentInstaller();
  const downloadDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isDownloadDialogOpen, setDownloadDialogOpen] = useState<boolean>(false);
  // The Download button appears only while the content installer runs (NEXT_PUBLIC_CONTENT_INSTALLER=on and supported here).
  const showDownloadControls: boolean = installerState != null && installerState.availability !== "disabled";
  const downloadButtonLabel: string = installerState?.everythingInstalled === true ? "Downloaded ✓" : "Download";

  /** Opens the Download Game Data dialog as a modal (Escape closes it). */
  const openDownloadDialog = (): void => {
    downloadDialogRef.current?.showModal();
    setDownloadDialogOpen(true);
  };
  /** Closes the Download Game Data dialog (a running download keeps going). */
  const closeDownloadDialog = (): void => {
    downloadDialogRef.current?.close();
  };
  const handlePlayDemo = () => {
    navigate('/play', {
      gameMode: 'PlayerControllerDemo',
      sceneUrl: 'https://repo.babylontoolkit.com/playground/samplescene.gz.gltf',
      reloadPage: (process.env.NODE_ENV !== "development") // Note: In development mode, we want to preserve the state of hot-reloading, so we won't reload the page. In production, we can reload to ensure a clean state.
    });
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[188px]"
            href="https://www.babylontoolkit.com/documentation"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/babylon.png"
              alt="Babylon logomark"
              width={16}
              height={16}
            />
            Getting Started
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://babylontoolkit.github.io/repo"
            target="_blank"
            rel="noopener noreferrer"
          >
            Asset Library
          </a>
          <button
            className={SECONDARY_BUTTON_CLASS_NAME}
            type="button"
            onClick={handlePlayDemo}
          >
            Play Demo
          </button>
        </div>
        {showDownloadControls && (
          <section className="flex w-full flex-col gap-4 text-base font-medium sm:flex-row" aria-label="Game data">
            <button className={SECONDARY_BUTTON_CLASS_NAME} type="button" aria-haspopup="dialog" onClick={openDownloadDialog}>
              {downloadButtonLabel}
            </button>
            <dialog
              className="m-auto w-[min(540px,calc(100vw-32px))] rounded-2xl border border-solid border-black/[.08] bg-white p-6 text-left text-base font-normal text-zinc-600 shadow-xl backdrop:bg-black/50 dark:border-white/[.145] dark:bg-black dark:text-zinc-400"
              aria-label="Download Game Data"
              ref={downloadDialogRef}
              onClose={() => setDownloadDialogOpen(false)}
            >
              {isDownloadDialogOpen && <ContentInstallPanel onClose={closeDownloadDialog} />}
            </dialog>
          </section>
        )}
      </main>
    </div>
  );
}
