# PayJarvis Blockchain — Trust & Proof Layer

## Overview

Modulo Enterprise separado que adiciona **prova criptografica** e **blockchain** ao PayJarvis. Garante auditabilidade, certificacao de agentes e emissao de credenciais verificaveis (W3C VC) — tudo sem expor dados pessoais on-chain.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    PayJarvis Core API                        │
│              (decisoes, bots, merchants)                     │
└──────────────┬──────────────────────────────┬───────────────┘
               │ /internal/decisions          │ /internal/bots/:id/metrics
               ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│   ANCHORING LAYER    │    │        REGISTRY LAYER            │
│                      │    │                                  │
│  Merkle Tree Builder │    │  Certification Criteria Engine   │
│  Period Salt (anti-  │    │  On-chain Agent Registration     │
│    linkage)          │    │  Revocation with reason codes    │
│  On-chain root       │    │                                  │
│    publishing        │    │  Contract: PayJarvisRegistry.sol │
│  Cron job (6h cycle) │    │                                  │
│                      │    └──────────────────────────────────┘
│  Contract:           │
│  PayJarvisAnchoring  │    ┌──────────────────────────────────┐
│    .sol              │    │         VC-LITE LAYER            │
└──────────────────────┘    │                                  │
                            │  W3C Verifiable Credentials      │
                            │  ES256K (secp256k1) signing      │
                            │  Agent Certification VCs         │
                            │  Anchor Proof VCs                │
                            │  did:web DID method              │
                            │                                  │
                            │  Storage: PostgreSQL (Json)      │
                            └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     BASE SEPOLIA (L2)                        │
│                     Chain ID: 84532                          │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas chaves e URLs

# 3. Compilar contratos Solidity
npm run compile

# 4. Deploy na testnet (Base Sepolia)
npm run deploy:testnet
# Copiar enderecos dos contratos para .env

# 5. Rodar migrations do banco
npx prisma migrate dev

# 6. Iniciar servidor de desenvolvimento
npm run dev
```

### Gerar chave VC (secp256k1)

```bash
node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('hex'))"
```

## API Endpoints

Todos os endpoints (exceto `/health`) requerem header `x-api-key`.

### Proofs (Anchoring)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/proofs/anchor` | Ancora decisoes de um periodo on-chain |
| POST | `/api/v1/proofs/merkle` | Constroi Merkle tree off-chain (sem tx) |
| POST | `/api/v1/proofs/verify` | Verifica uma decisao contra Merkle root |
| GET | `/api/v1/proofs/:index` | Busca anchor record on-chain por indice |
| GET | `/api/v1/proofs/latest` | Ultimo anchor record publicado |
| GET | `/api/v1/proofs/count` | Total de records ancorados |

### Agents (Registry)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/agents/register` | Registra bot on-chain (com certificacao) |
| POST | `/api/v1/agents/revoke` | Revoga agente com reason code |
| GET | `/api/v1/agents/active?botId=X` | Verifica se agente esta ativo on-chain |
| GET | `/api/v1/agents/details?botId=X` | Detalhes do agente no contrato |
| GET | `/api/v1/agents/certification?botId=X` | Dry-run de certificacao (sem tx) |

### Credentials (VC-Lite)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/v1/credentials/issue/agent` | Emite VC para agente certificado |
| POST | `/api/v1/credentials/issue/anchor-proof` | Emite VC de prova de ancoragem |

## For Marketplaces

Tres opcoes de integracao, do mais simples ao mais robusto:

### Opcao 1: BDIT Verify (rapido)

Verificacao local sem blockchain. Ideal para latencia minima.

```bash
GET /api/v1/agents/certification?botId=bot_abc123
```

```json
{
  "eligible": true,
  "reasons": [],
  "metrics": {
    "trustScore": 87,
    "ownerVerified": true,
    "approvedTxCount": 342,
    "daysActive": 45,
    "blockedLast7Days": 0,
    "hasPolicyConfigured": true
  }
}
```

### Opcao 2: Registry On-Chain (trustless)

Consulta direta no contrato — nenhuma confianca no servidor necessaria.

```bash
GET /api/v1/agents/active?botId=bot_abc123
```

```json
{ "active": true }
```

Ou consulta detalhada:

```bash
GET /api/v1/agents/details?botId=bot_abc123
```

```json
{
  "active": true,
  "registeredAt": "2025-03-01T10:00:00.000Z",
  "revokedAt": null,
  "metadataHash": "0xabc...",
  "reasonCode": ""
}
```

### Opcao 3: Merkle Proof (auditoria completa)

Prova criptografica de uma decisao especifica — verificavel por qualquer parte.

```bash
POST /api/v1/proofs/verify
```

```json
{
  "decision": {
    "decisionId": "dec_001",
    "botId": "bot_abc",
    "merchantId": "merch_xyz",
    "amount": 150.00,
    "currency": "BRL",
    "decision": "approved",
    "timestamp": 1709312400
  },
  "proof": ["0xaaa...", "0xbbb...", "0xccc..."],
  "periodSalt": "a1b2c3d4e5f6...",
  "merkleRoot": "0x123..."
}
```

```json
{ "valid": true }
```

## Certification Criteria

Para ser registrado on-chain, um bot precisa atender todos os criterios:

| Criterio | Threshold |
|----------|-----------|
| Trust Score | >= 65 |
| Transacoes aprovadas | >= 10 |
| Dias ativo | >= 3 |
| Bloqueios nos ultimos 7 dias | 0 |
| Owner verificado | Sim |
| Policy configurada | Sim |

## Threat Model

| Vetor | Mitigacao |
|-------|-----------|
| **Replay** | JTI one-time use em VCs; `credentialId` unique no banco |
| **Falsificacao** | ES256K (secp256k1) signing — impossivel sem chave privada |
| **Revogacao** | On-chain imediato via `revokeAgent()` com reason code |
| **PII** | Zero dados pessoais on-chain — apenas hashes e Merkle roots |
| **Linkage** | Period salt unico por ciclo impede correlacao entre periodos |
| **Tampering** | Merkle tree garante integridade — qualquer alteracao invalida a root |

## Scripts NPM

| Script | Descricao |
|--------|-----------|
| `npm run compile` | Compila contratos Solidity |
| `npm run test:contracts` | Testa contratos com Hardhat |
| `npm run test` | Testa servicos com Vitest |
| `npm run deploy:testnet` | Deploy na Base Sepolia |
| `npm run deploy:mainnet` | Deploy em mainnet |
| `npm run dev` | Servidor dev com hot-reload |
| `npm run build` | Build TypeScript |
| `npm run start` | Servidor producao |
| `npm run anchor:run` | Executa ancoragem manual (one-shot) |
| `npm run db:migrate` | Prisma migrate dev |
| `npm run db:generate` | Gera Prisma client |

## Stack

- **Blockchain**: Base Sepolia (L2), Solidity 0.8.20, ethers.js v6
- **API**: Fastify v4, Zod validation
- **Credentials**: did-jwt (ES256K), W3C VC spec
- **Database**: PostgreSQL via Prisma ORM
- **Merkle**: merkletreejs com keccak256
- **Scheduling**: node-cron (ciclos de 6h)
- **Testing**: Hardhat + Chai (contratos), Vitest (servicos)
