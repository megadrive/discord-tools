'use strict'

const PointsStrategyJSON = require('./points.strategy-json')

class Points {
  constructor (strategy, opts) {
    this.strategy = strategy

    this.cached = new Map()

    this.opts = {
      saveAfterModify: true
    }
    for (let key in opts) {
      this.opts[key] = opts[key]
    }

    if (strategy) {
      strategy.load()
        .then(pointsDatabase => {
          this.cached = new Map(Array.from(pointsDatabase.data))
        })
    }
  }

  sync () {
    if (this.strategy) {
      return this.strategy.save(Array.from(this.cached))
    }

    return Promise.reject(Error('No strategy set.'))
  }

  add (discordId, pointsToAdd) {
    console.log('before', this.cached)
    if (this.cached.has(discordId)) {
      this.cached.set(discordId, this.cached.get(discordId) + pointsToAdd)
    } else {
      this.cached.set(discordId, pointsToAdd)
    }
    if (this.opts.saveAfterModify) this.sync()
    console.log('after', this.cached)
    return Promise.resolve(this.cached.get(discordId))
  }

  get (discordId) {
    let rv = null
    if (this.cached.has(discordId)) {
      rv = Promise.resolve(this.cached.get(discordId))
    } else {
      rv = Promise.resolve(0)
    }
    return rv
  }
}

module.exports = Points
