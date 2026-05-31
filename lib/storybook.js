const fs = require('fs');
const path = require('path');
const { sanitizeSegment } = require('./shared');

const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, fullPage: true },
  { name: 'mobile', width: 430, height: 932, fullPage: false },
];

function discoverStoriesFromIndex(index) {
  const entries = index.entries || index.stories || {};
  return Object.entries(entries)
    .filter(([, entry]) => (entry.type || 'story') === 'story')
    .map(([id, entry]) => ({
      id: entry.id || id,
      title: entry.title || 'Story',
      name: entry.name || entry.story || entry.id || id,
    }))
    .sort((a, b) => `${a.title} ${a.name}`.localeCompare(`${b.title} ${b.name}`));
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
  const stories = discoverStoriesFromIndex(index).slice(0, Number(options.maxStories || 500));
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
  loadStorybookIndex,
  storybookCaptureConfig,
  storybookIframeUrl,
  writeStorybookConfig,
};
