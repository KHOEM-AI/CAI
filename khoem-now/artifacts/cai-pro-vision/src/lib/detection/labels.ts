export type Lang = 'kh' | 'en' | 'zh';

const LABELS: Record<string, Record<Lang, string>> = {
  person: { kh: 'មនុស្ស', en: 'Person', zh: '人' },
  bicycle: { kh: 'កង់', en: 'Bicycle', zh: '自行车' },
  car: { kh: 'រថយន្ត', en: 'Car', zh: '汽车' },
  bus: { kh: 'ឡានក្រុង', en: 'Bus', zh: '公交车' },
  truck: { kh: 'ឡានដឹកទំនិញ', en: 'Truck', zh: '卡车' },
  bottle: { kh: 'ដប', en: 'Bottle', zh: '瓶子' },
  cup: { kh: 'ពែង', en: 'Cup', zh: '杯子' },
  banana: { kh: 'ចេក', en: 'Banana', zh: '香蕉' },
  apple: { kh: 'ផ្លែប៉ោម', en: 'Apple', zh: '苹果' },
  orange: { kh: 'ក្រូច', en: 'Orange', zh: '橙子' },
  chair: { kh: 'កៅអី', en: 'Chair', zh: '椅子' },
  'potted plant': { kh: 'ដើមឈើក្នុងខ្ទះ', en: 'Potted plant', zh: '盆栽' },
  backpack: { kh: 'កាបូបស្ពាយ', en: 'Backpack', zh: '背包' },
  handbag: { kh: 'កាបូប', en: 'Handbag', zh: '手提包' },
  suitcase: { kh: 'វ៉ាលី', en: 'Suitcase', zh: '手提箱' },
  cow: { kh: 'គោ', en: 'Cow', zh: '牛' },
  dog: { kh: 'ឆ្កែ', en: 'Dog', zh: '狗' },
  cat: { kh: 'ឆ្មា', en: 'Cat', zh: '猫' },
};

export function translateLabel(type: string, lang: Lang): string {
  return LABELS[type]?.[lang] ?? type;
}

export const NOTES_TEXT: Record<string, Record<Lang, string>> = {
  NONE: { kh: '', en: '', zh: '' },
  NO_OBJECTS: {
    kh: 'រកមិនឃើញវត្ថុណាមួយក្នុងរូបភាពនេះទេ។',
    en: 'No recognizable objects were detected in this image.',
    zh: '未检测到可识别的物体。',
  },
  LOW_CONFIDENCE: {
    kh: 'ភាពជឿជាក់ទាប — សូមផ្ទៀងផ្ទាត់ដោយដៃ។',
    en: 'Low confidence — manual verification recommended.',
    zh: '置信度较低——建议人工核实。',
  },
  DETECTION_LIMIT_REACHED: {
    kh: 'វត្ថុច្រើនពេក — លទ្ធផលអាចជាការប៉ាន់ស្មាន។',
    en: 'Many objects detected — result may be an estimate.',
    zh: '检测到大量物体——结果可能为估算值。',
  },
  PARTIAL_DETECTION: { kh: 'ស្កេនមិនពេញលេញ។', en: 'Partial detection.', zh: '检测不完整。' },
  NEEDS_VERIFICATION: { kh: 'ត្រូវការផ្ទៀងផ្ទាត់ដោយដៃ។', en: 'Needs manual verification.', zh: '需要人工核实。' },
  MODEL_LOAD_FAILED: { kh: 'AI មិនអាចផ្ទុកបានទេ។', en: 'AI model failed to load.', zh: 'AI模型加载失败。' },
  IMAGE_LOAD_FAILED: { kh: 'រូបភាពមិនអាចបើកបានទេ។', en: 'Image failed to load.', zh: '图片加载失败。' },
};
