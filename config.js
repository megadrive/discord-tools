
const yaml = require('js-yaml')
const fs = require('mz/fs')
const path = require('path')

/**
 * Returns an object with global and directory-specific keys merged.
 * @param {*} otherConfig The other config file.
 */
function generateConfig (otherConfig) {
  const global = fs.readFileSync(path.join(__dirname, 'global.yml'), 'utf8')
  const other = otherConfig ? fs.readFileSync(otherConfig, 'utf8') : ''

  const together = global + '\n' + other
  return yaml.safeLoad(together, { json: true })
}

module.exports = generateConfig
