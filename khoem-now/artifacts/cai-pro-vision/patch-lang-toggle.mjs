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

safeReplace('add useLanguage to Sidebar', `function Sidebar({ user, onLogout }: { user: User; onLogout: () => void }) {\n  const [location] = useLocation();`, `function Sidebar({ user, onLogout }: { user: User; onLogout: () => void }) {\n  const [location] = useLocation();\n  const { language, setLanguage } = useLanguage();`);
safeReplace('add language toggle button before admin/user block', `    <div className="mt-auto">\n      {user.role === 'admin' && <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">`, `    <div className="mt-auto">\n      <button onClick={() => setLanguage(language === 'km' ? 'en' : 'km')} data-testid="button-language-toggle" className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-[12px] font-bold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70">\n        <Globe2 size={15} /> {language === 'km' ? 'English' : 'ខ្មែរ'}\n      </button>\n      {user.role === 'admin' && <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">`);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. ${changes} changes applied.`);
