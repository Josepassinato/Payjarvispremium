import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Blockchain
  RPC_URL: z.string().url(),
  PUBLISHER_PRIVATE_KEY: z.string().min(64),
  DEPLOY_PRIVATE_KEY: z.string().min(64).optional(),
  CHAIN_ID: z.coerce.number().default(84532),
  ANCHORING_CONTRACT_ADDRESS: z.string().startsWith("0x"),
  REGISTRY_CONTRACT_ADDRESS: z.string().startsWith("0x"),

  // PayJarvis Core integration
  PAYJARVIS_API_URL: z.string().url(),
  INTERNAL_API_KEY: z.string().min(1),
  ISSUER_ID: z.string().default("https://payjarvis.com"),

  // API
  PORT: z.coerce.number().default(3003),
  API_KEY: z.string().min(32),

  // Anchoring
  ANCHOR_CRON: z.string().default("0 */6 * * *"),
  ANCHOR_PERIOD_HOURS: z.coerce.number().default(6),

  // VC Credentials (secp256k1)
  VC_PRIVATE_KEY_HEX: z.string().min(64),
  VC_PUBLIC_KEY_HEX: z.string().optional(),

  // Security
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
