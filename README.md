# PayJarvis Premium — Enterprise Modules

> **Repositório privado** — Código proprietário PayJarvis Enterprise

Este repositório contém os dois módulos Enterprise do PayJarvis:

```
Payjarvispremium/
├── payjarvis-blockchain/    ← Trust & Proof Layer (Base blockchain)
└── payjarvis-enterprise/    ← Anomaly Detection + Domain Scores + Reports
```

---

## payjarvis-blockchain

Camada de prova criptográfica e blockchain para auditoria Enterprise.

**Funcionalidades:**
- `PayJarvisRegistry.sol` — registro on-chain de agentes certificados
- `PayJarvisAnchoring.sol` — Merkle root anchoring de decisões
- Anchoring service com retry logic
- VC-lite credentials (Ed25519)
- API: `/v1/proofs`, `/v1/agents`, `/v1/credential`

**Stack:** Solidity 0.8.20, Hardhat, ethers v6, Base Sepolia/mainnet, Prisma, Fastify

**Setup:**
```bash
cd payjarvis-blockchain
npm install
npx hardhat compile
cp .env.example .env  # preencher variáveis
npx hardhat run scripts/deploy.ts --network base-sepolia
npm run dev
```

---

## payjarvis-enterprise

Features Enterprise de analytics e auditoria.

**Funcionalidades:**
- **Anomaly Detection** — detecta padrões suspeitos (velocity spike, amount spike, merchant burst, off-hours, block rate, category drift, round amounts)
- **Domain Scores** — Trust Score granular por categoria (food, travel, shopping, etc.) com limites de autonomia por tier
- **Report Generator** — PDFs de auditoria com resumo executivo, métricas, domain scores, anomalias e timeline

**Endpoints:**
```
POST /v1/enterprise/anomaly/analyze
GET  /v1/enterprise/anomaly/baseline/:botId
GET  /v1/enterprise/domain-scores/:botId
GET  /v1/enterprise/domain-scores/:botId/:category
POST /v1/enterprise/reports/generate
GET  /health
```

**Auth:** header `X-Enterprise-Key`

**Setup:**
```bash
cd payjarvis-enterprise
npm install
cp .env.example .env  # preencher variáveis
npm run dev
```

---

## Arquitetura geral

```
PayJarvis Core (open source)
    ↓ chama
PayJarvis Enterprise (este repo)
    ↓ âncora
PayJarvis Blockchain (este repo)
```

---

## Segurança

- Nenhum dado pessoal on-chain (apenas hashes)
- Ed25519 para credenciais (not RSA — mais rápido, menor footprint)
- RLS habilitado em todas as tabelas
- Replay attack: JTI one-time use no BDIT
- Chaves rotacionadas via env vars, nunca hardcoded
