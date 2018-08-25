'use strict'

const path = require('path') // paths

const config = require('../config.js')(path.join(__dirname, 'config.yml'))

const dayjs = require('dayjs') // dates
const axios = require('axios') // http
const { fs } = require('mz') // promise-based fs
const Jimp = require('jimp') // image manipulation
const chalk = require('chalk') // console colouration

const Discord = require('discord.js')
const discord = new Discord.Client()
discord.login(config.discord.token)

let currentlyOnline = false

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

/**
 * Save the original guild icon so we can restore it later.
 */
function saveDiscordIconToDisk () {
  const guild = discord.guilds.get(config.discord.server.id)
  const iconUrl = guild.iconURL

  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: iconUrl,
      responseType: 'stream'
    })
      .then(response => {
        response.data.pipe(fs.createWriteStream(path.join(__dirname, 'icons', config.discord.server.id)))
        log(`saved original icon for ${guild.name}`)

        resolve()
      })
  })
}

discord.on('ready', () => {
  log(`Logged in as ${discord.user.tag}`)

  saveDiscordIconToDisk()
    .then(() => {
      // Do an initial poll.
      poll()
    })
})

discord.on('message', message => {
  if (config.discord.admins.includes(message.author.id)) {
    if (message.content.startsWith('!!resave')) {
      saveDiscordIconToDisk()
        .then(() => {
          message.channel.send('Saved current icon to disk.')
        })
    }
  }
})

/**
 * Announce that the Twitch channel is live to Discord.
 *
 * @param {JSON} twitchApiResult JSON data from the `streams` endpoint.
 */
function announceLiveToChannel (twitchApiResult) {
  const streamData = twitchApiResult[0]

  const gameName = streamData.game
  const name = streamData.channel.display_name

  const template = `${name} just went live on Twitch playing ${gameName}: "${streamData.channel.status}" ${streamData.channel.url}`

  const guild = discord.guilds.get(config.discord.server.id)
  if (guild) {
    const channel = guild.channels.get(config.discord.channel.id)
    if (channel) {
      channel.send(template)
        .then(message => log(`Sent message on ${message.guild.name} - ${message.channel.name}: ${message.content}`))
        .catch(console.error)
    } else {
      error(`[Error] Channel provided in config doesn't exist in the guild provided.`)
    }
  } else {
    error(`[Error] Bot isn't authenticated to the Guild ID provided in config.`)
  }
}

function poll () {
  log(`Polling Twitch for ${config.twitch.channel}`)

  axios.get(`https://api.twitch.tv/kraken/streams`, {
    params: {
      client_id: config.twitch.clientid,
      channel: config.twitch.channel
    }
  })
    .then(r => {
      // Get an array of the live channels that aren't playing a playlist.
      const channel = r.data.streams.filter(function (el) {
        return (el.channel.name.toLowerCase() === config.twitch.channel) &&
          el.stream_type === 'live' // no playlists
      })

      const guild = discord.guilds.get(config.discord.server.id)
      if (channel.length) {
        log(`twitch says ${config.twitch.channel} is ONLINE`)
        if (currentlyOnline === false) {
          currentlyOnline = true

          announceLiveToChannel(channel)

          log(`${config.twitch.channel}: change icon to LIVE`)
          // Get the current guild icon ..
          Jimp.read(path.join('icons', config.discord.server.id))
            .then(icon => {
              // Get the image we will overlay
              Jimp.read(path.join(`live_overlay.png`))
                .then(liveOverlay => {
                  // Image manipulation, scale the overlay to fit the icon and
                  // composite it over the current icon.
                  liveOverlay.scaleToFit(icon.getWidth(), icon.getHeight())
                  icon.composite(liveOverlay, 0, (icon.getHeight() / 2) - liveOverlay.getHeight() / 2)

                  // Get the base64 of the icon, then upload the new icon.
                  icon.getBase64Async(icon.getMIME())
                    .then(base64 => {
                      if (guild) {
                        guild.edit({
                          icon: base64
                        })
                      }
                    })
                    .catch(console.error)
                })
            })
        }
      } else {
        log(`twitch says ${config.twitch.channel} is OFFLINE`)

        if (currentlyOnline) {
          currentlyOnline = false

          // Get the original icon and restore it to the guild.
          log(`${guild.name}: change icon to ORIGINAL`)
          Jimp
            .read(path.join('icons', config.discord.server.id))
            .then(icon => icon.getBase64Async(icon.getMIME()))
            .then(originalIcon => {
              guild.edit({
                icon: originalIcon
              })
            })
            .catch(console.error)
        }
      }
    })
    .catch(console.error)
}

// Begin polling twitch in 30 second intervals.
(function startPollingTwitch () {
  setInterval(poll, 30 * 1000)
})()
