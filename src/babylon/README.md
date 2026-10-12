# Babylon Toolkit React Framework Submodule (ES6)

* WEBGPU Public Web Assemblies (public/scripts)

The required `glslang` and `twgsl` web assemblies **must** reside in the application scripts folder:

```
await webgpuEngine.initAsync(
    { jsPath: "scripts/glslang.js", wasmPath: "scripts/glslang.wasm" },
    { jsPath: "scripts/twgsl.js", wasmPath: "scripts/twgsl.wasm" }
);
```

* DRACO Mesh Decoder (public/scripts)

The required `draco.js` and `draco.wasm` files **must** reside in the application scripts folder. They decode
Draco-compressed meshes (`KHR_draco_mesh_compression`) on both WebGL and WebGPU:

```
DracoDecoder.DefaultConfiguration = { wasmUrl: "scripts/draco.js", wasmBinaryUrl: "scripts/draco.wasm" };
```

`draco.js` is the Babylon snapshot's `draco_wasm_wrapper_gltf.js` (with its default wasm name set to `draco.wasm`),
and `draco.wasm` is the snapshot's `draco_decoder_gltf.wasm`.

---
React UI Framework Documentation: https://raw.githubusercontent.com/babylontoolkit/agent/main/references/react-framework.md
---