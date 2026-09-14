import http from 'http'
import https from 'https'
import zlib from 'zlib'
import { BamblooError, BamblooStatusCode } from '../../../common/status'
import { errout } from './logger-helper'
import { Transform } from 'node:stream'
import FormData from 'form-data'
// import { response } from './secretary'
import { OutgoingHttpHeaders } from 'node:http2'

export function get_hostname(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

const REQUEST_TIMEOUT = 180000

export function request_website(uri: string) {
  return new Promise<{ buffer: Buffer; content_encoding?: string }>((resolve, reject) => {
    let req: http.ClientRequest
    if (uri.startsWith('https')) {
      req = https.get(uri, {
        headers: {
          'accept-encoding': 'gzip',
        },
      })
    } else {
      req = http.get(uri, {
        headers: {
          'accept-encoding': 'gzip',
        },
      })
    }
    const bufs: Buffer[] = []
    const timeout = setTimeout(() => {
      req.destroy()
      reject(new BamblooError(BamblooStatusCode.Timeout, `${uri} req timedout.`))
    }, REQUEST_TIMEOUT)

    const error_handler = (error: NodeJS.ErrnoException, type: string) => {
      if (error.code == 'ENOBUFS') {
        errout(`${uri} ENOBUFS`)
      }
      clearTimeout(timeout)
      reject(
        new BamblooError(
          BamblooStatusCode.NetworkInvalid,
          `${uri} ${type} ${error.code || error.message}`,
        ),
      )
    }

    req
      .on('response', (res) => {
        let total_length = 0
        const content_type = res.headers['content-type']
        const content_encoding = res.headers['content-encoding']

        if (content_type && content_type.indexOf('text') < 0) {
          clearTimeout(timeout)
          return reject(
            new BamblooError(
              BamblooStatusCode.FormatError,
              `${uri} content-type ${res.headers['content-type']} skip`,
            ),
          )
        }

        res
          .on('data', (data) => {
            total_length += data.byteLength
            if (total_length >= 5 * 1024 * 1024) {
              req.destroy()
              clearTimeout(timeout)
              errout(`${uri} too long`)
              return reject(new BamblooError(BamblooStatusCode.FormatError, `${uri} too long`))
            }
            bufs.push(data)
          })
          .on('end', () => {
            clearTimeout(timeout)
            resolve({ buffer: Buffer.concat(bufs), content_encoding: content_encoding })
          })
          .on('error', (err) => error_handler(err, 'response'))
      })
      .on('error', (err) => error_handler(err, 'request'))
      .end()

    req.setMaxListeners(20)
  }).then((data) => {
    let decoder: Transform
    switch (data.content_encoding) {
      case 'gzip':
        decoder = zlib.createGunzip()
        break
      case 'br':
        decoder = zlib.createBrotliDecompress()
        break
      case 'deflate':
        decoder = zlib.createDeflate()
        break
      default:
        return data.buffer.toString()
    }
    const bufs: Buffer[] = []

    return new Promise((resolve) => {
      decoder.write(data.buffer)
      decoder.end()

      decoder.on('data', (data) => {
        bufs.push(data)
      })
      decoder.on('error', () => {
        resolve(Buffer.concat(bufs).toString())
      })
      decoder.on('end', () => {
        resolve(Buffer.concat(bufs).toString())
      })
    })
  })
}

export function upload_file(url: string, buf: Buffer, cookies?: unknown) {
  return new Promise((resolve, reject) => {
    const form_data = new FormData()
    form_data.append('userListFile', buf, {
      filename: 'userListFile.xlsx',
      knownLength: buf.byteLength,
    })

    const headers = form_data.getHeaders()
    headers['Cookie'] = cookies
    headers['Connection'] = 'keep-alive'
    headers['Content-Length'] = form_data.getLengthSync().toFixed(0)
    headers['chanId'] = '3'

    const req = (url.startsWith('https:') ? https : http).request(
      url,
      {
        method: 'POST',
        headers: headers,
      },
      (response) => {
        if (response.statusCode != 200) {
          return reject(
            new BamblooError(
              BamblooStatusCode.NetworkInvalid,
              `服务器返回值${response.statusCode}`,
            ),
          )
        }
        const bufs: Buffer[] = []
        response.on('end', () => {
          resolve(JSON.parse(Buffer.concat(bufs).toString()))
        })
        response.on('data', (data) => {
          bufs.push(data)
        })
      },
    )
    req.on('error', (err) => {
      reject(new BamblooError(BamblooStatusCode.NetworkInvalid, err.message))
    })

    form_data.pipe(req)
  })
}

export function post(url: string, data?: unknown, cookies?: string[]) {
  return new Promise((resolve, reject) => {
    const headers: OutgoingHttpHeaders = {}
    headers.cookie = cookies
    headers['Content-Type'] = data ? 'application/json' : 'text/plain'
    headers['chanid'] = '3'
    const str = data ? JSON.stringify(data) : ''
    const buf = Buffer.from(str)
    headers['Content-Length'] = buf.byteLength

    const req = (url.startsWith('https:') ? https : http).request(
      url,
      {
        method: 'POST',
        headers: headers,
      },
      (response) => {
        if (response.statusCode != 200) {
          return reject(
            new BamblooError(
              BamblooStatusCode.NetworkInvalid,
              `服务器返回值${response.statusCode}`,
            ),
          )
        }
        const bufs: Buffer[] = []
        response.on('end', () => {
          resolve(JSON.parse(Buffer.concat(bufs).toString()))
        })
        response.on('data', (data) => {
          bufs.push(data)
        })
      },
    )
    req.on('error', (err) => {
      reject(new BamblooError(BamblooStatusCode.NetworkInvalid, err.message))
    })
    req.end(buf)
  })
}
