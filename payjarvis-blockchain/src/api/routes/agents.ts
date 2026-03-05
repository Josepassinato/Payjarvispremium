import { FastifyInstance } from "fastify";
import { z } from "zod";
import { RegistryService } from "../../registry/registry-service";

const registryService = new RegistryService();

const registerBotSchema = z.object({
  botId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+/),
  vendor: z.string().min(1),
  capabilities: z.array(z.string()).min(1),
});

const revokeBotSchema = z.object({
  botId: z.string().min(1),
  reasonCode: z.string().min(1),
});

export async function agentsRoutes(app: FastifyInstance) {
  // Register a bot on-chain (checks certification criteria first)
  app.post("/register", async (request, reply) => {
    const body = registerBotSchema.parse(request.body);
    const result = await registryService.registerBot(body);
    return reply.code(201).send(result);
  });

  // Revoke a bot
  app.post("/revoke", async (request, reply) => {
    const body = revokeBotSchema.parse(request.body);
    const txHash = await registryService.revokeBot(body.botId, body.reasonCode);
    return { txHash, revoked: true };
  });

  // Check if bot is active on-chain
  app.get<{ Querystring: { botId: string } }>(
    "/active",
    async (request, reply) => {
      const { botId } = request.query;
      if (!botId) {
        return reply.code(400).send({ error: "botId is required" });
      }
      const active = await registryService.isBotActive(botId);
      return { active };
    }
  );

  // Get bot details from on-chain
  app.get<{ Querystring: { botId: string } }>(
    "/details",
    async (request, reply) => {
      const { botId } = request.query;
      if (!botId) {
        return reply.code(400).send({ error: "botId is required" });
      }
      const bot = await registryService.getBot(botId);
      return bot;
    }
  );

  // Check certification eligibility (dry-run, no on-chain write)
  app.get<{ Querystring: { botId: string } }>(
    "/certification",
    async (request, reply) => {
      const { botId } = request.query;
      if (!botId) {
        return reply.code(400).send({ error: "botId is required" });
      }
      const result = await registryService.checkCertification(botId);
      return result;
    }
  );
}
