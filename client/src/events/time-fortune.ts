export const TIME_FORTUNE_OPEN_EVENT = 'time-fortune:open'
export const TIME_FORTUNE_STATE_EVENT = 'time-fortune:state'

let timeFortuneReady = false

export function setTimeFortuneReady(ready: boolean) {
  timeFortuneReady = ready
  window.dispatchEvent(new CustomEvent(TIME_FORTUNE_STATE_EVENT, { detail: ready }))
}

export function isTimeFortuneReady() {
  return timeFortuneReady
}
