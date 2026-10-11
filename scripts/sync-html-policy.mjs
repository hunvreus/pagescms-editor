import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'registry/default/editor/html-policy.ts'), 'utf8');
const args = process.argv.slice(2);
const consumer = args.find(arg => !arg.startsWith('--'));
const targets = [resolve(root, 'src/components/ui/html-policy.ts'), resolve(root, 'public/r/registry/default/editor/html-policy.ts')];
if (consumer) targets.push(resolve(consumer, 'src/components/ui/editor/html-policy.ts'));
for (const target of targets) {
  if (args.includes('--check')) {
    if (readFileSync(target, 'utf8') !== source) throw new Error(`Editor HTML policy differs: ${target}`);
  } else {
    writeFileSync(target, source);
  }
}
const editor = readFileSync(resolve(root, 'registry/default/editor/editor.tsx'), 'utf8');
for (const target of [resolve(root, 'src/components/ui/editor.tsx'), resolve(root, 'public/r/registry/default/editor/editor.tsx')]) {
  if (args.includes('--check')) {
    if (readFileSync(target, 'utf8') !== editor) throw new Error(`Editor entry differs: ${target}`);
  } else writeFileSync(target, editor);
}
console.log('Editor HTML policy and entry copies match.');
