'use strict'

const jsonfile = require('jsonfile')
const fs = require('fs')

class PointsStrategyJSON {
  constructor (file) {
    this.file = file || 'pointsDatabase.json'
  }

  load () {
    console.log('loading from json file')
    try {
      fs.accessSync(this.file)
    } catch (err) {
      console.error(`Error occurred, writing a new database file at ${this.file}`)
      fs.writeFileSync(this.file, '{"data":[]}', { encoding: 'utf8' })
    }

    return jsonfile.readFile(this.file)
  }

  save (data) {
    console.log('saving to local json file')
    return jsonfile.writeFile(this.file, {data})
  }
}

module.exports = PointsStrategyJSON
