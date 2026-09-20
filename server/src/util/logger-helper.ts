import fs, { WriteStream } from 'fs'
import path from 'path'

class TimeExplainer {
  toString() {
    return `[${new Date().toISOString()}]`
  }
}
const explainer = new TimeExplainer()
export const logout = console.log.bind(console, '%s', explainer)
export const errout = console.error.bind(console, '%s', explainer)

export function cookie_info(cookieHeader: string | undefined, allowedNames: readonly string[]) {
  if (!cookieHeader?.trim()) return undefined

  const allowed = new Set(allowedNames)
  const cookies: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue

    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!name || !allowed.has(name)) continue
    cookies[name] = value.length > 4 ? `***${value.slice(-4)}` : '***'
  }

  if (!Object.keys(cookies).length) return undefined

  return cookies
}

// type ConsoleLogType = 'log' | 'info' | 'warn' | 'error'
// const writers = {
//   log: {
//     func: console.log.bind(console),
//   },
//   info: {
//     func: console.info.bind(console),
//   },
//   warn: {
//     func: console.warn.bind(console),
//   },
//   error: {
//     func: console.error.bind(console),
//   },
// }

export type LoggerParams = {
  base: string
  maxsize?: number
  minsize?: number
  interval?: number
  latency?: number
}

// function stringify(obj: any) {
//   if (typeof obj == 'object') {
//     var msg = JSON.stringify(obj, null, 2)
//   } else {
//     var msg = `${obj}`
//   }
//   msg = msg.replaceAll('\n', '\n[    -  -  T  :  :  .    ]')
//   return `[${new Date().toISOString()}]${msg}`
// }

function hook_stream(stream: NodeJS.WriteStream, cb: (chunk: string) => void) {
  const old_writer = stream._write.bind(stream)
  stream._write = (chunk: string, encoding: BufferEncoding, callback: unknown) => {
    cb(chunk)
    return old_writer.apply(stream, [chunk, encoding, callback as (error?: Error | null) => void])
  }
}

// class WriteStreamProxy {
//   _writer?: (chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) => void
// }

let current_stdout_file: WriteStream
let current_stderr_file: WriteStream

let current_stdout_file_length = 0
let current_stderr_file_length = 0

let base = ''
let maxsize = 1024 * 1024
let minsize = 128 * 1024
let interval = 24 * 60 * 60 * 1000
let latency = 3 * 1000

let latency_checker: NodeJS.Timeout
let timeout_checker: NodeJS.Timeout

let latency_checking = false
let need_switch = false

function switch_file() {
  if (current_stderr_file) {
    current_stderr_file.close()
  }
  if (current_stdout_file) {
    current_stdout_file.close()
  }

  const time = new Date().toISOString().replaceAll(':', '')
  current_stderr_file = fs.createWriteStream(path.join(base, `${time}-err.log`))
  current_stdout_file = fs.createWriteStream(path.join(base, `${time}-out.log`))

  current_stdout_file_length = 0
  current_stderr_file_length = 0

  if (timeout_checker) {
    clearTimeout(timeout_checker)
  }

  timeout_checker = setTimeout(() => {
    if (current_stderr_file_length > minsize || current_stdout_file_length > minsize) {
      if (latency_checking) {
        need_switch = true
      }
    }
  }, interval)

  need_switch = false
}

function find_last_log_time() {
  const files = new Set(fs.readdirSync(base))
  const times = [...files]
    .map((file) => file.match(/^(.+)-(?:out|err)\.log$/)?.[1])
    .filter(
      (time): time is string =>
        Boolean(time) && files.has(`${time}-out.log`) && files.has(`${time}-err.log`),
    )
    .sort()

  return times.at(-1)
}

function open_last_log_file() {
  const time = find_last_log_time()
  if (!time) {
    switch_file()
    return
  }

  current_stderr_file = fs.createWriteStream(path.join(base, `${time}-err.log`), { flags: 'a' })
  current_stdout_file = fs.createWriteStream(path.join(base, `${time}-out.log`), { flags: 'a' })
  current_stdout_file_length = fs.statSync(path.join(base, `${time}-out.log`)).size
  current_stderr_file_length = fs.statSync(path.join(base, `${time}-err.log`)).size

  timeout_checker = setTimeout(() => {
    if (current_stderr_file_length > minsize || current_stdout_file_length > minsize) {
      if (latency_checking) {
        need_switch = true
      }
    }
  }, interval)
}

export function proxy_console(params: LoggerParams) {
  base = params.base
  maxsize = params.maxsize || 1024 * 1024
  minsize = params.minsize || 128 * 1024
  interval = params.interval || 24 * 60 * 60 * 1000
  latency = params.latency || 3 * 1000

  fs.mkdirSync(base, { recursive: true })
  // for (let key in writers) {
  //     console[key as ConsoleLogType] = ((message?: any, ...optionalParams: any[]) => {
  //         return writers[key as ConsoleLogType].func.apply(console, [stringify(message), ...optionalParams])
  //    }) as any
  // }

  latency_checker = setTimeout(() => {
    if (
      current_stderr_file_length > maxsize ||
      current_stdout_file_length > maxsize ||
      need_switch
    ) {
      switch_file()
    }
    latency_checking = false
  }, latency)

  hook_stream(process.stdout, (chunk: string) => {
    latency_checking = true
    latency_checker.refresh()
    current_stdout_file_length += chunk.length
    current_stdout_file.write(chunk)
  })
  hook_stream(process.stderr, (chunk: string) => {
    latency_checking = true
    latency_checker.refresh()
    current_stderr_file_length += chunk.length
    current_stderr_file.write(chunk)
  })

  open_last_log_file()
}
