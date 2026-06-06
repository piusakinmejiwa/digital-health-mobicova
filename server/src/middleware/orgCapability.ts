import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { orgClass, OrgClass } from '../lib/orgTypes';

// Gate a staff route by the calling user's organisation CLASS (demand / supply /
// integration). Runs after `authenticate` (needs req.user.orgId).
//
// Note: data isolation is already enforced by org_id-scoped queries everywhere;
// this is about exposing the right *workspaces* to the right org type.
export function requireOrgClass(...classes: OrgClass[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      const r = await query('SELECT type FROM organisations WHERE id = $1', [req.user.orgId]);
      const cls = r.rows.length > 0 ? orgClass(r.rows[0].type) : null;
      if (cls && classes.includes(cls)) {
        next();
        return;
      }
      res.status(403).json({ error: 'This area is not available for your organisation type.' });
    } catch (err) {
      next(err);
    }
  };
}
