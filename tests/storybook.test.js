const assert = require('node:assert/strict');
const test = require('node:test');

const {
  discoverStoriesFromIndex,
  storybookCaptureConfig,
  storybookIframeUrl,
} = require('../lib/storybook');

test('discoverStoriesFromIndex returns only story entries with stable names', () => {
  const stories = discoverStoriesFromIndex({
    entries: {
      'button--primary': { type: 'story', title: 'Components/Button', name: 'Primary' },
      'button--docs': { type: 'docs', title: 'Components/Button', name: 'Docs' },
      'card--empty': { type: 'story', title: 'Components/Card', name: 'Empty State' },
    },
  });

  assert.deepEqual(stories, [
    { id: 'button--primary', title: 'Components/Button', name: 'Primary' },
    { id: 'card--empty', title: 'Components/Card', name: 'Empty State' },
  ]);
});

test('storybookCaptureConfig builds scenario captures for Storybook iframes', () => {
  const config = storybookCaptureConfig({
    baseUrl: 'http://localhost:6006',
    stories: [{ id: 'button--primary', title: 'Components/Button', name: 'Primary' }],
    outputDir: 'output/storybook',
    viewports: [{ name: 'desktop', width: 1440, height: 900, fullPage: true }],
  });

  assert.equal(config.baseUrl, 'http://localhost:6006');
  assert.equal(config.scenarios.length, 1);
  assert.equal(config.scenarios[0].file, 'components-button-primary-desktop.png');
  assert.deepEqual(config.scenarios[0].steps[0], {
    type: 'goto',
    url: 'http://localhost:6006/iframe.html?id=button--primary',
  });
  assert.equal(storybookIframeUrl('http://localhost:6006/', 'card--empty'), 'http://localhost:6006/iframe.html?id=card--empty');
});
