import { spawnSync } from 'node:child_process';

const entryPoints = [
  'scripts/snapcrawl.js',
  'scripts/capture-from-config.js',
  'scripts/record-workflow.js',
  'scripts/create-snapcrawl.js',
  'scripts/mcp-server.js',
];

const result = spawnSync(
  './node_modules/.bin/esbuild',
  [
    ...entryPoints,
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node18',
    '--external:playwright',
    '--external:ffmpeg-static',
    '--external:@modelcontextprotocol/sdk',
    '--outdir=dist',
  ],
  { stdio: 'inherit' }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('Build complete: dist/snapcrawl.js, dist/capture-from-config.js, dist/record-workflow.js, dist/create-snapcrawl.js, dist/mcp-server.js');
