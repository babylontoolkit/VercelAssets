import { useEffect, type RefObject } from "react";
import type { IContentInstallProgress } from "@babylonjs-toolkit/next";
import { formatGraphicsProgress, isGraphicsProgress } from "./contentGraphics";
import { useContentInstaller } from "./useContentInstaller";

/** The elements progress is written into; any of them may be left out. */
export interface IInstallProgressRefs {
    /** Bar fill: `style.transform = scaleX(fraction)`, quantized to 0.001 (give it `transform-origin: left`). Both steps. */
    barRef?: RefObject<HTMLElement | null>;
    /** Percent text, e.g. "42%". Both steps. */
    percentRef?: RefObject<HTMLElement | null>;
    /** Downloaded and total size, e.g. "215 / 512 MB". Download step only. */
    bytesRef?: RefObject<HTMLElement | null>;
    /** Download speed, e.g. "8.4 MB/s". Download step only. */
    speedRef?: RefObject<HTMLElement | null>;
    /** The Prepare graphics phase line, e.g. "Preparing graphics — 3 of 18". Graphics step only. */
    graphicsRef?: RefObject<HTMLElement | null>;
}

/** Bytes in one megabyte (binary, as the toolkit's loading screens count them). */
const BYTES_PER_MEGABYTE: number = 1024 * 1024;
/** Sizes below this many megabytes show one decimal. */
const ONE_DECIMAL_LIMIT_MEGABYTES: number = 100;
/** The smallest size shown as a number, in megabytes (one decimal). */
const SMALLEST_SHOWN_MEGABYTES: number = 0.1;
/** Sizes above zero below this many bytes (half of 0.1 MB, which toFixed(1) would show as "0.0") read "< 0.1 MB". */
const SMALLEST_SHOWN_BYTES: number = (SMALLEST_SHOWN_MEGABYTES / 2) * BYTES_PER_MEGABYTE;
/** Bar fractions are rounded to thousandths, so tiny changes write nothing. */
const FRACTION_STEPS: number = 1000;
/** Fraction steps per whole percent. */
const STEPS_PER_PERCENT: number = FRACTION_STEPS / 100;

/**
 * Formats a byte count as megabytes: one decimal under 100 MB, none from there ("34.2 MB", "512 MB"); a size above
 * zero that would round to "0.0" reads "< 0.1 MB", so a tiny update never claims to be empty.
 * @param bytes - The byte count.
 * @returns The text with its unit.
 */
export function formatMegabytes(bytes: number): string {
    if (bytes > 0 && bytes < SMALLEST_SHOWN_BYTES) return `< ${SMALLEST_SHOWN_MEGABYTES} MB`;
    return `${formatMegabyteNumber(bytes)} MB`;
}

/**
 * Formats downloaded and total size as one readout ("215 / 512 MB").
 * @param completedBytes - Bytes downloaded.
 * @param totalBytes - Bytes in all.
 * @returns The text with its unit.
 */
export function formatProgressBytes(completedBytes: number, totalBytes: number): string {
    return `${formatMegabyteNumber(completedBytes)} / ${formatMegabytes(totalBytes)}`;
}

/**
 * Writes progress into the given elements on each installer progress event (at most every 250 ms, D20/D25), for both
 * steps of a download: the files, then Prepare graphics (`phase: "graphics"`), which share the bar and the percent.
 * The download step writes the sizes and the speed; the graphics step writes only its phase line ("Preparing graphics —
 * n of N"), so the download readouts keep their last values instead of reading "0 MB".
 * No time-left estimate is shown: it jumps around too much to be useful (user decision, 2026-10-31).
 * Text goes through `textContent`, the bar through `transform: scaleX()`; a value equal to what the element already
 * shows is not written again, and nothing is written while the page is hidden or the element is not in the document.
 * No React state is touched.
 * @param refs - The elements to write.
 */
export function useInstallProgressRefs(refs: IInstallProgressRefs): void {
    const { subscribeProgress } = useContentInstaller();
    const { barRef, percentRef, bytesRef, speedRef, graphicsRef } = refs;

    useEffect(() => {
        return subscribeProgress((progress: IContentInstallProgress) => {
            if (document.hidden) return;
            // Whole steps keep the comparison exact: 0.29 never turns into 28.999 %.
            const fractionSteps: number = Math.round(Math.min(1, Math.max(0, progress.fraction)) * FRACTION_STEPS);
            writeTransform(barRef?.current, `scaleX(${fractionSteps / FRACTION_STEPS})`);
            writeText(percentRef?.current, `${Math.floor(fractionSteps / STEPS_PER_PERCENT)}%`);
            if (isGraphicsProgress(progress)) {
                writeText(graphicsRef?.current, formatGraphicsProgress(progress));
                return;
            }
            writeText(bytesRef?.current, formatProgressBytes(progress.completedBytes, progress.totalBytes));
            writeText(speedRef?.current, `${(progress.bytesPerSecond / BYTES_PER_MEGABYTE).toFixed(1)} MB/s`);
        });
    }, [subscribeProgress, barRef, percentRef, bytesRef, speedRef, graphicsRef]);
}

/**
 * Formats a byte count as a megabyte number without its unit.
 * @param bytes - The byte count.
 * @returns "34.2" under 100 MB, "512" from there.
 */
function formatMegabyteNumber(bytes: number): string {
    const megabytes: number = Math.max(0, bytes) / BYTES_PER_MEGABYTE;
    return megabytes < ONE_DECIMAL_LIMIT_MEGABYTES ? megabytes.toFixed(1) : megabytes.toFixed(0);
}

/**
 * Sets an element's text when it differs from what it shows.
 * @param element - The element, or null/undefined when not mounted.
 * @param text - The text.
 */
function writeText(element: HTMLElement | null | undefined, text: string): void {
    if (element == null || !element.isConnected || element.textContent === text) return;
    element.textContent = text;
}

/**
 * Sets an element's transform when it differs from its current inline transform.
 * @param element - The element, or null/undefined when not mounted.
 * @param transform - The transform.
 */
function writeTransform(element: HTMLElement | null | undefined, transform: string): void {
    if (element == null || !element.isConnected || element.style.transform === transform) return;
    element.style.transform = transform;
}
