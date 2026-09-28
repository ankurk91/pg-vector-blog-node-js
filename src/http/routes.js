import { Router } from 'express';
import { parseSimilarParams } from '#src/http/validate.js';
import { findSimilar } from '#src/services/similar.js';

export const router = Router();

router.get('/posts/:id/similar', async (req, res) => {
  const { id, limit } = parseSimilarParams(req.params, req.query);
  res.json(await findSimilar({ id, limit }));
});
