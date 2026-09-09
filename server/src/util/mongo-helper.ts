import { Db, MongoClient } from 'mongodb'
import { DATABASE_HOST, DATABASE_PORT } from '../config'

export class mongo_helper {
  private static client: MongoClient

  private static get_client() {
    if (!this.client) {
      return MongoClient.connect(`mongodb://${DATABASE_HOST}:${DATABASE_PORT}`, {}).then(
        (client) => {
          this.client = client
          return client
        },
      )
    } else {
      return Promise.resolve(this.client)
    }
  }

  private static get_db() {
    return this.get_client().then((client) => {
      return client.db('xyxy')
    })
  }

  public static ddo<ReturnType>(callback: (database: Db) => ReturnType) {
    return this.get_db().then((db) => {
      return callback(db)
    })
  }

  public static cdo<ReturnType>(callback: (client: MongoClient) => ReturnType) {
    return this.get_client().then((client) => {
      return callback(client)
    })
  }
}
