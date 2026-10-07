import { mongo_helper } from '../../util/mongo-helper'

export class daily_session_manager {
  public static recordLogin(userTag: string, now = new Date()) {
    const day = now.toISOString().slice(0, 10)
    const timestamp = now.toISOString()

    return mongo_helper.ddo((db) =>
      db
        .collection<{
          _id: string
          userTag: string
          day: string
          state: string
          createdAt: string
          lastLoginAt: string
          loginCount: number
        }>('user_daily_session')
        .updateOne(
          { _id: `${userTag}:${day}` },
          {
            $setOnInsert: {
              userTag,
              day,
              state: 'active',
              createdAt: timestamp,
            },
            $set: { lastLoginAt: timestamp },
            $inc: { loginCount: 1 },
          },
          { upsert: true },
        ),
    )
  }
}
