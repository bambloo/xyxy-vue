import type { Request, Response } from 'express'
import { BamblooStatusCode } from '../../../../common/status'
import { clear_session } from '../../util/session'
import { response } from '../../util/secretary'

export default function handler(_params: { [key: string]: unknown }, _req: Request, res: Response) {
  clear_session(res)
  return response(res, BamblooStatusCode.Success, '退出登录成功')
}
