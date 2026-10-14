import { mongo_helper } from '../../util/mongo-helper'
import { format_local_day, format_timestamp } from '../../util/date-time'

export class daily_session_manager {
  public static recordLogin(userTag: string, now = new Date()) {
    const day = format_local_day(now)
    const timestamp = format_timestamp(now)

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
