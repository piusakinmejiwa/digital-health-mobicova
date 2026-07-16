import { Request, Response } from 'express';
import { query } from '../config/database';
import { EFFECTIVE_PREMIUM, planAssignmentJoin } from '../lib/premium';

// Ad-hoc query builder: measure × dimension over a time window, org-scoped. The
// allow-lists below define exactly which SQL fragments may be composed, so user
// input never reaches the query text — only validated keys do.

interface MeasureDef {
  from: string;
  value: string;
  date: string;
  org: string;
  money: boolean;
  dims: Record<string, string>;
}

const MEASURES: Record<string, MeasureDef> = {
  Members: {
    from: 'members m', value: 'COUNT(*)', date: 'm.created_at', org: 'm.org_id', money: false,
    dims: {
      Channel: "COALESCE(NULLIF(m.channel, ''), 'app')",
      Status: 'm.status',
      Month: "to_char(date_trunc('month', m.created_at), 'Mon YYYY')",
    },
  },
  Enrolments: {
    from: 'enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id JOIN members mm ON e.member_id = mm.id',
    value: 'COUNT(*)', date: 'e.enrolled_at', org: 'e.org_id', money: false,
    dims: {
      Plan: 'pl.name',
      Status: 'e.payment_status',
      Channel: "COALESCE(NULLIF(mm.channel, ''), 'app')",
      Month: "to_char(date_trunc('month', e.enrolled_at), 'Mon YYYY')",
    },
  },
  Consultations: {
    from: 'consultations c JOIN members mm ON c.member_id = mm.id',
    value: 'COUNT(*)', date: 'c.created_at', org: 'c.org_id', money: false,
    dims: {
      Status: 'c.status',
      Channel: "COALESCE(NULLIF(c.channel, ''), 'app')",
      Month: "to_char(date_trunc('month', c.created_at), 'Mon YYYY')",
    },
  },
  Premium: {
    from: `enrolments e JOIN insurance_plans pl ON e.plan_id = pl.id ${planAssignmentJoin('e')}`,
    value: `COALESCE(SUM(${EFFECTIVE_PREMIUM}), 0)`, date: 'e.enrolled_at', org: 'e.org_id', money: true,
    dims: {
      Plan: 'pl.name',
      Status: 'e.payment_status',
      Month: "to_char(date_trunc('month', e.enrolled_at), 'Mon YYYY')",
    },
  },
  Claims: {
    from: 'claims cl JOIN members mm ON cl.member_id = mm.id LEFT JOIN insurance_plans pl ON cl.plan_id = pl.id',
    value: 'COUNT(*)', date: 'cl.created_at', org: 'cl.org_id', money: false,
    dims: {
      Status: 'cl.status',
      Plan: "COALESCE(pl.name, 'Unlinked')",
      Channel: "COALESCE(NULLIF(mm.channel, ''), 'app')",
      Month: "to_char(date_trunc('month', cl.created_at), 'Mon YYYY')",
    },
  },
};

// GET /analytics/query?measure=&dimension=&months=
export async function analyticsQuery(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const measureKey = String(req.query.measure || 'Members');
  const measure = MEASURES[measureKey] || MEASURES.Members;
  const m = measureKey in MEASURES ? measureKey : 'Members';

  let dimension = String(req.query.dimension || Object.keys(measure.dims)[0]);
  if (!(dimension in measure.dims)) dimension = Object.keys(measure.dims)[0];
  const dimExpr = measure.dims[dimension];

  const months = Math.min(Math.max(parseInt(String(req.query.months ?? '6'), 10) || 6, 1), 24);
  const orderBy = dimension === 'Month' ? 'MIN(' + measure.date + ') ASC' : 'value DESC';

  const sql = `
    SELECT ${dimExpr} AS label, ${measure.value}::numeric AS value
    FROM ${measure.from}
    WHERE ${measure.org} = $1 AND ${measure.date} >= NOW() - make_interval(months => $2)
    GROUP BY label
    ORDER BY ${orderBy}
    LIMIT 24`;

  const result = await query(sql, [orgId, months]);
  const rows = result.rows.map((r) => ({ label: r.label ?? '—', value: Number(r.value) }));
  const total = rows.reduce((a, b) => a + b.value, 0);

  res.json({ measure: m, dimension, money: measure.money, rows, total });
}

// Expose the option lists so the client builder stays in sync with the server.
export function analyticsQueryOptions(_req: Request, res: Response): void {
  res.json({
    measures: Object.keys(MEASURES).map((k) => ({ key: k, money: MEASURES[k].money, dimensions: Object.keys(MEASURES[k].dims) })),
  });
}
