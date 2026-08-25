import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, UserRole, AccessTokenPayload } from '../utils/tokens';

// Extend Express Request with the authenticated principal
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

// មិនអានទេ header X-Role ឬ body.role ណាមួយឡើយ — role មកពី JWT ដែល server ចុះហត្ថលេខាតែម្តងគត់
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role hierarchy: super_admin > admin > staff
const ROLE_RANK: Record<UserRole, number> = { staff: 1, admin: 2, super_admin: 3 };

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// សម្រាប់ resource ដែលជា "own data only" សម្រាប់ staff (e.g. មើលតែ history របស់ខ្លួន)
// admin/super_admin រំលងបាន
export function requireSelfOrRole(getOwnerId: (req: Request) => string, minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const isOwner = req.user.sub === getOwnerId(req);
    const hasRole = ROLE_RANK[req.user.role] >= ROLE_RANK[minRole];
    if (!isOwner && !hasRole) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
