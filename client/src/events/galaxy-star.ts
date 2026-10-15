import type { SentGalaxyStar } from '../../../common/entity/galaxy-star'

export const GALAXY_STAR_SENT_EVENT = 'galaxy-star:sent'
export const GALAXY_STAR_COMPOSE_EVENT = 'galaxy-star:compose'
export const GALAXY_STAR_SEND_STATUS_EVENT = 'galaxy-star:send-status'

export function announceGalaxyStarSendStatus(canSend: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(GALAXY_STAR_SEND_STATUS_EVENT, { detail: canSend }))
}

export function announceGalaxyStarSent(star: SentGalaxyStar) {
  window.dispatchEvent(new CustomEvent<SentGalaxyStar>(GALAXY_STAR_SENT_EVENT, { detail: star }))
}
