import { Request, Response } from 'express';
import { query } from '../config/database';

export async function listPartners(req: Request, res: Response): Promise<void> {
  const { category } = req.query;
  if (category) {
    const result = await query(
      `SELECT * FROM partners WHERE category = $1 ORDER BY name`,
      [category]
    );
    res.json(result.rows);
    return;
  }
  const result = await query(`SELECT * FROM partners ORDER BY category, name`);
  res.json(result.rows);
}
