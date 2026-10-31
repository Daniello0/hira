// Copies the voice-activity model and its runtime next to the app. They are too large for git.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vad');
const vadDist = dirname(require.resolve('@ricky0123/vad-web'));
const ortDist = dirname(require.resolve('onnxruntime-web'));

mkdirSync(target, { recursive: true });
for (const file of ['silero_vad_v5.onnx', 'vad.worklet.bundle.min.js']) {
  copyFileSync(join(vadDist, file), join(target, file));
}
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  copyFileSync(join(ortDist, file), join(target, file));
}
