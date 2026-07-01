import { Request, Response, NextFunction } from 'express';
import { verifyMemberToken, MemberJwtPayload, getMemberSessionEpoch } from '../lib/memberAuth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      member?: MemberJwtPayload;
    }
  }
}

// Guards the member-portal routes. Accepts ONLY member-scoped tokens; a partner
// (staff) token is rejected here, just as a member token is rejected by the
// partner authenticate() middleware.
export async function authenticateMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in to continue' });
    return;
  }
  const payload = verifyMemberToken(header.split(' ')[1]);
  if (!payload) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  // Revocation check: the token's epoch must match the member's current epoch.
  // Legacy tokens (no ep) count as epoch 0. Fails OPEN on a DB/column error so a
  // transient issue — or running before migration 066 — never locks members out;
  // only an explicit epoch mismatch or a deleted member rejects.
  try {
    const epoch = await getMemberSessionEpoch(payload.memberId);
    if (epoch === null) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }
    if ((payload.ep ?? 0) !== epoch) {
      res.status(401).json({ error: 'You have been signed out. Please sign in again.' });
      return;
    }
  } catch {
    /* DB/column unavailable — don't lock members out; revocation is best-effort here */
  }

  req.member = payload;
  next();
}
