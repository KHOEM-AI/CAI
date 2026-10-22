import type { RawDetection } from './providers/provider';
import type { DetectionGroup, DetectionResult, DetectionStatus, NotesCode, ObjectDetection } from './types';

let idCounter = 0;
function nextId() { idCounter += 1; return `det_${Date.now()}_${idCounter}`; }

export function buildDetectionResult(
  raw: RawDetection[],
  opts: { reachedLimit: boolean; modelName: string; modelProvider: string; modelVersion?: string },
): DetectionResult {
  const detections: ObjectDetection[] = raw.map((r) => ({
    id: nextId(),
    type: r.type,
    confidence: r.confidence,
    bbox: r.bbox,
    source: 'local',
    verified: false,
  }));

  const groupMap = new Map<string, { count: number; scoreSum: number }>();
  for (const d of detections) {
    const entry = groupMap.get(d.type) || { count: 0, scoreSum: 0 };
    entry.count += 1;
    entry.scoreSum += d.confidence;
    groupMap.set(d.type, entry);
  }
  const groups: DetectionGroup[] = Array.from(groupMap.entries())
    .map(([type, { count, scoreSum }]) => ({ type, count, averageConfidence: Number((scoreSum / count).toFixed(2)) }))
    .sort((a, b) => b.count - a.count);

  const totalCount = detections.length;
  const avgConfidence = detections.length
    ? Number((detections.reduce((s, d) => s + d.confidence, 0) / detections.length).toFixed(2))
    : 0;

  // Reaching the detection limit does NOT automatically mean the count
  // is wrong — it means we cannot be sure it's complete. Flag, don't fabricate.
  let status: DetectionStatus = 'success';
  let notesCode: NotesCode = 'NONE';
  let requiresVerification = false;
  let estimated = false;

  if (totalCount === 0) {
    notesCode = 'NO_OBJECTS';
  } else if (opts.reachedLimit) {
    status = 'partial';
    notesCode = 'DETECTION_LIMIT_REACHED';
    requiresVerification = true;
    estimated = true;
  } else if (avgConfidence < 0.75) {
    status = 'low_confidence';
    notesCode = 'LOW_CONFIDENCE';
    requiresVerification = true;
  }

  return {
    totalCount,
    detections,
    groups,
    estimated,
    status,
    confidence: avgConfidence,
    notesCode,
    source: 'local',
    model: { provider: opts.modelProvider, modelName: opts.modelName, modelVersion: opts.modelVersion },
    requiresVerification,
  };
}
