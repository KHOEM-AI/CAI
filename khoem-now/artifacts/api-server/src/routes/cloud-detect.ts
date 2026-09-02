// artifacts/api-server/src/routes/cloud-detect.ts
import { Router, type IRouter } from "express";
import type { Request, Response } from 'express';

const router: IRouter = Router();
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY || '';
const GOOGLE_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

router.post('/api/v1/scan/cloud-detect', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'MISSING_IMAGE' });
    }

    const visionRes = await fetch(GOOGLE_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'OBJECT_LOCALIZATION', maxResults: 50 }],
        }],
      }),
    });

    if (!visionRes.ok) {
      return res.status(502).json({ error: 'CLOUD_PROVIDER_FAILED' });
    }

    const data = await visionRes.json();
    const annotations = data.responses?.[0]?.localizedObjectAnnotations || [];
    const objects = annotations.map((obj: any) => ({
      name: obj.name,
      score: obj.score,
      bbox: {
        x: obj.boundingPoly.normalizedVertices[0]?.x ?? 0,
        y: obj.boundingPoly.normalizedVertices[0]?.y ?? 0,
        width: 0,
        height: 0,
      },
    }));

    res.json({ objects });
  } catch (err) {
    console.error('[cloud-detect]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
