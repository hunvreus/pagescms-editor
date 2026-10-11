import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
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

for (const name of ['commands.ts', 'commands-list.tsx', 'suggestion.tsx']) {
  const source = readFileSync(resolve(root, 'registry/default/editor/slash-command', name), 'utf8');
  const targets = [resolve(root, 'src/components/ui/slash-command', name), resolve(root, 'public/r/registry/default/editor/slash-command', name)];
  for (const target of targets) {
    if (args.includes('--check')) {
      if (readFileSync(target, 'utf8') !== source) throw new Error(`Editor slash commands differ: ${target}`);
    } else writeFileSync(target, source);
  }
  if (consumer) {
    const target = resolve(consumer, 'src/components/ui/editor/slash-command', name);
    const prettier = createRequire(resolve(consumer, 'package.json'))('prettier');
    const config = await prettier.resolveConfig(target);
    const formatted = await prettier.format(source, { ...config, filepath: target });
    if (args.includes('--check')) {
      if (readFileSync(target, 'utf8') !== formatted) throw new Error(`Editor slash commands differ: ${target}`);
    } else writeFileSync(target, formatted);
  }
}
console.log('Editor HTML policy, entry, and slash command copies match.');
