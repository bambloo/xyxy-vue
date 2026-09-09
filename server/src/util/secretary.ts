import { Response } from 'express'
import { BamblooStatusCode } from '../status'

export interface ResponsePacket {
  code: BamblooStatusCode
  msg?: string
  data?: { [key: string]: unknown }
}

export function response(
  r: Response,
  code: BamblooStatusCode | ResponsePacket,
  msg?: string,
  data?: { [key: string]: unknown },
) {
  r.header('Content-Type', 'application/json; charset=utf-8')
  if (typeof code == 'object') {
    r.end(JSON.stringify(code))
  } else {
    const packet: ResponsePacket = { code: code }
    if (typeof msg != 'undefined') {
      packet.msg = msg
    }
    if (typeof data != 'undefined') {
      packet.data = data
    }
    r.end(JSON.stringify(packet))
  }
}
