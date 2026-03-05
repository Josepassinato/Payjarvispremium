import { MerkleTree } from 'merkletreejs'
import { keccak256 } from 'ethers'

export interface DecisionLeaf {
  decisionId: string
  botId: string
  merchantId: string
  amount: number
  currency: string
  decision: 'approved' | 'pending' | 'blocked'
  timestamp: number
  policyId?: string
}

export function hashLeaf(leaf: DecisionLeaf, periodSalt: string): Buffer {
  const data = JSON.stringify({
    v: 1,
    decisionId: keccak256(Buffer.from(leaf.decisionId + periodSalt)),
    botId: keccak256(Buffer.from(leaf.botId + periodSalt)),
    merchantId: keccak256(Buffer.from(leaf.merchantId + periodSalt)),
    amount: leaf.amount,
    currency: leaf.currency,
    decision: leaf.decision,
    timestamp: leaf.timestamp,
    policyId: leaf.policyId ?? null
  })
  return Buffer.from(keccak256(Buffer.from(data)).slice(2), 'hex')
}

export function buildMerkleTree(leaves: DecisionLeaf[], periodSalt: string) {
  const hashedLeaves = leaves.map(l => hashLeaf(l, periodSalt))
  const tree = new MerkleTree(hashedLeaves, (data: Buffer) =>
    Buffer.from(keccak256(data).slice(2), 'hex'),
    { sortPairs: true }
  )
  return {
    tree,
    root: tree.getHexRoot(),
    leaves: hashedLeaves
  }
}

export function getMerkleProof(
  tree: MerkleTree,
  leaf: DecisionLeaf,
  periodSalt: string
): string[] {
  const hashedLeaf = hashLeaf(leaf, periodSalt)
  return tree.getHexProof(hashedLeaf)
}

export function verifyProof(
  proof: string[],
  leaf: DecisionLeaf,
  periodSalt: string,
  root: string
): boolean {
  const hashedLeaf = hashLeaf(leaf, periodSalt)
  const tree = new MerkleTree([], (data: Buffer) =>
    Buffer.from(keccak256(data).slice(2), 'hex')
  )
  return tree.verify(proof, hashedLeaf, root)
}
