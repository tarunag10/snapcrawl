const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { sanitizeSegment } = require('./shared');

const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, fullPage: true },
  { name: 'mobile', width: 430, height: 932, fullPage: false },
];

function discoverStoriesFromIndex(index) {
  const entries = index.entries || index.stories || {};
  return Object.entries(entries)
    .filter(([, entry]) => (entry.type || 'story') === 'story')
    .map(([id, entry]) => {
      const story = {
        id: entry.id || id,
        title: entry.title || 'Story',
        name: entry.name || entry.story || entry.id || id,
      };
      if (entry.importPath || entry.componentPath) story.importPath = entry.importPath || entry.componentPath;
      if (Array.isArray(entry.tags)) story.tags = entry.tags;
      return story;
    })
    .sort((a, b) => `${a.title} ${a.name}`.localeCompare(`${b.title} ${b.name}`));
}

function changedFilesSince(ref, cwd = process.cwd()) {
  if (!ref) return [];
  const result = spawnSync('git', ['diff', '--name-only', `${ref}...HEAD`], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function filterStories(stories, options = {}) {
  let filtered = [...stories];
  const include = String(options.include || '').trim().toLowerCase();
  const tag = String(options.tag || '').trim().toLowerCase();
  const changed = Array.isArray(options.changedFiles)
    ? options.changedFiles
    : changedFilesSince(options.changedFrom, options.cwd);

  if (include) {
    filtered = filtered.filter((story) => (
      `${story.id} ${story.title} ${story.name}`.toLowerCase().includes(include)
    ));
  }

  if (tag) {
    filtered = filtered.filter((story) => (
      story.tags || []
    ).map((item) => String(item).toLowerCase()).includes(tag));
  }

  if (changed.length > 0) {
    const changedSet = new Set(changed.map((file) => file.replace(/\\/g, '/')));
    filtered = filtered.filter((story) => {
      const importPath = String(story.importPath || '').replace(/\\/g, '/');
      return importPath && (
        changedSet.has(importPath) ||
        [...changedSet].some((file) => importPath.endsWith(file) || file.endsWith(importPath))
      );
    });
  }

  return filtered;
}

function storybookIframeUrl(baseUrl, storyId) {
  const url = new URL('iframe.html', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  url.searchParams.set('id', storyId);
  return url.toString();
}

function fileNameForStory(story, viewport) {
  const prefix = sanitizeSegment(`${story.title}-${story.name}`) || sanitizeSegment(story.id);
  return `${prefix}-${sanitizeSegment(viewport.name) || 'viewport'}.png`;
}

function storybookCaptureConfig({ baseUrl, stories, outputDir = 'output/storybook', viewports = DEFAULT_VIEWPORTS }) {
  const scenarios = [];
  for (const story of stories) {
    for (const viewport of viewports) {
      scenarios.push({
        name: `${story.title} / ${story.name} (${viewport.name})`,
        file: fileNameForStory(story, viewport),
        viewport,
        fullPage: Boolean(viewport.fullPage),
        steps: [
          { type: 'goto', url: storybookIframeUrl(baseUrl, story.id) },
          { type: 'wait', ms: 300 },
        ],
      });
    }
  }
  return {
    projectName: 'Storybook',
    baseUrl,
    outputDir,
    browser: 'chromium',
    browserChannel: 'auto',
    waitUntil: 'networkidle',
    scenarios,
  };
}

async function loadStorybookIndex(baseUrl, fetchImpl = fetch) {
  const candidates = ['index.json', 'stories.json'];
  for (const candidate of candidates) {
    const url = new URL(candidate, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    const response = await fetchImpl(url);
    if (response.ok) return response.json();
  }
  throw new Error(`Could not find Storybook index.json or stories.json at ${baseUrl}`);
}

async function writeStorybookConfig(options = {}) {
  const baseUrl = options.baseUrl;
  if (!baseUrl) throw new Error('Storybook baseUrl is required');
  const index = options.index || await loadStorybookIndex(baseUrl, options.fetchImpl);
  const stories = filterStories(discoverStoriesFromIndex(index), options)
    .slice(0, Number(options.maxStories || 500));
  const config = storybookCaptureConfig({
    baseUrl,
    stories,
    outputDir: options.outputDir || 'output/storybook',
    viewports: options.viewports || DEFAULT_VIEWPORTS,
  });
  const configPath = options.configPath || path.join(process.cwd(), '.snapcrawl-storybook.config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return { configPath, stories, config };
}

module.exports = {
  discoverStoriesFromIndex,
  filterStories,
  loadStorybookIndex,
  storybookCaptureConfig,
  storybookIframeUrl,
  writeStorybookConfig,
};
