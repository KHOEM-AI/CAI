import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Staff: មើលតែប្រវត្តិខ្លួនឯង
router.get('/history', authenticate, async (req, res) => {
  // TODO: បន្តភ្ជាប់ scan_records table — query WHERE operator_id = req.user.sub
  res.json({ note: 'stub — replace with real query filtered by req.user.sub', userId: req.user!.sub });
});

// Admin+: មើលប្រវត្តិទាំងអស់ (មិនកំណត់ operator)
router.get('/history/all', authenticate, requireRole('admin'), async (_req, res) => {
  // TODO: បន្តភ្ជាប់ scan_records table — គ្មាន WHERE operator_id
  res.json({ note: 'stub — replace with real query, no operator filter' });
});

export default router;
