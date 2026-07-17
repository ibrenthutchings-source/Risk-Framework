export type FirmRole = "partner" | "lead_auditor" | "staff_auditor" | "firm_admin";
export type ClientRole = "client_viewer";

/** JWT claims. A user in multiple firms holds one token per firm — see /v1/auth/switch-firm. */
export interface JwtClaims {
  user_id: string;
  firm_id: string;
  role: FirmRole | ClientRole;
  client_org_id?: string;
  iat?: number;
  exp?: number;
}

export interface TenantContext {
  userId: string;
  firmId: string;
  role: FirmRole | ClientRole;
  clientOrgId?: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}
