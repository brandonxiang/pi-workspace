import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  applyExtensionProviderRegistrations,
  clearExtensionProviderCache,
  collectExtensionProviderRegistrations,
  createExtensionProviderRegistry,
  type ExtensionLoaderLike,
  type ExtensionProviderTarget,
} from "../utils/extension-providers.js";

interface FakeRuntime {
  runtime: ExtensionProviderTarget;
  registerProvider: ReturnType<typeof vi.fn>;
  registerNativeProvider: ReturnType<typeof vi.fn>;
  registerVirtualModel: ReturnType<typeof vi.fn>;
}

function createFakeRuntime(): FakeRuntime {
  const registerProvider = vi.fn();
  const registerNativeProvider = vi.fn();
  const registerVirtualModel = vi.fn();

  return {
    runtime: { registerProvider, registerNativeProvider, registerVirtualModel },
    registerProvider,
    registerNativeProvider,
    registerVirtualModel,
  };
}

interface FakeLoader {
  loader: ExtensionLoaderLike;
  reload: ReturnType<typeof vi.fn>;
}

function createFakeLoader(
  pending: Partial<ReturnType<ExtensionLoaderLike["getExtensions"]>["runtime"]> = {},
  errors: Array<{ path: string; error: string }> = [],
): FakeLoader {
  const reload = vi.fn(async () => {});
  const loader: ExtensionLoaderLike = {
    reload,
    getExtensions: () => ({
      errors,
      runtime: {
        pendingProviderRegistrations: [],
        pendingNativeProviderRegistrations: [],
        pendingVirtualModelRegistrations: [],
        ...pending,
      },
    }),
  };

  return { loader, reload };
}

afterEach(() => {
  clearExtensionProviderCache();
  vi.restoreAllMocks();
});

describe("collectExtensionProviderRegistrations", () => {
  it("reloads the loader and copies the pending registrations", async () => {
    const { loader, reload } = createFakeLoader(
      {
        pendingProviderRegistrations: [
          {
            name: "ais-switch",
            config: { name: "AIS Switch", baseUrl: "http://127.0.0.1:15721/v1" },
            extensionPath: "/home/user/.pi/agent/extensions/ais-switch.ts",
          },
        ],
      },
      [{ path: "/home/user/.pi/agent/extensions/broken.ts", error: "boom" }],
    );

    const result = await collectExtensionProviderRegistrations(loader);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.legacy).toEqual([
      {
        name: "ais-switch",
        config: { name: "AIS Switch", baseUrl: "http://127.0.0.1:15721/v1" },
        extensionPath: "/home/user/.pi/agent/extensions/ais-switch.ts",
      },
    ]);
    expect(result.native).toEqual([]);
    expect(result.virtual).toEqual([]);
    expect(result.errors).toEqual([
      { path: "/home/user/.pi/agent/extensions/broken.ts", error: "boom" },
    ]);
  });
});

describe("applyExtensionProviderRegistrations", () => {
  it("registers legacy, native, and virtual providers on the runtime", () => {
    const { runtime, registerProvider, registerNativeProvider, registerVirtualModel } =
      createFakeRuntime();
    const config = { name: "AIS Switch", apiKey: "PROXY_MANAGED" };
    const nativeProvider = { id: "native-provider" } as never;
    const virtualDefinition = { provider: "virtual", id: "router" } as never;

    const errors = applyExtensionProviderRegistrations(runtime, {
      legacy: [{ name: "ais-switch", config, extensionPath: "/ext/ais-switch.ts" }],
      native: [{ provider: nativeProvider, extensionPath: "/ext/native.ts" }],
      virtual: [{ definition: virtualDefinition, extensionPath: "/ext/virtual.ts" }],
      errors: [],
    });

    expect(errors).toEqual([]);
    expect(registerProvider).toHaveBeenCalledWith("ais-switch", config);
    expect(registerNativeProvider).toHaveBeenCalledWith(nativeProvider);
    expect(registerVirtualModel).toHaveBeenCalledWith(virtualDefinition);
  });

  it("reports a per-extension error without aborting the remaining registrations", () => {
    const { runtime, registerNativeProvider } = createFakeRuntime();
    runtime.registerProvider = vi.fn(() => {
      throw new Error("bad provider");
    });

    const errors = applyExtensionProviderRegistrations(runtime, {
      legacy: [{ name: "broken", config: {}, extensionPath: "/ext/broken.ts" }],
      native: [{ provider: {} as never, extensionPath: "/ext/native.ts" }],
      virtual: [],
      errors: [],
    });

    expect(errors).toEqual(['Extension "/ext/broken.ts" error: bad provider']);
    expect(registerNativeProvider).toHaveBeenCalledTimes(1);
  });
});

describe("createExtensionProviderRegistry", () => {
  it("loads extensions once and replays the cached registrations", async () => {
    const { loader, reload } = createFakeLoader({
      pendingProviderRegistrations: [
        { name: "ais-switch", config: {}, extensionPath: "/ext/ais-switch.ts" },
      ],
    });
    let loaderCreations = 0;
    const registry = createExtensionProviderRegistry(() => {
      loaderCreations += 1;
      return loader;
    });

    const first = createFakeRuntime();
    const second = createFakeRuntime();

    await registry.register(first.runtime);
    await registry.register(second.runtime);

    expect(loaderCreations).toBe(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(first.registerProvider).toHaveBeenCalledTimes(1);
    expect(second.registerProvider).toHaveBeenCalledTimes(1);
  });

  it("reloads after clear()", async () => {
    const { loader, reload } = createFakeLoader();
    let loaderCreations = 0;
    const registry = createExtensionProviderRegistry(() => {
      loaderCreations += 1;
      return loader;
    });

    await registry.register(createFakeRuntime().runtime);
    registry.clear();
    await registry.register(createFakeRuntime().runtime);

    expect(loaderCreations).toBe(2);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed load and retries on the next call", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let loaderCreations = 0;
    const registry = createExtensionProviderRegistry(() => {
      loaderCreations += 1;
      return {
        reload: async () => {
          throw new Error("loader exploded");
        },
        getExtensions: () => {
          throw new Error("getExtensions should not be reached");
        },
      };
    });

    const errors = await registry.register(createFakeRuntime().runtime);
    expect(errors).toEqual([]);
    expect(consoleError).toHaveBeenCalled();

    await registry.register(createFakeRuntime().runtime);
    expect(loaderCreations).toBe(2);
  });
});
