# gen_pbr_maps (Albedo → PBR texture set)

A zero-config, general-purpose Python script that derives a full, **pixel-perfect
PBR texture set** from a single albedo / base-color image. Every map is computed
**uniformly across the whole image** (no region masks, no color-zone guessing), so
the output always lines up 1:1 with the albedo — no grainy corners, no smooth
patches, no layout drift.

Built for the **Unity Standard material** (Built-in render pipeline) but the
individual maps are standard and work in any PBR engine (URP, HDRP, Unreal,
Babylon, glTF, Blender, etc.).

## Files

| File | Purpose |
|------|---------|
| `tools/gen_pbr_maps.py` | The generator script (requires `numpy`, `pillow`, `scipy`). |

## Setup

The script depends on three common Python packages:

```bash
pip3 install numpy pillow scipy
```

No API key, no MCP server, no config files. It runs directly with `python3`.

## Usage

Ask the assistant in plain language, e.g.:

> Run gen_pbr_maps on `textures/Platform_v3C_Albedo.png`.

…or run it yourself from the project root:

```bash
python3 tools/gen_pbr_maps.py <albedo_image> [output_dir] [options]
```

- `albedo_image` — path to the source albedo / base-color image (required).
- `output_dir` — where to write the maps (optional; defaults to the same folder
  as the albedo).

The output base name is derived from the input filename with the albedo suffix
stripped. Recognized suffixes (case-insensitive): `_Albedo`, `_BaseColor`,
`_Diffuse`, `_Color`. For example `Platform_v3C_Albedo.png` → `Platform_v3C_*`.

### Examples

```bash
# Simplest: writes maps next to the albedo
python3 tools/gen_pbr_maps.py textures/Platform_v3C_Albedo.png

# Explicit output folder
python3 tools/gen_pbr_maps.py textures/Platform_v3C_Albedo.png textures/

# A shiny metal surface: detect metal from color + stronger relief
python3 tools/gen_pbr_maps.py textures/Metal_Albedo.png \
    --metallic-mode saturation --normal-strength 3

# See every option
python3 tools/gen_pbr_maps.py --help
```

## Output maps

| File | Channels | Description |
|------|----------|-------------|
| `<name>_Normal.png` | RGB | Tangent-space normal map. OpenGL/Unity green-up by default. |
| `<name>_Roughness.png` | Greyscale | Linear roughness (0 = mirror, 1 = matte). |
| `<name>_Metallic.png` | Greyscale | Metallic mask (0 = dielectric, 1 = metal). |
| `<name>_AO.png` | Greyscale | Ambient occlusion / cavity (white = lit, black = occluded). |
| `<name>_Height.png` | Greyscale | Height / displacement (also used for parallax). |
| `<name>_MetallicSmooth.png` | RGBA | **Unity Standard** packed map — see below. |

## Options

| Flag | Default | Notes |
|------|---------|-------|
| `--normal-strength FLOAT` | `2.5` | Normal bump intensity. Higher = deeper relief. |
| `--directx` | off | Output DirectX-style normals (flips the green channel). |
| `--invert-roughness` | off | Bright albedo ⇒ rougher. Default is brighter ⇒ smoother. |
| `--roughness-min FLOAT` | `0.15` | Clamp floor for roughness (0..1). |
| `--roughness-max FLOAT` | `0.95` | Clamp ceiling for roughness (0..1). |
| `--roughness-contrast FLOAT` | `1.0` | Contrast applied to the roughness curve. |
| `--metallic-mode MODE` | `none` | `none` (constant) or `saturation` (detect metal from color). |
| `--metallic-value FLOAT` | `0.0` | Constant metallic value when `--metallic-mode none`. |
| `--ao-strength FLOAT` | `0.6` | AO darkening amount (0..1). |
| `--no-height` | off | Skip writing the height map. |

## How it works

All maps are derived from the albedo using standard image-processing math,
applied identically to every pixel:

1. **sRGB → linear** conversion, then **Rec.709 luminance** is computed as a
   height proxy.
2. **Height** — lightly denoised luminance (resolution-relative), normalized to
   0..1. Shared by the Normal and AO passes so they stay perfectly consistent.
3. **Normal** — Sobel gradients of the height map → `normalize(-dH/dx, -dH/dy, 1)`,
   packed to RGB. Green-up (OpenGL/Unity) by default; `--directx` flips green.
4. **Roughness** — luminance-driven curve with optional invert/contrast and a
   min/max clamp.
5. **Metallic** — constant by default, or a saturation/brightness heuristic that
   flags desaturated bright pixels as metal (`--metallic-mode saturation`).
6. **AO / cavity** — combines a fine local-cavity pass and a broad large-scale
   occlusion pass (difference of Gaussian-blurred height vs height).

Because there are **no hardcoded color zones**, the script generalizes to any
albedo and the maps never disagree with the source layout.

## Using the maps in Unity (Built-in / Standard shader)

The Unity Standard shader packs metallic + smoothness into a single texture:

- **R channel** = Metallic
- **A channel** = Smoothness (`1 - Roughness`)
- G and B are unused (this script sets RGB equal to metallic so the file still
  previews as a normal greyscale image).

Assign the maps as follows:

| Standard material slot | Texture | Import setting |
|------------------------|---------|----------------|
| **Albedo** | `<name>_Albedo.png` | sRGB ✓ |
| **Metallic** | `<name>_MetallicSmooth.png` | sRGB ✗; Smoothness source = **Metallic Alpha** |
| **Normal Map** | `<name>_Normal.png` | Texture Type = **Normal map** |
| **Occlusion** | `<name>_AO.png` | sRGB ✗ |
| **Height Map** (optional) | `<name>_Height.png` | sRGB ✗ |

> The script outputs **OpenGL** normals (green-up), which is Unity's convention —
> import as a Normal map without flipping. If you target an engine that expects
> DirectX normals, regenerate with `--directx`.

For separate `_Metallic.png` and `_Roughness.png` (URP/HDRP, Unreal, glTF,
Babylon, etc.), use those files directly and ignore the packed `MetallicSmooth`.

## Notes

- Output resolution **always matches the input** exactly (pixel-perfect 1:1 UVs).
- Greyscale maps (Roughness, Metallic, AO, Height) are linear data — disable
  sRGB/gamma on import.
- Re-running overwrites existing maps for the same base name.
- For best results, feed a clean albedo with **no baked lighting or shadows**.
