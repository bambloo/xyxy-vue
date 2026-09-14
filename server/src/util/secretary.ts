import { Response } from 'express'
import { BamblooStatusCode, ResponsePacket } from '../../../common/status'

export function response(
  r: Response,
  code: BamblooStatusCode | ResponsePacket,
  msg?: string,
  data?: { [key: string]: unknown } | object,
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
