import Fastify from "fastify";
import { config } from "../config";
import { proofsRoutes } from "./routes/proofs";
import { agentsRoutes } from "./routes/agents";
import { credentialsRoutes } from "./routes/credentials";

const app = Fastify({
  logger: {
    level: config.NODE_ENV === "production" ? "info" : "debug",
  },
});

// API key authentication
app.addHook("onRequest", async (request, reply) => {
  // Skip health check
  if (request.url === "/health") return;

  const apiKey = request.headers["x-api-key"];
  if (apiKey !== config.API_KEY) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});

// Health check
app.get("/health", async () => ({ status: "ok", module: "payjarvis-blockchain" }));

// Register route modules
app.register(proofsRoutes, { prefix: "/api/v1/proofs" });
app.register(agentsRoutes, { prefix: "/api/v1/agents" });
app.register(credentialsRoutes, { prefix: "/api/v1/credentials" });

async function start() {
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    console.log(`PayJarvis Blockchain API running on 0.0.0.0:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { app };
