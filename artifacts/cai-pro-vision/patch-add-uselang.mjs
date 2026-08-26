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
  'import useLanguage',
  `import { LanguageProvider } from '@/contexts/LanguageContext';`,
  `import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';`
);

safeReplace(
  'add useLanguage to SignIn',
  `function SignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {`,
  `function SignIn({ onSignedIn }: { onSignedIn: (user: User) => void }) {\n  const { t } = useLanguage();`
);

safeReplace(
  'add useLanguage to ScanWorkspace',
  `function ScanWorkspace({ user, healthStatus }: { user: User; healthStatus?: string }) {`,
  `function ScanWorkspace({ user, healthStatus }: { user: User; healthStatus?: string }) {\n  const { t } = useLanguage();`
);

safeReplace(
  'add useLanguage to SettingsPage',
  `function SettingsPage({ user }: { user: User }) {`,
  `function SettingsPage({ user }: { user: User }) {\n  const { t } = useLanguage();`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. ${changes} changes applied.`);
