const fs = require('fs');
const path = require('path');
const ts = require('/home/claude/.npm-global/lib/node_modules/typescript');

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}
walk('/home/claude/cai-check/frontend');
walk('/home/claude/cai-check/backend');

let totalErrors = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  // Collect syntax diagnostics only (parse errors), no type checking / no module resolution needed
  const diagnostics = sourceFile['parseDiagnostics'] || [];
  if (diagnostics.length === 0) {
    console.log(`OK   ${path.relative('/home/claude/cai-check', file)}`);
  } else {
    totalErrors += diagnostics.length;
    console.log(`FAIL ${path.relative('/home/claude/cai-check', file)}`);
    for (const d of diagnostics) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
      console.log(`   line ${line + 1}, col ${character + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    }
  }
}
console.log(`\n${files.length} files checked, ${totalErrors} syntax error(s).`);
