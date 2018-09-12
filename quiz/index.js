'use strict'

const path = require('path')
const dayjs = require('dayjs')
const chalk = require('chalk')
const config = require('../config.js')(path.join(__dirname, 'config.yml'))
const axios = require('axios')
const _ = require('lodash')

const Discord = require('discord.js')
const discord = new Discord.Client()
discord.login(config.discord.token)

const Points = require('./points')
const PointsStrategyJSON = require('./points.strategy-json')
const points = new Points(new PointsStrategyJSON())

let globals = {
  started: false,
  current: {
    question: null,
    answer: null
  },
  timeoutId: null
}

const chatter = {
  start: `Starting quiz: {quizName} -- {quizDescription}`,
  ask: `What game is this? {gameName}`,
  confirmed: `{name} got it! They now have {points} points. Another question is on its way!`,
  quit: `Giving up? Fair enough. Stopping the questions.`,
  timeout: `Times up! The answer was {answer}!`,
  userPointsRequest: `{name}, you have {points} points.`
}

/**
 * Log a console message with a timestamp.
 *
 * @param {*} args
 */
function log (...args) {
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}]`, ...args)
}

/**
 * Log an error console message with a timestamp.
 *
 * @param {*} args
 */
function error (...args) {
  console.error(chalk.red(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}]`, ...args))
}

discord.on('ready', () => {
  log(`Logged in as ${discord.user.tag}, ready to quiz!`)
})

discord.on('message', message => {
  if (message.author.id === discord.user.id) return
  if (message.channel.id !== config.quiz.discord.channel) return

  function askQuestion () {
    message.channel.send(chatter.ask.replace('{gameName}', globals.current.question))
  }

  function newQuestion () {
    generateQuestion()
      .then(result => {
        globals.current = result
        globals.started = true
        globals.timeoutId = setTimeout(() => {
          globals.timeoutId = null
          if (globals.current === null) return

          message.channel.send(
            chatter.timeout
              .replace('{answer}', globals.current.answer, 'g')
          ).then(() => {
            newQuestion()
          })
        }, 180000) // 3 minutes (180000)

        askQuestion()
      })
  }

  if (message.content.startsWith('!startquiz') && globals.started === false) {
    message.channel.send(
      chatter.start
        .replace('{quizName}', config.quiz.name, 'g')
        .replace('{quizDescription}', config.quiz.description, 'g')
    )
    newQuestion()
  }

  if (message.content.startsWith('!stopquiz') && globals.started === true) {
    globals.current = null
    globals.started = false
    message.channel.send(chatter.quit)
  }

  if (message.content.startsWith('!question') && globals.started === true) {
    askQuestion()
  }

  if (message.content.startsWith('!mypoints')) {
    getUsersPoints(message.author.id)
      .then(points => {
        message.channel.send(
          chatter.userPointsRequest
            .replace('{points}', points, 'g')
            .replace('{name}', message.author, 'g')
        )
      })
  }

  if (globals.started) {
    // treat as an answer
    let clean = message.content
      .trim()
      .toLowerCase()
    clean = stripStringOfNonAlpha(clean)

    if (globals.current && clean === stripStringOfNonAlpha(globals.current.answer)) {
      globals.current = null

      points.add(message.author.id, 1)
        .then(points => {
          message.channel.send(
            chatter.confirmed
              .replace('{name}', message.author)
              .replace('{points}', points)
          )

          clearTimeout(globals.timeoutId)
        })
      newQuestion()
    }
  }
})

function stripStringOfNonAlpha (string) {
  return string.replace(/[^A-Za-z]/gi, '')
}

function getUsersPoints (discordId) {
  return points.get(discordId)
}

function generateQuestion () {
  return new Promise(function (resolve, reject) {
    const rseparaters = /[^\w']/
    const ignoredWords = ['of', 'the']

    const stringToObfuscate = config.quiz.gameNames[_.random(config.quiz.gameNames.length - 1)]

    const exploded = stringToObfuscate.split(rseparaters)
    const separaters = stringToObfuscate.match(new RegExp(rseparaters, 'g'))

    const base = 'https://api.datamuse.com/words?ml='
    function getSynonym (word) {
      return new Promise((resolve, reject) => {
        if (ignoredWords.includes(word)) {
          resolve(word)
        } else {
          axios.get(base + word)
            .then(res => {
              // get one of the top 5 similar words
              const data = res.data[_.random(5)]
              if (data) {
                resolve(data.word)
                log(`Got synonym for ${word}: ${data.word}`)
              } else {
                // return unchanged
                resolve(word)
                log(`Couldn't get synonym for ${word}`)
              }
            })
            .catch(error)
        }
      })
    }

    // generate promises
    let promises = []
    exploded.forEach(word => {
      promises.push(getSynonym(word))
    })
    Promise.all(promises)
      .then(values => {
        let reconstructed = ''
        for (let i = 0; i < values.length; i++) {
          reconstructed += values[i]
          if (separaters && separaters[i]) reconstructed += separaters[i]
        }

        resolve({
          question: reconstructed,
          answer: stringToObfuscate
        })
      })
      .catch(error)
  })
}
