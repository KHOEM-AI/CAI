import fs from 'fs';
const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

function safeReplace(label, oldStr, newStr) {
  if (!content.includes(oldStr)) { console.error(`ABORT: pattern not found for "${label}"`); process.exit(1); }
  const count = content.split(oldStr).length - 1;
  if (count > 1) { console.error(`ABORT: pattern for "${label}" is not unique (${count} matches)`); process.exit(1); }
  content = content.replace(oldStr, newStr);
  changes++;
  console.log(`OK: applied "${label}"`);
}

safeReplace(
  'email label',
  `<span className="mb-2 block text-xs font-bold">អ៊ីមែល <span className="font-normal text-muted-foreground">/ Work email</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('email_label')}</span>`
);

safeReplace(
  'password label',
  `<span className="mb-2 block text-xs font-bold">ពាក្យសម្ងាត់ <span className="font-normal text-muted-foreground">/ Password</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('password_label')}</span>`
);

safeReplace(
  'take photo button',
  `ថតរូបភាព <span className="font-normal text-muted-foreground">/ Take photo</span>`,
  `{t('take_photo')}`
);

safeReplace(
  'choose camera hint',
  `សូមជ្រើសរើស Camera ក្នុងបញ្ជីដែលបង្ហាញ <span className="font-normal">/ Choose Camera from the picker</span>`,
  `{t('choose_camera_hint')}`
);

safeReplace(
  'category label',
  `<span className="mb-2 block text-xs font-bold">ប្រភេទ <span className="font-normal text-muted-foreground">/ Category</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('category_label')}</span>`
);

safeReplace(
  'batch id label',
  `<span className="mb-2 block text-xs font-bold">លេខបាច់ <span className="font-normal text-muted-foreground">/ Batch ID</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('batch_id_label')}</span>`
);

safeReplace(
  'total count label',
  `<span className="mb-2 block text-xs font-bold">ចំនួនសរុប <span className="font-normal text-muted-foreground">/ Total count</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('total_count_label')}</span>`
);

safeReplace(
  'detected types label',
  `<span className="mb-2 block text-xs font-bold">ប្រភេទដែលរកឃើញ <span className="font-normal text-muted-foreground">/ Detected types</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('detected_types_label')}</span>`
);

safeReplace(
  'gps location header',
  `<h2 className="text-sm font-extrabold">ទីតាំង GPS <span className="font-normal text-muted-foreground">/ Location</span></h2>`,
  `<h2 className="text-sm font-extrabold">{t('location_label')}</h2>`
);

safeReplace(
  'confirm data checkbox label',
  `<span>ខ្ញុំបញ្ជាក់ថាទិន្នន័យខាងលើត្រឹមត្រូវ <span className="text-muted-foreground">/ I confirm the data above is accurate</span></span>`,
  `<span>{t('confirm_data_label')}</span>`
);

safeReplace(
  'working radius label',
  `<span className="mb-2 block text-xs font-bold">Working radius <span className="font-normal text-muted-foreground">/ metres</span></span>`,
  `<span className="mb-2 block text-xs font-bold">{t('working_radius_label')} <span className="font-normal text-muted-foreground">/ {t('metres_unit')}</span></span>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. ${changes} changes applied.`);
