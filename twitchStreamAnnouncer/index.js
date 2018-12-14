'use strict'

const config = require('./config.json')

const dayjs = require('dayjs') // dates
const chalk = require('chalk') // console colouration

const axios = require('axios')

const Discord = require('discord.js')
const discord = new Discord.Client()
discord.login(config.discord.token)

const twitchApiBase = 'https://api.twitch.tv/helix/'
const cachedTwitchInfo = new Map()

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
  log(`Logged in as ${discord.user.tag}`)

  // const streamAdvertisements = discord.channels.get(config.discord.channel.id)

  // discord.channels
  //   .get(config.discord.channel.id)
  //   .send(`React to this message to assign the Streamer role to you so I know to notify ${streamAdvertisements} when you go live.`)
  //   .then(message => {
  //     discord.on('messageReactionAdd', (reaction, user) => {
  //       addTrackedUser(user)
  //     })
  //     discord.on('messageReactionRemove', (reaction, user) => {
  //       removeTrackedUser(user)
  //     })
  //   })
})

/**
 * When a user updates their presence, do Twitch API calls and get Stream Info, then announce to channel.
 * @param {Discord.User} oldMember Discord User before the update
 * @param {Discord.User} newMember Discord User after the update
 */
discord.on('presenceUpdate', (oldMember, newMember) => {
  if (newMember.presence.game && newMember.presence.game.streaming) {
    // Do they have the "Streaming" role?
    if (newMember.roles.has(config.discord.roleToAssign)) {
      // Extract Twitch login name from URL
      const login = newMember.presence.game.url.split('/').slice(-1)

      getAndCacheUserIdsFromTwitchLogin([login])
        .then(fetched => {
          getTwitchStreamInfo(login)
            .then(streamInfos => {
              // TODO: Need to change this to IDs later.
              let info = streamInfos.filter(el => el.user_name.toLowerCase() === login)
              if (info.length) info = info[0]

              const shout = `${newMember} has gone live on Twitch: "${info.title}" ${newMember.presence.game.url}`
              announceLiveToChannel(newMember.user, shout)
            })
        })
    }
  }
})

/**
 * Gets the Twitch IDs from login names. We need IDs to make requests later.
 * @param {string[]} twitchLoginNames A string[] of lowercase twitch login names
 * @returns {Promise<Map<string, object>>} The new Info in a Map<string, object>
 */
function getAndCacheUserIdsFromTwitchLogin (twitchLoginNames) {
  return new Promise((resolve, reject) => {
    const newInfo = new Map()

    const loginNamesWithoutCached = twitchLoginNames.filter(cached => {
      return !(cachedTwitchInfo.has(cached))
    })

    twitchLoginNames.forEach(cached => {
      if (cachedTwitchInfo.has(cached)) {
        console.log(`Found cached data: ${cached}`)
        newInfo.set(cached, cachedTwitchInfo.get(cached))
      }
    })

    if (loginNamesWithoutCached.length) {
      axios
        .get(twitchApiBase + `users?login=${loginNamesWithoutCached.join('&login=')}`, {
          headers: { 'Client-ID': config.twitch.clientid }
        })
        .then(res => {
          res.data.data.forEach(user => {
            cachedTwitchInfo.set(user.login, user)
            newInfo.set(user.login, user)
          })

          resolve(newInfo)
        })
        .catch(e => {
          reject(e)
        })
    }
  })
}

/**
 * Gets Twitch Stream info for a Discord.User who just started streaming.
 * @param {string} The Twitch Login User to get information for.
 * @returns {TwitchStreamInfo} Object with keys:
 */
function getTwitchStreamInfo (twitchLoginName) {
  return new Promise((resolve, reject) => {
    axios
      .get(twitchApiBase + 'streams', {
        headers: { 'Client-ID': config.twitch.clientid },
        params: { user_login: twitchLoginName }
      })
      .then(res => {
        resolve(res.data.data)
      })
      .catch(e => {
        console.error('getTwitchStreamInfo')
        reject(e)
      })
  })
}

/**
 * Announce that the Twitch channel is live to Discord.
 * @param {discord.User} discordUser The Discord User to mention
 * @param {string?} announcementText Optional overriding announcement text to use, preformatted.
 */
function announceLiveToChannel (discordUser, announcementText) {
  const game = discordUser.presence.game
  const shout = announcementText !== undefined ? announcementText : `${discordUser} just went live playing ${game.name} at ${game.url}.`

  console.log(`${discordUser.username} went live: ${shout}`)
  discord.channels
    .get(config.discord.channel.id)
    .send(shout)
    .catch(error)
}
