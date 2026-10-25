export type DialogStackId =
  | 'fortune'
  | 'composer'
  | 'profile'
  | 'site-info'
  | 'activation'
  | 'star-details'

export const DIALOG_STACK_STATE_EVENT = 'dialog-stack:state'
export const DIALOG_STACK_CLOSE_REQUEST_EVENT = 'dialog-stack:close-request'
export const DIALOG_STACK_CLOSE_DIALOG_EVENT = 'dialog-stack:close-dialog'

export function announceDialogStackState(id: DialogStackId, open: boolean) {
  window.dispatchEvent(
    new CustomEvent<{ id: DialogStackId; open: boolean }>(DIALOG_STACK_STATE_EVENT, {
      detail: { id, open },
    }),
  )
}

export function requestTopDialogClose() {
  window.dispatchEvent(new Event(DIALOG_STACK_CLOSE_REQUEST_EVENT))
}
