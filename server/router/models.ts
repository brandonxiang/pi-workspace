import type { FastifyInstance } from "fastify";
import { getModelSupportsImages } from "../utils/chat-validation.js";
import { createLocalModelRegistry } from "../utils/auth.js";

export function registerModelRoutes(server: FastifyInstance) {
  server.get("/api/models", async (_request, reply) => {
    try {
      const { modelRegistry } = await createLocalModelRegistry();
      const models = modelRegistry.getAvailable().map((model) => ({
        provider: model.provider,
        model: model.id,
        label: `${model.name || model.id} (${model.provider})`,
        supportsImages: getModelSupportsImages(model),
      }));

      return { models };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to load models",
      };
    }
  });
}
