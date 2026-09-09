export enum BamblooStatusCode {
  Success = 0,
  TokenInvalid,
  AuthenticationFail,
  TokenSigningError,

  EntityNonexist,
  EntityExists,
  HandleClosed,

  IllegalState,
  TokenMismatch,
  FormatError,

  Unauthorized,
  DatabaseError,
  NetworkInvalid,

  Timeout,
  Retry,
  Uncategoried = 10000,
}

export class BamblooError extends Error {
  code: BamblooStatusCode
  msg: string
  constructor(code: BamblooStatusCode, mesg: string) {
    super(mesg)
    this.msg = mesg
    this.code = code
  }
}
