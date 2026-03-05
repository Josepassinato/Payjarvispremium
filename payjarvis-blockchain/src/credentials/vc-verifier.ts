import { verifyJWT, Resolver } from "did-jwt";

export interface VerificationResult {
  valid: boolean;
  issuer: string;
  subject: string;
  credentialType: string[];
  issuanceDate: string;
  expirationDate?: string;
  error?: string;
}

export class VCVerifier {
  private resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  async verify(jwt: string): Promise<VerificationResult> {
    try {
      const verified = await verifyJWT(jwt, { resolver: this.resolver });
      const vc = verified.payload.vc;

      return {
        valid: true,
        issuer: verified.issuer,
        subject: verified.payload.sub || "",
        credentialType: vc?.type || [],
        issuanceDate: vc?.issuanceDate || "",
        expirationDate: vc?.expirationDate,
      };
    } catch (err) {
      return {
        valid: false,
        issuer: "",
        subject: "",
        credentialType: [],
        issuanceDate: "",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
