export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DetectionStatus =
  | 'idle'
  | 'loading'
  | 'analyzing'
  | 'success'
  | 'low_confidence'
  | 'partial'
  | 'needs_verification'
  | 'failed';

export type DetectionSource = 'local' | 'cloud' | 'hybrid';

export type NotesCode =
  | 'NONE'
  | 'NO_OBJECTS'
  | 'LOW_CONFIDENCE'
  | 'DETECTION_LIMIT_REACHED'
  | 'PARTIAL_DETECTION'
  | 'NEEDS_VERIFICATION'
  | 'MODEL_LOAD_FAILED'
  | 'IMAGE_LOAD_FAILED';

// Individual detected object — bbox is never discarded.
export interface ObjectDetection {
  id: string;
  type: string;
  confidence: number;
  bbox: BoundingBox;
  source: DetectionSource;
  verified: boolean;
}

// Grouped summary per object type.
export interface DetectionGroup {
  type: string;
  count: number;
  averageConfidence: number;
  verifiedCount?: number;
}

export interface EstimatedRange {
  min: number;
  max: number;
}

export interface DetectionModelInfo {
  provider: string;
  modelName: string;
  modelVersion?: string;
}

export interface DetectionResult {
  totalCount: number;
  detections: ObjectDetection[];
  groups: DetectionGroup[];
  estimated: boolean;
  estimatedRange?: EstimatedRange;
  status: DetectionStatus;
  confidence: number;
  notesCode: NotesCode;
  source: DetectionSource;
  model: DetectionModelInfo;
  requiresVerification: boolean;
}
