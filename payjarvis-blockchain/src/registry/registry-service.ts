import { ethers } from "ethers";
import { prisma } from "../db/prisma";
import { config } from "../config";
import { evaluateCertification, BotMetrics } from "./certification-criteria";

const REGISTRY_ABI = [
  "function registerAgent(bytes32 agentPublicId, bytes32 metadataHash) external",
  "function revokeAgent(bytes32 agentPublicId, string calldata reasonCode) external",
  "function isAgentActive(bytes32 agentPublicId) external view returns (bool)",
  "function getAgent(bytes32 agentPublicId) external view returns (bool active, uint256 registeredAt, uint256 revokedAt, bytes32 metadataHash, string reasonCode)",
];

export interface RegisterBotRequest {
  botId: string;
  name: string;
  vendor: string;
  version: string;
  capabilities: string[];
}

export interface AgentRecord {
  active: boolean;
  registeredAt: Date;
  revokedAt: Date | null;
  metadataHash: string;
  reasonCode: string;
}

export class RegistryService {
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;

  constructor() {
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.wallet = new ethers.Wallet(config.PUBLISHER_PRIVATE_KEY, provider);
    this.contract = new ethers.Contract(
      config.REGISTRY_CONTRACT_ADDRESS,
      REGISTRY_ABI,
      this.wallet
    );
  }

  private computeAgentId(botId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(botId));
  }

  private computeMetadataHash(data: RegisterBotRequest): string {
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(data)));
  }

  async registerBot(bot: RegisterBotRequest): Promise<{
    txHash: string;
    agentId: string;
    certification: { eligible: boolean; reasons: string[] };
  }> {
    const metrics = await this.fetchBotMetrics(bot.botId);

    const certification = evaluateCertification(metrics);
    if (!certification.eligible) {
      throw new Error(
        `Bot does not meet certification criteria: ${certification.reasons.join("; ")}`
      );
    }

    const agentId = this.computeAgentId(bot.botId);
    const metadataHash = this.computeMetadataHash(bot);

    const tx = await this.contract.registerAgent(agentId, metadataHash);
    const receipt = await tx.wait();

    await prisma.verifiedAgent.create({
      data: {
        botId: bot.botId,
        agentPublicId: agentId,
        metadataHash,
        onChainTxHash: receipt.hash,
      },
    });

    return { txHash: receipt.hash, agentId, certification };
  }

  async revokeBot(botId: string, reasonCode: string): Promise<string> {
    const agentId = this.computeAgentId(botId);
    const tx = await this.contract.revokeAgent(agentId, reasonCode);
    const receipt = await tx.wait();

    await prisma.verifiedAgent.update({
      where: { botId },
      data: { active: false, revokedAt: new Date(), revokeReason: reasonCode },
    });

    return receipt.hash;
  }

  async isBotActive(botId: string): Promise<boolean> {
    const agentId = this.computeAgentId(botId);
    return this.contract.isAgentActive(agentId);
  }

  async getBot(botId: string): Promise<AgentRecord> {
    const agentId = this.computeAgentId(botId);
    const [active, registeredAt, revokedAt, metadataHash, reasonCode] =
      await this.contract.getAgent(agentId);

    return {
      active,
      registeredAt: new Date(Number(registeredAt) * 1000),
      revokedAt: Number(revokedAt) > 0 ? new Date(Number(revokedAt) * 1000) : null,
      metadataHash,
      reasonCode,
    };
  }

  async checkCertification(botId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    metrics: BotMetrics;
  }> {
    const metrics = await this.fetchBotMetrics(botId);
    const result = evaluateCertification(metrics);
    return { ...result, metrics };
  }

  private async fetchBotMetrics(botId: string): Promise<BotMetrics> {
    const res = await fetch(
      `${config.PAYJARVIS_API_URL}/internal/bots/${botId}/metrics`,
      {
        headers: {
          Authorization: `Bearer ${config.INTERNAL_API_KEY}`,
        },
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch metrics for bot ${botId}: ${res.status}`);
    }
    return res.json();
  }
}
