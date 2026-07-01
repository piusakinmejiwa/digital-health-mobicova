import { Request, Response } from 'express';
import { query } from '../config/database';
import { runTriage, TriageMessage } from '../services/triage.service';

export async function listTriageSessions(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const result = await query(
    `SELECT t.id, t.triage_level, t.recommendation, t.engine, t.created_at, t.updated_at,
            m.full_name AS member_name, m.id AS member_id
     FROM triage_sessions t
     LEFT JOIN members m ON t.member_id = m.id
     WHERE t.org_id = $1 ORDER BY t.updated_at DESC`,
    [orgId]
  );
  res.json(result.rows);
}

export async function getTriageSession(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { id } = req.params;
  const result = await query(
    `SELECT t.*, m.full_name AS member_name
     FROM triage_sessions t LEFT JOIN members m ON t.member_id = m.id
     WHERE t.id = $1 AND t.org_id = $2`,
    [id, orgId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Triage session not found' });
    return;
  }
  res.json(result.rows[0]);
}

// Send a message to the assistant. Creates a session on first message, otherwise
// continues an existing one. Returns the updated session including the AI reply.
export async function sendTriageMessage(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { sessionId, memberId, message } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  let session;
  if (sessionId) {
    const existing = await query(
      `SELECT * FROM triage_sessions WHERE id = $1 AND org_id = $2`,
      [sessionId, orgId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Triage session not found' });
      return;
    }
    session = existing.rows[0];
  } else {
    // If the caller attaches a member, that member MUST belong to their org —
    // otherwise a staff user could reference another tenant's member id and pull
    // that member's clinical profile into the AI context below.
    let linkedMemberId: string | null = null;
    if (memberId) {
      const owned = await query(
        `SELECT id FROM members WHERE id = $1 AND org_id = $2`,
        [memberId, orgId]
      );
      if (owned.rows.length === 0) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      linkedMemberId = owned.rows[0].id;
    }
    const created = await query(
      `INSERT INTO triage_sessions (org_id, member_id, messages) VALUES ($1, $2, '[]') RETURNING *`,
      [orgId, linkedMemberId]
    );
    session = created.rows[0];
  }

  let member;
  if (session.member_id) {
    // Defence-in-depth: re-scope the PHI fetch to the caller's org, never id alone.
    const m = await query(
      `SELECT full_name, gender, date_of_birth, allergies, chronic_conditions, current_medications
       FROM members WHERE id = $1 AND org_id = $2`,
      [session.member_id, orgId]
    );
    if (m.rows.length > 0) {
      const r = m.rows[0];
      member = {
        fullName: r.full_name,
        gender: r.gender,
        dateOfBirth: r.date_of_birth,
        allergies: r.allergies,
        chronicConditions: r.chronic_conditions,
        currentMedications: r.current_medications,
      };
    }
  }

  const history: TriageMessage[] = Array.isArray(session.messages) ? session.messages : [];
  history.push({ role: 'user', content: message });

  const result = await runTriage(history, member);
  history.push({ role: 'assistant', content: result.reply });

  const updated = await query(
    `UPDATE triage_sessions SET
       messages = $2, triage_level = $3, recommendation = $4, engine = $5, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [session.id, JSON.stringify(history), result.triageLevel, result.recommendation, result.engine]
  );

  res.json(updated.rows[0]);
}
