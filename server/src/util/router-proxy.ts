import type { Express, NextFunction, Request, Response } from 'express'
import path from 'path'
import { walk } from 'walk'
import { BamblooError } from '../../../common/status'
import { cookie_info, logout } from './logger-helper'
import { response } from './secretary'
import { SESSION_COOKIE } from './session'
import { authorize_wpi, type WpiConfig, type WpiHandler, type WpiRequest } from './wpi-access'

interface WpiModule {
  default: WpiHandler
  config?: WpiConfig
}

export function proxy_router(application: Express, base: string) {
  const normalizedBase = normalize_path(base)

  return new Promise<void>((resolve, reject) => {
    const imports: Promise<void>[] = []
    const walker = walk(normalizedBase)

    walker.on('file', (parent, stat, next) => {
      const filePath = normalize_path(path.join(parent, stat.name))
      imports.push(register_module(application, normalizedBase, filePath))
      next()
    })
    walker.on('end', () => {
      Promise.all(imports)
        .then(() => resolve())
        .catch(reject)
    })
    // walker.on('error', reject)
  })
}

async function register_module(application: Express, base: string, filePath: string) {
  const modulePath = get_module_path(base, filePath)
  const loaded = (await import(to_module_url(filePath))) as WpiModule
  const config = loaded.config || {}

  logout(modulePath)
  application.use(modulePath, (req, res, next) => {
    void handle_request(loaded.default, config, modulePath, req, res, next)
  })
}

async function handle_request(
  handler: WpiHandler,
  config: WpiConfig,
  modulePath: string,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const params = collect_params(req)
  const cookie = cookie_info(req.headers.cookie, [SESSION_COOKIE])
  logout(modulePath, params, ...(cookie ? [{ cookie }] : []))

  try {
    const authorized = await authorize_wpi(config, req as WpiRequest, res)
    if (!authorized) return
    await handler(params, req as WpiRequest, res, next)
  } catch (error) {
    const err = error as BamblooError
    response(res, err.code, err.message || '接口处理失败')
  }
}

function collect_params(req: Request): Record<string, unknown> {
  return {
    ...req.body,
    ...req.query,
  }
}

function get_module_path(base: string, filePath: string) {
  const relativePath = filePath
    .replace(base, '')
    .replace(/\/index\.(ts|js)$/, '')
    .replace(/\.(ts|js)$/, '')
  return relativePath || '/'
}

function normalize_path(value: string) {
  return value.replaceAll('\\', '/')
}

function to_module_url(filePath: string) {
  return process.platform === 'win32' ? `file://${filePath}` : filePath
}
