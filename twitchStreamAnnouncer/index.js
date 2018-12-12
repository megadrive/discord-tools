'use strict'

const config = require('./config.json')

const dayjs = require('dayjs') // dates
const chalk = require('chalk') // console colouration

const Discord = require('discord.js')
const discord = new Discord.Client()
discord.login(config.discord.token)

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

discord.on('presenceUpdate', (oldMember, newMember) => {
  if (newMember.presence.game && newMember.presence.game.streaming) {
    // Do they have the "Streaming" role?
    if (newMember.roles.has(config.discord.roleToAssign)) {
      announceLiveToChannel(newMember.user)
    }
  }
})

function addTrackedUser (discordUser) {
  discord
    .guilds.get(config.discord.server.id)
    .members.get(discordUser.id)
    .addRole(config.discord.roleToAssign)
    .then(() => {
      console.log(`Gave ${discordUser.username} Streamer role.`)
    })
    .catch(error)
}

function removeTrackedUser (discordUser) {
  discord
    .guilds.get(config.discord.server.id)
    .members.get(discordUser.id)
    .removeRole(config.discord.roleToAssign)
    .then(() => {
      console.log(`Removed ${discordUser.username} Streamer role.`)
    })
    .catch(error)
}

/**
 * Announce that the Twitch channel is live to Discord.
 */
function announceLiveToChannel (discordUser) {
  const game = discordUser.presence.game
  const shout = `${discordUser} just went live playing ${game.name} at ${game.url}.`

  console.log(`${discordUser.username} went live: ${shout}`)
  discord.channels
    .get(config.discord.channel.id)
    .send(shout)
    .catch(error)
}
