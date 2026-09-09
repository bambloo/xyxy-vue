import express from 'express'
import { errout, logout, proxy_console } from './util/logger-helper'
import { proxy_router } from './util/router-proxy'
import { dirname, join } from 'path'
import body_parser from 'body-parser'
import cookie_parser from 'express'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

proxy_console({ base: 'logs' })

process.on('unhandledRejection', (rej) => {
  errout(rej)
})

process.on('uncaughtException', (err) => {
  errout(err)
})

const application = express()

proxy_router(application, join(__dirname, 'wpi'))

application.use(body_parser.json())
application.use(body_parser.urlencoded({ extended: true }))
application.use(cookie_parser())
application.post('/', (req) => {
  console.log(req.url)
})
application
  .listen(1992)
  .on('listening', () => {
    logout('Server Listening')
  })
  .on('error', (err) => {
    logout(err)
  })
