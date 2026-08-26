import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import type { DetectionProvider, DetectionOptions, RawDetection } from './provider';

export class CocoSsdProvider implements DetectionProvider {
  name = 'local';
  modelName = 'coco-ssd';
  modelVersion = '2.2.3';
  private model: cocoSsd.ObjectDetection | null = null;
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    if (this.model) return Promise.resolve();
    if (!this.loading) {
      this.loading = tf.ready().then(() => cocoSsd.load()).then((m) => { this.model = m; });
    }
    return this.loading;
  }

  async detect(image: HTMLImageElement, options: DetectionOptions): Promise<RawDetection[]> {
    await this.load();
    if (!this.model) throw new Error('MODEL_LOAD_FAILED');
    const predictions = await this.model.detect(image, options.maxDetections);
    return predictions
      .filter((p) => p.score >= options.minConfidence)
      .map((p) => ({
        type: p.class,
        confidence: Number(p.score.toFixed(3)),
        bbox: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] },
      }));
  }
}
