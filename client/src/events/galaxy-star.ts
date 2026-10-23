import type { SentGalaxyStar } from '../../../common/entity/galaxy-star'

export const GALAXY_STAR_SENT_EVENT = 'galaxy-star:sent'
export const GALAXY_STAR_COMPOSE_EVENT = 'galaxy-star:compose'
export const GALAXY_STAR_SEND_STATUS_EVENT = 'galaxy-star:send-status'
export const GALAXY_STAR_COMPOSER_STATE_EVENT = 'galaxy-star:composer-state'
export const GALAXY_STAR_COMMENT_QUEUE_EVENT = 'galaxy-star:comment-queue'
export const GALAXY_STAR_COMMENT_OPEN_EVENT = 'galaxy-star:comment-open'

export interface GalaxyStarComposeOptions {
  onlyIfAvailable?: boolean
  pairedWithFortune?: boolean
}

export function announceGalaxyStarSendStatus(canSend: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(GALAXY_STAR_SEND_STATUS_EVENT, { detail: canSend }))
}

export function announceGalaxyStarSent(star: SentGalaxyStar) {
  window.dispatchEvent(new CustomEvent<SentGalaxyStar>(GALAXY_STAR_SENT_EVENT, { detail: star }))
}

export function announceGalaxyStarComposerState(open: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(GALAXY_STAR_COMPOSER_STATE_EVENT, { detail: open }))
}

export function announceGalaxyStarCommentQueue(count: number) {
  window.dispatchEvent(new CustomEvent<number>(GALAXY_STAR_COMMENT_QUEUE_EVENT, { detail: count }))
}
