import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { JwtClaims } from "../types";

/**
 * Verifies the bearer JWT and attaches req.tenant. This is the only place
 * firm_id enters the request — routes must never read a firm_id from a
 * query param, body field, or path segment.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing bearer token" });
  }

  let claims: JwtClaims;
  try {
    claims = jwt.verify(token, config.jwtSecret) as JwtClaims;
  } catch {
    return res.status(401).json({ error: "invalid or expired token" });
  }

  if (!claims.user_id || !claims.firm_id || !claims.role) {
    return res.status(401).json({ error: "malformed token claims" });
  }

  req.tenant = {
    userId: claims.user_id,
    firmId: claims.firm_id,
    role: claims.role,
    clientOrgId: claims.client_org_id,
  };
  next();
}

/** Coarse firm-role gate. Per-engagement role_override is checked separately where relevant. */
export function requireFirmRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.tenant) return res.status(401).json({ error: "unauthenticated" });
    if (!roles.includes(req.tenant.role)) {
      return res.status(403).json({ error: "insufficient role" });
    }
    next();
  };
}
