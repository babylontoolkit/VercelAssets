# Babylon Toolkit React Framework Submodule (ES6)

To add submodule:
```
git submodule add https://github.com/babylontoolkit/ReactFramework.git src/babylon
git commit -m "Add React-Framework as babylon submodule"
```

To remove submodule:
```
git submodule deinit -f src/babylon
git rm -f src/babylon
rm -rf .git/modules/src/babylon
git commit -m "Removed babylon submodule"
```

Note: Once the submodule has been added, to update, its best make sure any changes are backed up. Remove the submodule to clean then add the submodule again to get new updates.

---

# WEBGPU Public Web Assemblies (public/scripts)

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