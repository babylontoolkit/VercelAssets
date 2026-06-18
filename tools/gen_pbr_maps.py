#!/usr/bin/env python3
"""
gen_pbr_maps.py — General-purpose PBR map generator.

Derives a full, pixel-perfect PBR texture set from a single albedo / base-color
image using standard image-processing techniques. Every map is computed UNIFORMLY
across the whole image (no region masks, no color-zone guessing), so the output
always lines up 1:1 with the albedo — no grainy corners, no smooth patches.

Outputs (named to match the input, with the albedo suffix stripped):
    <name>_Normal.png           Tangent-space normal map (OpenGL/Unity by default)
    <name>_Roughness.png        Linear roughness (greyscale)
    <name>_Metallic.png         Metallic mask (greyscale)
    <name>_AO.png               Ambient occlusion / cavity (greyscale)
    <name>_Height.png           Height/displacement (greyscale)
    <name>_MetallicSmooth.png   Unity Built-in packed: RGB=Metallic, A=Smoothness

Industry conventions used:
  * Normal map  : heightmap (luminance) -> Sobel gradients -> normalized XYZ,
                  packed to RGB. OpenGL green-up by default (Unity's convention).
                  Use --directx to flip the green channel.
  * Roughness   : luminance-derived with adjustable contrast; --invert-roughness
                  flips the bright<->smooth relationship per material type.
  * Metallic    : default fully non-metal (0). Optional 'saturation' heuristic
                  treats desaturated mid/bright pixels as metal.
  * AO / cavity : difference between blurred height and height (local cavities),
                  combined with large-scale occlusion.
  * MetallicSmooth (Unity Standard shader): R channel = Metallic, A = Smoothness
                  (Smoothness = 1 - Roughness). RGB are set equal to metallic so
                  the texture reads as a normal greyscale image in any viewer.

Usage:
    python3 tools/gen_pbr_maps.py <albedo_image> [output_dir] [options]

Common options:
    --normal-strength FLOAT     Normal bump intensity            (default 2.5)
    --directx                   Output DirectX-style normals (flip green)
    --invert-roughness          Bright albedo => rougher (default: brighter=smoother)
    --roughness-min FLOAT       Clamp floor for roughness 0..1   (default 0.15)
    --roughness-max FLOAT       Clamp ceil  for roughness 0..1   (default 0.95)
    --roughness-contrast FLOAT  Contrast applied to roughness    (default 1.0)
    --metallic-mode MODE        none | saturation                (default none)
    --metallic-value FLOAT      Constant metallic when mode=none (default 0.0)
    --ao-strength FLOAT         AO darkening amount 0..1          (default 0.6)
    --no-height                 Skip writing the height map

Examples:
    python3 tools/gen_pbr_maps.py textures/Platform_v3C_Albedo.png
    python3 tools/gen_pbr_maps.py textures/Metal_Albedo.png textures/ \\
        --metallic-mode saturation --invert-roughness --normal-strength 3
"""

import os
import sys
import argparse
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, sobel


# ── Helpers ────────────────────────────────────────────────────────────────

