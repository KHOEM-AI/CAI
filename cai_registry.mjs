// cai_registry.mjs — central data: roles of every Khoem project (single source of truth)
export const PROJECTS = [
  { id: "KI",        role: "API",                                 km: "ច្រកតភ្ជាប់ API" },
  { id: "AI",        role: "UI",                                  km: "ផ្ទាំងអ្នកប្រើ (UI)" },
  { id: "IQ-AI",     role: "Audio, video, images",                km: "សំឡេង វីដេអូ រូបភាព" },
  { id: "KSV",       role: "General electronic device control",   km: "បញ្ជាឧបករណ៍អេឡិចត្រូនិចទូទៅ" },
  { id: "EI-T",      role: "Numbers + scientific math",           km: "លេខ + គណិតវិទ្យាសាស្ត្រ" },
  { id: "khoem-now", role: "Colors and lights",                   km: "ពណ៌ និងអំពូល" },
  { id: "KHOEM_AI",  role: "Language and code",                   km: "ភាសា និងកូដ" },
  { id: "KEI",       role: "Keyboard + protection system",        km: "ក្ដារចុច + ប្រព័ន្ធការពារ" },
  { id: "CAI",       role: "Photo object counting + photo location scan", km: "ស្គេនរូបថតរាប់ចំនួន & ស្គែនរូបថតទីតាំង" },
];

// KEI home-screen layout taken from the UI mockup
export const CAI_UI = {
  brand: "KHOEM-AI",
  tagline: "Vision · Count · Locate",
  tabs: ["Camera", "360° Scan", "GPS"],
  features: ["Count", "Detect Objects", "360° Scan", "GPS Location", "Show on Map", "Photo Info"],
  actions: [
    { id: "camera",  label: "Open Camera",         sub: "Take a photo & AI scan (360°)" },
    { id: "gallery", label: "Choose from Gallery", sub: "Select photo & scan" },
    { id: "bulk",    label: "Bulk Scan",           sub: "Multi-Photo (360°)" },
  ],
  cards: [
    { id: "count",    label: "Object Counting", sub: "Detect and count objects from photo" },
    { id: "location", label: "Photo Location",  sub: "Get GPS location from photo" },
  ],
  nav: ["Home", "History", "Scan", "Results", "Settings"],
};

export const getProject = (id) => PROJECTS.find((p) => p.id.toLowerCase() === id.toLowerCase());

export function validate() {
  const ids = PROJECTS.map((p) => p.id);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) throw new Error("Duplicate project ids: " + dup.join(", "));
  return true;
}

// CLI: node cai_registry.mjs [id]
if (import.meta.url === `file://${process.argv[1]}`) {
  validate();
  const q = process.argv[2];
  const list = q ? [getProject(q)].filter(Boolean) : PROJECTS;
  if (!list.length) { console.error("Not found:", q); process.exit(1); }
  for (const p of list) console.log(`${p.id.padEnd(10)} ${p.role}  |  ${p.km}`);
}
