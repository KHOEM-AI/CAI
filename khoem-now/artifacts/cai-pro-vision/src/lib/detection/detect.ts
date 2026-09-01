import { CocoSsdProvider } from './providers/coco-ssd-provider';
import { buildDetectionResult } from './normalize';
import type { DetectionResult } from './types';

// Single cached provider instance — the model loads once, not per scan.
const provider = new CocoSsdProvider();
const MAX_DETECTIONS = 100;

export async function detectObjects(
  image: HTMLImageElement,
  minConfidence = 0.45,
): Promise<DetectionResult> {
  const raw = await provider.detect(image, { minConfidence, maxDetections: MAX_DETECTIONS });
  return buildDetectionResult(raw, {
    reachedLimit: raw.length >= MAX_DETECTIONS,
    modelName: provider.modelName,
    modelProvider: provider.name,
    modelVersion: provider.modelVersion,
  });
}
