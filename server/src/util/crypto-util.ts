import { generateKeyPair } from 'crypto'

export interface IKeyPair {
  publicKey: string
  privateKey: string
}

export function generate_key_pair() {
  return new Promise<IKeyPair>((resolve, reject) => {
    generateKeyPair(
      'rsa',
      {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'pkcs1',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs1',
          format: 'pem',
        },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err)
        } else {
          resolve({
            publicKey,
            privateKey,
          })
        }
      },
    )
  })
}
