'use strict'

const config = require('./config.json')

const axios = require('axios') // http
const { fs } = require('mz')
const Jimp = require('jimp') // image manip

const Discord = require('discord.js')
const discord = new Discord.Client()
discord.login(config.discord.token)

let currentlyOnline = false

discord.on('ready', () => {
  console.log(`Logged in as ${discord.user.tag}`)

  const guild = discord.guilds.get(config.discord.server.id)
  const iconUrl = guild.iconURL
  axios({
    method: 'get',
    url: iconUrl,
    responseType: 'stream'
  })
    .then(response => {
      response.data.pipe(fs.createWriteStream(`./icons/${config.discord.server.id}`))
      console.log(`saved original icon for ${guild.name}`)

      poll()
    })
})

function poll () {
  console.log(`Polling Twitch for ${config.twitch.channel}`)

  axios.get(`https://api.twitch.tv/kraken/streams`, {
    params: {
      client_id: config.twitch.clientid,
      channel: config.twitch.channel
    }
  })
    .then(r => {
      const channel = r.data.streams.map(function (el) {
        return (el.channel.name.toLowerCase() === config.twitch.channel)
      })

      const guild = discord.guilds.get(config.discord.server.id)
      if (channel.length) {
        console.log(`twitch says ${config.twitch.channel} is ONLINE`)
        if (currentlyOnline === false) {
          currentlyOnline = true

          console.log(`${config.twitch.channel}: change icon to LIVE`)
          Jimp.read(`./icons/${config.discord.server.id}`)
            .then(icon => {
              Jimp.read(`./live_overlay.png`)
                .then(liveOverlay => {
                  liveOverlay.scaleToFit(icon.getWidth(), icon.getHeight())
                  icon.composite(liveOverlay, 0, (icon.getHeight() / 2) - liveOverlay.getHeight() / 2)

                  icon.getBase64Async('image/png')
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
        console.log(`twitch says ${config.twitch.channel} is OFFLINE`)

        if (currentlyOnline) {
          currentlyOnline = false

          console.log(`${guild.name}: change icon to ORIGINAL`)
          Jimp
            .read(`./icons/${config.discord.server.id}`)
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
}

(function startPollingTwitch () {
  setInterval(poll, 30 * 1000)
})()
