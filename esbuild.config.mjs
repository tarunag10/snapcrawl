import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['playwright', 'ffmpeg-static'],
  outdir: 'dist',
};

await build({
  ...shared,
  entryPoints: [
    'scripts/capture-from-config.js',
    'scripts/record-workflow.js',
  ],
});

console.log('Build complete: dist/capture-from-config.js, dist/record-workflow.js');
