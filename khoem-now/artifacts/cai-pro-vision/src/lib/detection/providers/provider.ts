import type { BoundingBox } from '../types';

// Raw output before app-level normalization (IDs, source tag, etc).
export interface RawDetection {
  type: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface DetectionOptions {
  minConfidence: number;
  maxDetections: number;
}

export interface DetectionProvider {
  name: string;
  modelName: string;
  modelVersion?: string;
  load(): Promise<void>;
  detect(image: HTMLImageElement, options: DetectionOptions): Promise<RawDetection[]>;
}
