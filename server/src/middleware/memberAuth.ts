import { Request, Response, NextFunction } from 'express';
import { verifyMemberToken, MemberJwtPayload } from '../lib/memberAuth';

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
export function authenticateMember(req: Request, res: Response, next: NextFunction): void {
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
  req.member = payload;
  next();
}
