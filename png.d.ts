// png.d.ts — Required by Babylon Toolkit React Framework (Patch 2)
// With disableStaticImages: true, no ambient *.png type exists.
// This ensures PNG imports are typed as string, matching what
// the NormalModuleReplacementPlugin produces at bundle time.
declare module "*.png" {
  const src: string;
  export default src;
}
