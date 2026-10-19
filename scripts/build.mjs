import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'styles.css', 'manifest.webmanifest', 'app', 'assets']) await cp(path.join(root, file), path.join(dist, file), { recursive: true });
const files = [];
async function walk(dir, rel = '') {
  for (const entry of (await readdir(dir)).sort()) {
    const name = path.posix.join(rel, entry), absolute = path.join(dir, entry);
    if ((await stat(absolute)).isDirectory()) await walk(absolute, name); else files.push(name);
  }
}
await walk(dist);
const hash = createHash('sha256'); for (const file of files) { hash.update(file); hash.update(await readFile(path.join(dist, file))); }
const fingerprint = hash.digest('hex').slice(0, 14);
const source = (await readFile(path.join(root, 'scripts/sw-template.js'), 'utf8')).replace('__CACHE_VERSION__', fingerprint).replace('__PRECACHE_FILES__', JSON.stringify(files));
await writeFile(path.join(dist, 'sw.js'), source);
await writeFile(path.join(root, 'sw.js'), source);
await writeFile(path.join(dist, '.nojekyll'), '');
await writeFile(path.join(root, 'docs/build-info.json'), JSON.stringify({ version: '1.0.0', fingerprint, files: [...files, 'sw.js'], totalBytes: (await Promise.all(files.map(f => stat(path.join(dist, f))))).reduce((n, f) => n + f.size, Buffer.byteLength(source)) }, null, 2) + '\n');
console.log(`RITUA 1.0.0: ${files.length + 1} files → dist/ (${fingerprint})`);
