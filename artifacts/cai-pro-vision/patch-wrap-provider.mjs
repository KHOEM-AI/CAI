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
  'import LanguageProvider',
  `import { translateLabel } from '@/lib/detection/labels';`,
  `import { translateLabel } from '@/lib/detection/labels';\nimport { LanguageProvider } from '@/contexts/LanguageContext';`
);

safeReplace(
  'wrap App with LanguageProvider',
  `function App() {\n  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;\n}`,
  `function App() {\n  return <LanguageProvider><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\\/$/, '')}><ErrorBoundary><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider></LanguageProvider>;\n}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. ${changes} changes applied.`);
