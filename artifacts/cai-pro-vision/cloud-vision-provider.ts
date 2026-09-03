import type { DetectionProvider, DetectionOptions, RawDetection } from '../provider';

export class CloudVisionProvider implements DetectionProvider {
  name = 'cloud';
  modelName = 'google-cloud-vision';
  modelVersion = 'v1';

  async detect(image: HTMLImageElement, options: DetectionOptions): Promise<RawDetection[]> {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('IMAGE_LOAD_FAILED');
    ctx.drawImage(image, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg').split(',')[1];

    const res = await fetch('/api/v1/scan/cloud-detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    if (!res.ok) throw new Error('MODEL_LOAD_FAILED');
    const data = await res.json();

    return (data.objects || [])
      .filter((o: any) => o.score >= options.minConfidence)
      .slice(0, options.maxDetections)
      .map((o: any) => ({
        type: o.name,
        confidence: Number(o.score.toFixed(3)),
        bbox: o.bbox,
      }));
  }
      }
