import { Express } from 'express'
import { walk } from 'walk'
import path from 'path'
import { logout } from './logger-helper'
import { response } from './secretary'
import { BamblooError } from '../status'

export function proxy_router(express: Express, base: string) {
  return new Promise<void>((resolve) => {
    base = base.replaceAll('\\', '/')
    walk(base).on('file', (parent, stat, next) => {
      parent = parent.replaceAll('\\', '/')
      let router_path = path.join(parent, stat.name).replaceAll('\\', '/')
      let module_path = router_path
        .replace(base, '')
        .replace('/index.ts', '')
        .replace('/index.js', '')
        .replace('.ts', '')
        .replace('.js', '')
      if (module_path.length == 0) {
        module_path = '/'
      }

      if (process.platform == 'win32') {
        router_path = 'file://' + router_path
      }

      import(router_path).then((module) => {
        const mod = module.default
        logout(module_path)

        express.use(module_path, (req, res, next) => {
          const params = {}
          Object.assign(params, req.body)
          Object.assign(params, req.query)
          logout(module_path, params)
          const mod_res = mod(params, req, res, next)
          if (mod_res instanceof Promise) {
            mod_res.catch((err: BamblooError) => {
              response(res, err.code, err.message)
            })
          }
        })
        resolve()
      })

      next()
    })
  })
}
