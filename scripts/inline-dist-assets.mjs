import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');
const indexPath = join(distDir, 'index.html');

let html = await readFile(indexPath, 'utf8');
const filesToRemove = [];

html = await replaceAsync(
  html,
  /<link rel="stylesheet" crossorigin href="(\.\/assets\/[^"]+\.css)">/g,
  async (_match, href) => {
    const assetPath = join(distDir, href);
    const css = await readFile(assetPath, 'utf8');
    filesToRemove.push(assetPath);

    return `<style>\n${css}\n</style>`;
  },
);

html = await replaceAsync(
  html,
  /<script type="module" crossorigin src="(\.\/assets\/[^"]+\.js)"><\/script>/g,
  async (_match, src) => {
    const assetPath = join(distDir, src);
    const js = await readFile(assetPath, 'utf8');
    filesToRemove.push(assetPath);

    return `<script type="module">\n${js}\n</script>`;
  },
);

await writeFile(indexPath, html);

await Promise.all(filesToRemove.map((file) => rm(file, { force: true })));

async function replaceAsync(value, pattern, replacer) {
  const matches = [...value.matchAll(pattern)];
  let output = value;

  for (const match of matches.reverse()) {
    const replacement = await replacer(...match);
    output = `${output.slice(0, match.index)}${replacement}${output.slice(match.index + match[0].length)}`;
  }

  return output;
}
