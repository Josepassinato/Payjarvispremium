import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AnchoringService } from "../../anchoring/anchoring-service";
import { buildMerkleTree, getMerkleProof, verifyProof } from "../../anchoring/merkle-builder";

const anchoringService = new AnchoringService();

const decisionLeafSchema = z.object({
  decisionId: z.string(),
  botId: z.string(),
  merchantId: z.string(),
  amount: z.number(),
  currency: z.string(),
  decision: z.enum(["approved", "pending", "blocked"]),
  timestamp: z.number(),
  policyId: z.string().optional(),
});

const anchorRequestSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

const verifyRequestSchema = z.object({
  decision: decisionLeafSchema,
  proof: z.array(z.string()),
  periodSalt: z.string(),
  merkleRoot: z.string(),
});

export async function proofsRoutes(app: FastifyInstance) {
  // Anchor a period on-chain (fetches decisions from PayJarvis core)
  app.post("/anchor", async (request, reply) => {
    const body = anchorRequestSchema.parse(request.body);

    await anchoringService.anchorPeriod(
      new Date(body.periodStart),
      new Date(body.periodEnd)
    );

    return reply.code(201).send({ status: "anchored" });
  });

  // Build merkle tree and return root + proofs (off-chain)
  app.post("/merkle", async (request, reply) => {
    const body = z.object({
      decisions: z.array(decisionLeafSchema).min(1),
      periodSalt: z.string(),
    }).parse(request.body);

    const { tree, root, leaves } = buildMerkleTree(body.decisions, body.periodSalt);

    const proofs = body.decisions.map((decision) => ({
      decisionId: decision.decisionId,
      proof: getMerkleProof(tree, decision, body.periodSalt),
    }));

    return { root, leaves: leaves.map((l) => "0x" + l.toString("hex")), proofs };
  });

  // Verify a single decision proof off-chain
  app.post("/verify", async (request, reply) => {
    const body = verifyRequestSchema.parse(request.body);
    const valid = verifyProof(body.proof, body.decision, body.periodSalt, body.merkleRoot);
    return { valid };
  });

  // Get on-chain record by index
  app.get<{ Params: { index: string } }>("/:index", async (request, reply) => {
    const index = parseInt(request.params.index, 10);
    if (isNaN(index)) return reply.code(400).send({ error: "Invalid index" });

    const record = await anchoringService.getRecord(index);
    return record;
  });

  // Get latest on-chain record
  app.get("/latest", async () => {
    return anchoringService.getLatestRecord();
  });

  // Get total records count
  app.get("/count", async () => {
    const total = await anchoringService.totalRecords();
    return { total };
  });
}
