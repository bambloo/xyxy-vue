// import { NextFunction } from 'express'
import { BamblooStatusCode } from '../../status'
import { generate_key_pair } from '../../util/crypto-util'
import { response } from '../../util/secretary'
import { Request, Response } from 'express'

export default function handler(
  params: [string: string],
  req: Request,
  res: Response,
  // next: NextFunction,
) {
  return generate_key_pair().then((pair) => {
    return response(res, BamblooStatusCode.Success, '获取用户信息成功', {
      pub: pair.publicKey,
      pri: pair.privateKey,
    })
  })
}
