# Babylon Toolkit React Framework Submodule (ES6)

* WEBGPU Public Web Assemblies (public/scripts)

The required `glslang` and `twgsl` web assemblies **must** reside in the application scripts folder:

```
await webgpuEngine.initAsync(
    { jsPath: "scripts/glslang.js", wasmPath: "scripts/glslang.wasm" },
    { jsPath: "scripts/twgsl.js", wasmPath: "scripts/twgsl.wasm" }
);
```

---
React UI Framework Documentation: https://raw.githubusercontent.com/babylontoolkit/agent/main/references/react-framework.md
---