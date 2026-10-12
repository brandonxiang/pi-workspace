import {
  DefaultResourceLoader,
  getAgentDir,
  type ModelRuntime,
} from "@earendil-works/pi-coding-agent";

/**
 * Provider/model registrations contributed by the user's local Pi extensions.
 *
 * Pi resolves providers from extensions (for example a local gateway in
 * `~/.pi/agent/extensions/`). Those extensions declare their models by calling
 * `pi.registerProvider(...)`, which must be replayed into the model runtime
 * that pi-workspace builds for `/api/models` and agent sessions.
 */
export interface ExtensionProviderRegistrations {
  legacy: Array<{
    name: string;
    config: Parameters<ModelRuntime["registerProvider"]>[1];
    extensionPath: string;
  }>;
  native: Array<{
    provider: Parameters<ModelRuntime["registerNativeProvider"]>[0];
    extensionPath: string;
  }>;
  virtual: Array<{
    definition: Parameters<ModelRuntime["registerVirtualModel"]>[0];
    extensionPath: string;
  }>;
  errors: Array<{ path: string; error: string }>;
}

/**
 * The model runtime surface used to replay extension provider registrations.
 * Kept structural so tests can pass a lightweight fake.
 */
export interface ExtensionProviderTarget {
  registerProvider(
    name: string,
    config: ExtensionProviderRegistrations["legacy"][number]["config"],
  ): void;
  registerNativeProvider(
    provider: ExtensionProviderRegistrations["native"][number]["provider"],
  ): void;
  registerVirtualModel(
    definition: ExtensionProviderRegistrations["virtual"][number]["definition"],
  ): void;
}

/**
 * Minimal slice of `DefaultResourceLoader` used to collect provider
 * registrations. Kept structural so tests can substitute a fake loader.
 */
export interface ExtensionLoaderLike {
  reload(): Promise<void>;
  getExtensions(): {
    errors: Array<{ path: string; error: string }>;
    runtime: {
      pendingProviderRegistrations: ExtensionProviderRegistrations["legacy"];
      pendingNativeProviderRegistrations: ExtensionProviderRegistrations["native"];
      pendingVirtualModelRegistrations: ExtensionProviderRegistrations["virtual"];
    };
  };
}

export function createExtensionLoader(
  cwd: string = process.cwd(),
  agentDir: string = getAgentDir(),
): ExtensionLoaderLike {
  // Only model providers are wanted here; skills, prompts, themes, and context
  // files stay out of the server so extension-declared tools are never enabled
  // for online sessions.
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });

  return {
    // Treat the project as untrusted: the server has no trust prompt, so it
    // must not execute project-local extension code from an arbitrary cwd.
    // User-level extensions and installed Pi packages still load.
    reload: () => loader.reload({ resolveProjectTrust: async () => false }),
    getExtensions: () => loader.getExtensions(),
  };
}

export async function collectExtensionProviderRegistrations(
  loader: ExtensionLoaderLike,
): Promise<ExtensionProviderRegistrations> {
  await loader.reload();
  const result = loader.getExtensions();

  return {
    legacy: result.runtime.pendingProviderRegistrations.map((entry) => ({ ...entry })),
    native: result.runtime.pendingNativeProviderRegistrations.map((entry) => ({ ...entry })),
    virtual: result.runtime.pendingVirtualModelRegistrations.map((entry) => ({ ...entry })),
    errors: result.errors.map((entry) => ({ ...entry })),
  };
}

export function applyExtensionProviderRegistrations(
  modelRuntime: ExtensionProviderTarget,
  registrations: ExtensionProviderRegistrations,
): string[] {
  const errors: string[] = [];

  for (const { name, config, extensionPath } of registrations.legacy) {
    try {
      modelRuntime.registerProvider(name, config);
    } catch (error) {
      errors.push(formatRegistrationError(extensionPath, error));
    }
  }

  for (const { provider, extensionPath } of registrations.native) {
    try {
      modelRuntime.registerNativeProvider(provider);
    } catch (error) {
      errors.push(formatRegistrationError(extensionPath, error));
    }
  }

  for (const { definition, extensionPath } of registrations.virtual) {
    try {
      modelRuntime.registerVirtualModel(definition);
    } catch (error) {
      errors.push(formatRegistrationError(extensionPath, error));
    }
  }

  return errors;
}

function formatRegistrationError(extensionPath: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Extension "${extensionPath}" error: ${message}`;
}

const emptyRegistrations = (
  errors: ExtensionProviderRegistrations["errors"] = [],
): ExtensionProviderRegistrations => ({
  legacy: [],
  native: [],
  virtual: [],
  errors,
});

export interface ExtensionProviderRegistry {
  /** Replay cached registrations into the runtime, loading extensions on first use. */
  register(modelRuntime: ExtensionProviderTarget): Promise<string[]>;
  /** Drop the cached registrations so the next call reloads extensions. */
  clear(): void;
}

/**
 * Build a registry that loads local Pi extensions once and replays their
 * provider registrations into each supplied runtime. Extension factories may
 * fetch a live model catalog, so loading is cached for the process lifetime.
 */
export function createExtensionProviderRegistry(
  loaderFactory: () => ExtensionLoaderLike = () => createExtensionLoader(),
): ExtensionProviderRegistry {
  let cachedRegistrations: Promise<ExtensionProviderRegistrations> | undefined;

  return {
    clear() {
      cachedRegistrations = undefined;
    },
    async register(modelRuntime: ExtensionProviderTarget): Promise<string[]> {
      cachedRegistrations ??= collectExtensionProviderRegistrations(loaderFactory())
        .then((registrations) => {
          for (const { path, error } of registrations.errors) {
            console.error(`[pi-workspace] Failed to load Pi extension ${path}: ${error}`);
          }
          return registrations;
        })
        .catch((error: unknown) => {
          // Do not cache a failed load: the next request should retry instead of
          // permanently hiding extension-provided models.
          cachedRegistrations = undefined;
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[pi-workspace] Failed to load Pi extensions for models: ${message}`);
          return emptyRegistrations();
        });

      const registrations = await cachedRegistrations;
      return applyExtensionProviderRegistrations(modelRuntime, registrations);
    },
  };
}

const defaultRegistry = createExtensionProviderRegistry();

export function clearExtensionProviderCache() {
  defaultRegistry.clear();
}

/**
 * Load local Pi extensions once and replay their provider registrations into
 * the supplied runtime.
 */
export function registerExtensionProviders(
  modelRuntime: ExtensionProviderTarget,
): Promise<string[]> {
  return defaultRegistry.register(modelRuntime);
}
