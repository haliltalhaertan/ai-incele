import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extension = path.join(root, 'extension');
const manifest = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(manifest.manifest_version === 3, 'Manifest V3 required');
assert(manifest.version === '0.4.0', 'Unexpected version');
assert(manifest.description.length <= 132, 'Description too long');
assert(JSON.stringify(manifest.permissions) === JSON.stringify(['alarms', 'storage']), 'Unexpected permissions');
const allowed = new Set(['https://outlook.cloud.microsoft/*', 'https://outlook.office.com/*', 'https://outlook.office365.com/*', 'https://chatgpt.com/*', 'https://claude.ai/*']);
const actual = manifest.content_scripts.flatMap(item => item.matches);
assert(actual.length === allowed.size && actual.every(item => allowed.has(item)), 'Unexpected site access');
const references = new Set([manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(item => item.js)]);
for (const file of references) {
  const absolute = path.resolve(extension, file);
  assert(absolute.startsWith(extension + path.sep), 'Invalid package path');
  await fs.access(absolute);
  if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', absolute], {encoding: 'utf8'});
    assert(result.status === 0, file + ': ' + result.stderr);
  }
}
for (const size of [16, 32, 48, 128]) {
  const bytes = await fs.readFile(path.join(extension, manifest.icons[String(size)]));
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG icon');
  assert(bytes.readUInt32BE(16) === size && bytes.readUInt32BE(20) === size, 'Unexpected icon dimensions');
}
const zip = await fs.readFile(path.join(root, 'downloads/ai-incele-chrome-v0.4.0.zip'));
const expected = (await fs.readFile(path.join(root, 'downloads/SHA256SUMS.txt'), 'utf8')).trim().split(/\s+/)[0];
const actualHash = crypto.createHash('sha256').update(zip).digest('hex');
assert(expected === actualHash, 'ZIP checksum mismatch');
assert(zip.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])), 'Invalid ZIP signature');
console.log('PASS: manifest, site scope, source syntax, icon dimensions and ZIP SHA-256.');
