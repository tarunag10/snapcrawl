import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['playwright', 'ffmpeg-static', '@modelcontextprotocol/sdk'],
  outdir: 'dist',
};

await build({
  ...shared,
  entryPoints: [
    'scripts/capture-from-config.js',
    'scripts/record-workflow.js',
    'scripts/create-snapcrawl.js',
    'scripts/mcp-server.js',
  ],
});

console.log('Build complete: dist/capture-from-config.js, dist/record-workflow.js, dist/create-snapcrawl.js, dist/mcp-server.js');