def srgb_to_linear(c):
    """Convert sRGB [0,1] to linear light."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def normalize01(x):
    """Stretch an array to the full 0..1 range."""
    lo, hi = float(x.min()), float(x.max())
    if hi - lo < 1e-8:
        return np.zeros_like(x)
    return (x - lo) / (hi - lo)


def apply_contrast(x, contrast, pivot=0.5):
    """Apply linear contrast around a pivot, clamped to 0..1."""
    return np.clip((x - pivot) * contrast + pivot, 0.0, 1.0)


def save_gray(arr01, path):
    Image.fromarray((np.clip(arr01, 0, 1) * 255).astype(np.uint8)).save(path)


def save_rgb(arr01, path):
    Image.fromarray((np.clip(arr01, 0, 1) * 255).astype(np.uint8)).save(path)


# ── Argument parsing ───────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Generate a pixel-perfect PBR map set from an albedo image.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("albedo", help="Path to the albedo / base-color image.")
    p.add_argument("output_dir", nargs="?", default=None,
                   help="Output directory (default: same folder as the albedo).")
    p.add_argument("--normal-strength", type=float, default=2.5)
    p.add_argument("--directx", action="store_true",
                   help="Output DirectX-style normals (flip green channel).")
    p.add_argument("--invert-roughness", action="store_true",
                   help="Bright albedo => rougher (default: brighter => smoother).")
    p.add_argument("--roughness-min", type=float, default=0.15)
    p.add_argument("--roughness-max", type=float, default=0.95)
    p.add_argument("--roughness-contrast", type=float, default=1.0)
    p.add_argument("--metallic-mode", choices=["none", "saturation"], default="none")
    p.add_argument("--metallic-value", type=float, default=0.0,
                   help="Constant metallic value when --metallic-mode none.")
    p.add_argument("--ao-strength", type=float, default=0.6)
    p.add_argument("--no-height", action="store_true")
    return p.parse_args()


# ── Map generators ─────────────────────────────────────────────────────────

def make_height(lum_linear, W, H):
    """
    Height proxy from linear luminance. We keep BOTH the broad tonal shape and
    the fine detail, but lightly denoise so single-pixel albedo noise doesn't
    become harsh spikes. Processed uniformly over the whole image.
    """
    # Tiny denoise (sub-pixel scale relative to resolution) — uniform everywhere
    denoise_sigma = max(W, H) * 0.0004  # ~1.6px at 4K
    h = gaussian_filter(lum_linear.astype(np.float32), sigma=denoise_sigma)
    return normalize01(h)


def make_normal(height, strength, directx, W, H):
    """
    Standard heightmap -> normal map.
    N = normalize(-dH/dx, -dH/dy, 1/strength), packed to RGB.
    OpenGL convention (green up) by default; DirectX flips green.
    """
    gx = sobel(height, axis=1, mode="reflect")
    gy = sobel(height, axis=0, mode="reflect")

    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(height)

    if not directx:
        # OpenGL / Unity: green points up. Image rows increase downward, so flip Y.
        ny = -ny

    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx /= length
    ny /= length
    nz /= length

    rgb = np.stack([nx, ny, nz], axis=2) * 0.5 + 0.5
    return rgb


def make_roughness(lum_linear, invert, rmin, rmax, contrast):
    """
    Roughness derived from luminance. Default: brighter => smoother (lower
    roughness), which suits most painted/coated/metal surfaces. Uniform.
    """
    base = normalize01(lum_linear)
    rough = base if invert else (1.0 - base)
    if contrast != 1.0:
        rough = apply_contrast(rough, contrast)
    return np.clip(rough, 0.0, 1.0) * (rmax - rmin) + rmin


def make_metallic(rgb_linear, lum_linear, mode, const_value):
    """
    Metallic mask. 'none' => constant. 'saturation' => desaturated, reasonably
    bright pixels are treated as metal (a common albedo heuristic). Uniform.
    """
    H, W = lum_linear.shape
    if mode == "none":
        return np.full((H, W), np.clip(const_value, 0.0, 1.0), dtype=np.float32)

    r, g, b = rgb_linear[..., 0], rgb_linear[..., 1], rgb_linear[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)

    # Low saturation + enough brightness -> metallic
    metal = (1.0 - np.clip(sat / 0.25, 0, 1)) * np.clip(lum_linear / 0.25, 0, 1)
    return np.clip(metal, 0.0, 1.0)


def make_ao(height, strength, W, H):
    """
    Ambient occlusion / cavity map. Cavities = areas sitting below their local
    neighbourhood average. Combine a fine cavity pass and a broad occlusion pass.
    Uniform across the whole image.
    """
    fine_sigma = max(W, H) * 0.004    # local cavity detail
    broad_sigma = max(W, H) * 0.02    # large-scale occlusion

    fine = gaussian_filter(height, sigma=fine_sigma) - height
    broad = gaussian_filter(height, sigma=broad_sigma) - height

    cavity = normalize01(np.clip(fine, 0, None))
    occ = normalize01(np.clip(broad, 0, None))

    shadow = np.clip(cavity * 0.7 + occ * 0.3, 0, 1)
    ao = 1.0 - shadow * np.clip(strength, 0, 1)
    return np.clip(ao, 0.0, 1.0)


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    if not os.path.isfile(args.albedo):
        print(f"Error: file not found: {args.albedo}")
        sys.exit(1)

    out_dir = args.output_dir or os.path.dirname(os.path.abspath(args.albedo))
    os.makedirs(out_dir, exist_ok=True)

    base = os.path.splitext(os.path.basename(args.albedo))[0]
    for suffix in ("_Albedo", "_albedo", "_BaseColor", "_basecolor",
                   "_Diffuse", "_diffuse", "_Color", "_color"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break

    print(f"Source : {args.albedo}")
    print(f"Base   : {base}")
    print(f"Output : {out_dir}/")

    img = Image.open(args.albedo).convert("RGB")
    W, H = img.size
    print(f"Size   : {W} x {H}")

    srgb = np.asarray(img, dtype=np.float32) / 255.0
    linear = srgb_to_linear(srgb)
    lum_linear = (0.2126 * linear[..., 0] +
                  0.7152 * linear[..., 1] +
                  0.0722 * linear[..., 2])

    # Height (shared by normal + AO so they stay perfectly consistent)
    print("Building height...")
    height = make_height(lum_linear, W, H)

    print("Generating Normal map...")
    normal = make_normal(height, args.normal_strength, args.directx, W, H)
    save_rgb(normal, os.path.join(out_dir, f"{base}_Normal.png"))

    print("Generating Roughness map...")
    roughness = make_roughness(lum_linear, args.invert_roughness,
                               args.roughness_min, args.roughness_max,
                               args.roughness_contrast)
    save_gray(roughness, os.path.join(out_dir, f"{base}_Roughness.png"))

    print("Generating Metallic map...")
    metallic = make_metallic(linear, lum_linear, args.metallic_mode,
                             args.metallic_value)
    save_gray(metallic, os.path.join(out_dir, f"{base}_Metallic.png"))

    print("Generating AO map...")
    ao = make_ao(height, args.ao_strength, W, H)
    save_gray(ao, os.path.join(out_dir, f"{base}_AO.png"))

    if not args.no_height:
        print("Generating Height map...")
        save_gray(height, os.path.join(out_dir, f"{base}_Height.png"))

    print("Generating Unity MetallicSmooth (R=Metallic, A=Smoothness)...")
    smoothness = 1.0 - roughness
    m8 = (np.clip(metallic, 0, 1) * 255).astype(np.uint8)
    a8 = (np.clip(smoothness, 0, 1) * 255).astype(np.uint8)
    packed = np.stack([m8, m8, m8, a8], axis=2)  # RGB=metallic (greyscale look)
    Image.fromarray(packed, mode="RGBA").save(
        os.path.join(out_dir, f"{base}_MetallicSmooth.png"))

    print("\nDone! Files written:")
    names = [f"{base}_Normal.png", f"{base}_Roughness.png",
             f"{base}_Metallic.png", f"{base}_AO.png",
             f"{base}_MetallicSmooth.png"]
    if not args.no_height:
        names.insert(4, f"{base}_Height.png")
    for n in names:
        p = os.path.join(out_dir, n)
        im = Image.open(p)
        print(f"  {n}  {im.size[0]}x{im.size[1]}  ({im.mode})")


if __name__ == "__main__":
    main()
