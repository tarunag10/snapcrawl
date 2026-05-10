const { safeJoin } = require('./safety');

function resolveConfigPathForTool(configPath = 'capture-config.json', cwd = process.cwd()) {
  return safeJoin(cwd, configPath, 'configPath');
}

module.exports = {
  resolveConfigPathForTool,
};
