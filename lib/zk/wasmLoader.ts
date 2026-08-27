/**
 * lib/zk/wasmLoader.ts
 *
 * Handles client-side initialization of Noir ACVM and ABI compiler WASM modules.
 * Implements a thread-safe singleton cache and returns initialization state.
 */

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initializes the Noir ZK compiler toolchain in the browser by loading two
 * WebAssembly modules:
 *
 * - **`@noir-lang/acvm_js`** – the ACVM (Abstract Circuit Virtual Machine)
 *   that executes Noir opcodes during proof generation.
 * - **`@noir-lang/noirc_abi`** – the ABI compiler that encodes / decodes
 *   circuit inputs and outputs.
 *
 * Call this function **once** before any ZK proof or verification work is
 * attempted (e.g. when the user first navigates to the Prove or Verify
 * pages).  Subsequent calls return the cached result immediately.
 *
 * @returns `true` when WASM modules are ready, `false` in an SSR context
 *          where `window` is unavailable.
 * @throws  If the browser fails to fetch or instantiate either WASM module.
 */
export async function initZkToolchain(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // Dynamic imports to prevent server-side Node.js compilation crashes
    const initACVM = (await import('@noir-lang/acvm_js')).default;
    const initNoirC = (await import('@noir-lang/noirc_abi')).default;

    const acvmWasmUrl = new URL('@noir-lang/acvm_js/web/acvm_js_bg.wasm', import.meta.url).toString();
    const noircWasmUrl = new URL('@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm', import.meta.url).toString();

    try {
      await Promise.all([
        initACVM(fetch(acvmWasmUrl)),
        initNoirC(fetch(noircWasmUrl))
      ]);
    } catch {
      // Fallback for bundler setups where static assets are not served at the expected import.meta.url path
      try {
        await Promise.all([
          initACVM(fetch('/_next/static/wasm/acvm_js_bg.wasm')),
          initNoirC(fetch('/_next/static/wasm/noirc_abi_wasm_bg.wasm'))
        ]);
      } catch {
        throw new Error(
          'Failed to initialize ZK WASM modules. The Barretenberg proving engine cannot start.'
        );
      }
    }

    isInitialized = true;
    return true;
  })();

  return initPromise;
}
