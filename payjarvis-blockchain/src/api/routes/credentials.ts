import { FastifyInstance } from "fastify";
import { z } from "zod";
import { VCIssuer } from "../../credentials/vc-issuer";

const vcIssuer = new VCIssuer();

const issueAgentCredSchema = z.object({
  botId: z.string(),
  agentPublicId: z.string(),
  certifiedAt: z.string(),
  expiresInDays: z.number().default(365),
});

const issueAnchorProofSchema = z.object({
  txHash: z.string(),
  merkleRoot: z.string(),
  eventCount: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export async function credentialsRoutes(app: FastifyInstance) {
  // Issue a Verifiable Credential for a verified agent
  app.post("/issue/agent", async (request, reply) => {
    const body = issueAgentCredSchema.parse(request.body);
    const { expiresInDays, ...payload } = body;

    const result = await vcIssuer.issueAgentCredential(payload, expiresInDays);
    return reply.code(201).send(result);
  });

  // Issue an Anchor Proof VC
  app.post("/issue/anchor-proof", async (request, reply) => {
    const body = issueAnchorProofSchema.parse(request.body);

    const jwt = await vcIssuer.issueAnchorProofCredential(
      body.txHash,
      body.merkleRoot,
      body.eventCount,
      body.periodStart,
      body.periodEnd
    );

    return reply.code(201).send({ jwt });
  });
}
