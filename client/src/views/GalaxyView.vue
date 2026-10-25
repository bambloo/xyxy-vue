<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import GalaxyStarDetailsDialog from '@/components/dialogs/GalaxyStarDetailsDialog.vue'
import type {
  GalaxyBlackHoleEntry,
  GalaxyStarComment,
  GalaxyStarListResponse,
  GalaxyStarView,
  GalaxyStarVote,
  SentGalaxyStar,
} from '../../../common/entity/galaxy-star'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import {
  announceGalaxyStarCommentQueue,
  GALAXY_STAR_COMMENT_OPEN_EVENT,
  GALAXY_STAR_NAVIGATE_EVENT,
  GALAXY_STAR_NAVIGATE_RANDOM_EVENT,
  GALAXY_STAR_SENT_EVENT,
} from '@/events/galaxy-star'
import {
  GALAXY_CAMERA_CENTER_EVENT,
  GALAXY_CAMERA_DEFAULT_EVENT,
  GALAXY_CAMERA_ZOOM_OUT_EVENT,
} from '@/events/galaxy-camera'
import { TIME_FORTUNE_TOGGLE_EVENT } from '@/events/time-fortune'
import { GalaxyScene } from '../scripts/core/galaxy/GalaxyScene.ts'

const props = withDefaults(defineProps<{ blackHoleView?: boolean }>(), {
  blackHoleView: false,
})
const router = useRouter()
const auth = useAuthStore()
const canvasHost = ref<HTMLElement | null>(null)
const sceneError = ref('')
const sentStars = ref<GalaxyStarView[]>([])
const selectedStar = ref<GalaxyStarView>()
const listLoading = ref(false)
const sourceStarColorLoading = ref(false)
const blackHoleListLoaded = ref(false)
const statusLoading = ref(false)
const voteLoading = ref(false)
const voteRequestLoading = ref(false)
const voteError = ref('')
const commentLoading = ref(false)
const commentError = ref('')
const commentText = ref('')
const replyingToCommentId = ref('')
const todayStarId = ref('')
const hiddenStarIds = ref<string[]>([])
const blackHoleTotalCount = ref(0)
const blackHoleEntries = ref<GalaxyBlackHoleEntry[]>([])
const blackHoleContentLoading = ref(false)
const selectedCommentId = ref('')
const selectedBlackHoleEntryKind = ref<GalaxyBlackHoleEntry['kind']>()
const blackHolePointerStart = ref<{ x: number; y: number }>()
const blackHoleSwipeHandled = ref(false)
const commentNotifications = ref<Array<{ starId: string; commentId: string }>>([])
const commentNotificationLoading = ref(false)
const sourceStarColors = new Map<string, string>()
const hasSentToday = computed(() => Boolean(todayStarId.value))
const canViewStarDetails = computed(() => auth.isLoggedIn && auth.isSessionValidated)
const blackHoleWaveSize = 20
const blackHoleWave = computed(() => blackHoleEntries.value)
const blackHoleWaveKey = computed(() => blackHoleWave.value.map((entry) => entry.id).join(':'))
const blackHoleLayoutSeed = ref(Math.random().toString(36).slice(2))
const blackHoleEntryStyles = computed(() => {
  const placed: Array<{ x: number; y: number }> = []

  return blackHoleWave.value.map((entry, index) => {
    const random = createBlackHoleEntryRandom(entry.id, index, blackHoleLayoutSeed.value)
    let position = { x: 50, y: 50 }
    let bestDistance = -1

    for (let attempt = 0; attempt < 160; attempt++) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * 35
      const candidate = {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
      }
      const distance = placed.length
        ? Math.min(
          ...placed.map((other) => Math.hypot(candidate.x - other.x, candidate.y - other.y)),
        )
        : Number.POSITIVE_INFINITY

      if (distance > bestDistance) {
        bestDistance = distance
        position = candidate
      }
      if (distance >= 13) {
        position = candidate
        break
      }
    }

    placed.push(position)
    return blackHoleEntryStyle(entry, index, position)
  })
})
watch(blackHoleWaveKey, () => {
  blackHoleLayoutSeed.value = Math.random().toString(36).slice(2)
})
let galaxyScene: GalaxyScene | undefined
let starNavigationRequestId = 0
let dailyResetTimer: number | undefined
let commentNotificationTimer: number | undefined

function currentListViewParams(preserveBlackHoleWave = false) {
  return {
    view: props.blackHoleView ? 'blackhole' : 'normal',
    ...(props.blackHoleView
      ? {
        limit: blackHoleWaveSize,
        ...(preserveBlackHoleWave
          ? {
            includeIds: props.blackHoleView
              ? blackHoleEntries.value.map((entry) => entry.id)
              : sentStars.value.map((star) => star.id),
          }
          : {}),
      }
      : {}),
  }
}

function createBlackHoleEntryRandom(id: string, index: number, layoutSeed: string) {
  let seed = 2166136261
  for (const character of `${layoutSeed}:${id}:${index}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
}

function isCommentNotification(value: unknown): value is { starId: string; commentId: string } {
  if (!value || typeof value !== 'object') return false
  const notification = value as Record<string, unknown>
  return typeof notification.starId === 'string' && typeof notification.commentId === 'string'
}

function updateCommentNotificationQueue(notifications: Array<{ starId: string; commentId: string }>) {
  commentNotifications.value = notifications
  announceGalaxyStarCommentQueue(commentNotifications.value.length)
}

function rememberSourceStarColors(stars: GalaxyStarView[]) {
  stars.forEach((star) => sourceStarColors.set(star.id, star.color))
}

function withSourceStarColors(star: GalaxyStarView): GalaxyStarView {
  return {
    ...star,
    comments: star.comments.map((comment) => ({
      ...comment,
      sourceStarColor: comment.sourceStarId
        ? sourceStarColors.get(comment.sourceStarId)
        : undefined,
    })),
  }
}

async function resolveSourceStarColors(star: GalaxyStarView) {
  const missingSourceStarIds = [
    ...new Set(
      star.comments
        .map((comment) => comment.sourceStarId)
        .filter(
          (sourceStarId): sourceStarId is string =>
            sourceStarId !== undefined && !sourceStarColors.has(sourceStarId),
        ),
    ),
  ]
  if (missingSourceStarIds.length) {
    const packet = await post('/wpi/user/galaxy-star/list', sourceStarColorLoading, {
      view: 'normal',
    })
    const data = packet.data as Partial<GalaxyStarListResponse> | undefined
    if (!Array.isArray(data?.stars)) {
      throw new Error('来源星星颜色数据格式无效')
    }
    rememberSourceStarColors(data.stars)
  }
  return withSourceStarColors(star)
}

async function refreshCommentNotificationQueue() {
  if (props.blackHoleView || !canViewStarDetails.value || commentNotificationLoading.value) return
  try {
    const packet = await post(
      '/wpi/user/galaxy-star/comment-notifications',
      commentNotificationLoading,
    )
    const data = packet.data as { notifications?: unknown } | undefined
    if (
      !Array.isArray(data?.notifications) ||
      !data.notifications.every(isCommentNotification)
    ) {
      throw new Error('评论通知队列格式无效')
    }
    updateCommentNotificationQueue(data.notifications)
  } catch (error) {
    console.error('读取星星评论通知失败', error)
  }
}

async function openNextCommentedStar() {
  if (!canViewStarDetails.value || commentNotificationLoading.value) return
  try {
    const packet = await post(
      '/wpi/user/galaxy-star/comment-notification-consume',
      commentNotificationLoading,
    )
    const data = packet.data as {
      star?: GalaxyStarView
      selectedCommentId?: unknown
      notifications?: unknown
    } | undefined
    if (
      !Array.isArray(data?.notifications) ||
      !data.notifications.every(isCommentNotification) ||
      (data.star && typeof data.selectedCommentId !== 'string')
    ) {
      throw new Error('评论通知队列格式无效')
    }
    updateCommentNotificationQueue(data.notifications)
    if (!data.star) return
    if (typeof data.selectedCommentId !== 'string') {
      throw new Error('评论通知目标无效')
    }
    const star = await resolveSourceStarColors(data.star)
    sentStars.value = sentStars.value.map((candidate) => (candidate.id === star.id ? star : candidate))
    if (!sentStars.value.some((candidate) => candidate.id === star.id)) {
      sentStars.value = [...sentStars.value, star]
    }
    galaxyScene?.setSentStars(sentStars.value)
    galaxyScene?.navigateToSentStar(star.id)
    selectedStar.value = star
    selectedCommentId.value = data.selectedCommentId
    selectedBlackHoleEntryKind.value = undefined
    voteError.value = ''
    await nextTick()
    document
      .getElementById(`sent-star-comment-${selectedCommentId.value}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch (error) {
    console.error('打开新评论星星失败', error)
    sceneError.value = '打开新评论星星失败，请稍后重试。'
  }
}

function blackHoleEntryStyle(
  entry: GalaxyBlackHoleEntry,
  index: number,
  position: { x: number; y: number },
) {
  const random = createBlackHoleEntryRandom(entry.id, index, blackHoleLayoutSeed.value)
  const driftOffsets = Array.from({ length: 5 }, () => ({
    x: Math.round(random() * 36 - 18),
    y: Math.round(random() * 36 - 18),
  }))
  const angle = Math.round(random() * 14 - 7)
  const angleSway = random() * 3 + 1
  return {
    '--entry-x': `${position.x.toFixed(2)}%`,
    '--entry-y': `${position.y.toFixed(2)}%`,
    '--drift-x-1': `${driftOffsets[0]!.x}px`,
    '--drift-y-1': `${driftOffsets[0]!.y}px`,
    '--drift-x-2': `${driftOffsets[1]!.x}px`,
    '--drift-y-2': `${driftOffsets[1]!.y}px`,
    '--drift-x-3': `${driftOffsets[2]!.x}px`,
    '--drift-y-3': `${driftOffsets[2]!.y}px`,
    '--drift-x-4': `${driftOffsets[3]!.x}px`,
    '--drift-y-4': `${driftOffsets[3]!.y}px`,
    '--drift-x-5': `${driftOffsets[4]!.x}px`,
    '--drift-y-5': `${driftOffsets[4]!.y}px`,
    '--drift-duration': `${Math.round(random() * 20 + 26)}s`,
    '--drift-delay': `${Math.round(random() * -20)}s`,
    '--entry-angle': `${angle}deg`,
    '--entry-angle-27': `${Math.round(angle + angleSway * 0.35)}deg`,
    '--entry-angle-61': `${Math.round(angle - angleSway * 0.55)}deg`,
    '--entry-angle-100': `${Math.round(angle + angleSway)}deg`,
    '--entry-opacity': `${(random() * 0.22 + 0.68).toFixed(2)}`,
    '--entry-size': `${Math.round(random() * 2 + 11)}px`,
  }
}

function nextBlackHoleWave() {
  if (!props.blackHoleView || listLoading.value || blackHoleTotalCount.value === 0) return
  void loadBlackHoleWave()
}

function handleBlackHolePointerDown(event: PointerEvent) {
  if (!event.isPrimary) return
  blackHoleSwipeHandled.value = false
  blackHolePointerStart.value = { x: event.clientX, y: event.clientY }
  const target = event.target
  const captureTarget =
    target instanceof Element
      ? ((target.closest('.black-hole-content-text') as HTMLElement | null) ??
        (event.currentTarget as HTMLElement))
      : (event.currentTarget as HTMLElement)
  captureTarget.setPointerCapture(event.pointerId)
}

function handleBlackHolePointerUp(event: PointerEvent) {
  const start = blackHolePointerStart.value
  blackHolePointerStart.value = undefined
  if (!start || event.type === 'pointercancel' || !event.isPrimary) return
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 40) {
    blackHoleSwipeHandled.value = true
    nextBlackHoleWave()
  }
}

function applyGalaxyData(data: Partial<GalaxyStarListResponse>) {
  if (
    !Array.isArray(data.stars) ||
    !Array.isArray(data.connections) ||
    !Array.isArray(data.hiddenStarIds) ||
    !Array.isArray(data.blackHoleEntries) ||
    typeof data.totalCount !== 'number'
  ) {
    throw new Error('星星数据格式无效')
  }
  rememberSourceStarColors(data.stars)
  sentStars.value = data.stars.map(withSourceStarColors)
  hiddenStarIds.value = data.hiddenStarIds
  blackHoleEntries.value = data.blackHoleEntries
  blackHoleTotalCount.value = data.totalCount
  if (props.blackHoleView) blackHoleListLoaded.value = true
  galaxyScene?.setSentStars(sentStars.value)
  galaxyScene?.setDownvotedStarIds(hiddenStarIds.value)
  galaxyScene?.setConnections(data.connections)
  if (selectedStar.value) {
    const updatedSelection = sentStars.value.find((star) => star.id === selectedStar.value?.id)
    if (updatedSelection) {
      selectedStar.value = updatedSelection
    } else if (!props.blackHoleView) {
      selectedStar.value = undefined
    }
  }
}

async function loadGalaxyStars() {
  try {
    const listRequest = post('/wpi/user/galaxy-star/list', listLoading, {
      ...currentListViewParams(),
    })
    const statusRequest = canViewStarDetails.value
      ? post('/wpi/user/galaxy-star/status', statusLoading)
      : Promise.resolve(undefined)
    const [listPacket, statusPacket] = await Promise.all([listRequest, statusRequest])
    const listData = listPacket.data as Partial<GalaxyStarListResponse> | undefined
    const statusData = statusPacket?.data as
      {
        hasSentToday?: boolean
        todayStarId?: string
        lastStarColor?: string
        resetsAt?: string
      } | undefined
    if (!listData) {
      throw new Error('星星数据格式无效')
    }
    applyGalaxyData(listData)
    if (props.blackHoleView) {
      galaxyScene?.setBlackHoleAccretionColor(statusData?.lastStarColor)
    }
    if (
      canViewStarDetails.value &&
      statusData &&
      typeof statusData.hasSentToday === 'boolean' &&
      typeof statusData.resetsAt === 'string'
    ) {
      todayStarId.value = statusData.todayStarId ?? ''
      if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
      const resetDelay = Date.parse(statusData.resetsAt) - Date.now()
      if (Number.isFinite(resetDelay)) {
        dailyResetTimer = window.setTimeout(
          () => void loadGalaxyStars(),
          Math.max(0, resetDelay) + 250,
        )
      }
    } else {
      todayStarId.value = ''
      if (dailyResetTimer !== undefined) {
        window.clearTimeout(dailyResetTimer)
        dailyResetTimer = undefined
      }
    }
  } catch (error) {
    console.error('读取银河星星失败', error)
    sceneError.value = '星星加载失败，请刷新后重试。'
  }
}

async function loadBlackHoleWave() {
  try {
    const packet = await post('/wpi/user/galaxy-star/list', listLoading, {
      view: 'blackhole',
      limit: blackHoleWaveSize,
      excludeIds: blackHoleEntries.value.map((entry) => entry.id),
    })
    applyGalaxyData(packet.data as Partial<GalaxyStarListResponse>)
  } catch (error) {
    console.error('读取下一批黑洞星星失败', error)
    sceneError.value = '下一批星星加载失败，请稍后重试。'
  }
}

function handleStarSent(event: Event) {
  const star = (event as CustomEvent<SentGalaxyStar>).detail
  if (!star || sentStars.value.some((existing) => existing.id === star.id)) return
  const ownedStar: GalaxyStarView = {
    ...star,
    likeCount: 0,
    dislikeCount: 0,
    connectionCount: 0,
    comments: [],
    isOwn: true,
  }
  sentStars.value = [...sentStars.value, ownedStar]
  todayStarId.value = star.id
  galaxyScene?.setSentStars(sentStars.value)
  animateSentStarIntoGalaxy(star)
  galaxyScene?.setDownvotedStarIds(hiddenStarIds.value)
  void refreshGalaxyAfterStarSent()
}

function animateSentStarIntoGalaxy(star: SentGalaxyStar) {
  if (props.blackHoleView || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const button = document.querySelector<HTMLButtonElement>('.star-compose-submit')
  const destination = galaxyScene?.sentStarScreenPosition(star.id)
  if (!button || !destination) return

  const source = button.getBoundingClientRect()
  const bounds = canvasHost.value?.getBoundingClientRect()
  if (!bounds) return
  const startX = source.left + source.width / 2
  const startY = source.top + source.height / 2
  const endX = Math.min(bounds.right, Math.max(bounds.left, destination.x))
  const endY = Math.min(bounds.bottom, Math.max(bounds.top, destination.y))
  const deltaX = endX - startX
  const deltaY = endY - startY
  const distance = Math.max(1, Math.hypot(deltaX, deltaY))
  const arc = Math.min(140, distance * 0.24)
  const controlX = (startX + endX) / 2 - (deltaY / distance) * arc
  const controlY = (startY + endY) / 2 + (deltaX / distance) * arc
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  trail.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`)
  Object.assign(trail.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1999',
    width: '100vw',
    height: '100vh',
    overflow: 'visible',
    pointerEvents: 'none',
    filter: `drop-shadow(0 0 5px ${star.color})`,
  })
  const trailPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  trailPath.setAttribute(
    'd',
    `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
  )
  trailPath.setAttribute('fill', 'none')
  trailPath.setAttribute('visibility', 'hidden')
  trail.append(trailPath)
  const tailSegments = Array.from({ length: 12 }, () => {
    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    segment.setAttribute('stroke', star.color)
    segment.setAttribute('stroke-linecap', 'round')
    trail.append(segment)
    return segment
  })
  document.body.append(trail)

  const flight = document.createElement('span')
  flight.textContent = '★'
  Object.assign(flight.style, {
    position: 'fixed',
    zIndex: '2000',
    left: '0',
    top: '0',
    color: star.color,
    fontSize: '28px',
    lineHeight: '1',
    pointerEvents: 'none',
    textShadow: `0 0 8px ${star.color}, 0 0 20px ${star.color}`,
    transform: `translate(${startX}px, ${startY}px) translate(-50%, -50%) scale(0.55)`,
  })
  document.body.append(flight)
  const pathLength = trailPath.getTotalLength()
  const tailLength = Math.min(64, pathLength * 0.18)
  const startTime = performance.now()
  const duration = 1400
  const animate = (now: number) => {
    const progress = Math.min(1, (now - startTime) / duration)
    const easedProgress = 1 - Math.pow(1 - progress, 2.4)
    const currentDistance = pathLength * easedProgress
    const point = trailPath.getPointAtLength(currentDistance)
    const visibleTailLength = Math.min(tailLength, currentDistance)
    const tailFade = 1 - Math.max(0, progress - 0.82) / 0.18
    tailSegments.forEach((segment, index) => {
      const headProgress = 1 - index / tailSegments.length
      const segmentEnd = currentDistance - (visibleTailLength * index) / tailSegments.length
      const segmentStart =
        currentDistance - (visibleTailLength * (index + 1)) / tailSegments.length
      const from = trailPath.getPointAtLength(Math.max(0, segmentStart))
      const to = trailPath.getPointAtLength(Math.max(0, segmentEnd))
      segment.setAttribute('x1', String(from.x))
      segment.setAttribute('y1', String(from.y))
      segment.setAttribute('x2', String(to.x))
      segment.setAttribute('y2', String(to.y))
      segment.setAttribute('stroke-width', String(0.5 + headProgress * 2.5))
      segment.setAttribute('opacity', String(headProgress * 0.72 * tailFade))
    })
    flight.style.left = `${point.x}px`
    flight.style.top = `${point.y}px`
    flight.style.opacity = String(Math.min(1, progress * 7) * tailFade)
    const scale = 0.55 + Math.min(1, progress * 7) * 0.45 - easedProgress * 0.65
    flight.style.transform = `translate(-50%, -50%) scale(${scale})`
    if (progress < 1) {
      requestAnimationFrame(animate)
      return
    }
    trail.remove()
    flight.remove()
  }
  requestAnimationFrame(animate)
}

async function handleNavigateToStar(event: Event) {
  if (props.blackHoleView) return
  const starId = (event as CustomEvent<string>).detail
  if (typeof starId !== 'string' || !starId) return
  const requestId = ++starNavigationRequestId
  try {
    if (!sentStars.value.some((star) => star.id === starId)) await loadGalaxyStars()
    if (requestId !== starNavigationRequestId) return
    const star = sentStars.value.find((candidate) => candidate.id === starId)
    if (!star || !galaxyScene?.navigateToSentStar(starId)) {
      throw new Error('未能定位到当天寄出的星星')
    }
  } catch (error) {
    if (requestId !== starNavigationRequestId) return
    console.error('前往当天寄出的星星失败', error)
    sceneError.value = '前往当天寄出的星星失败，请稍后重试。'
  }
}

async function handleNavigateToRandomStar() {
  if (props.blackHoleView) return
  const requestId = ++starNavigationRequestId
  try {
    if (!sentStars.value.length) await loadGalaxyStars()
    if (requestId !== starNavigationRequestId) return
    if (!sentStars.value.length) {
      sceneError.value = '当前没有可定位的寄出星星。'
      return
    }
    const index = Math.floor(Math.random() * sentStars.value.length)
    const star = sentStars.value[index]
    if (!star || !galaxyScene?.navigateToSentStar(star.id)) {
      throw new Error('未能定位到随机寄出的星星')
    }
  } catch (error) {
    if (requestId !== starNavigationRequestId) return
    console.error('前往随机寄出的星星失败', error)
    sceneError.value = '前往随机寄出的星星失败，请稍后重试。'
  }
}

function handleUserInteraction() {
  starNavigationRequestId += 1
  galaxyScene?.stopNavigation()
}

async function refreshGalaxyAfterStarSent() {
  try {
    const packet = await post('/wpi/user/galaxy-star/list', listLoading, {
      ...currentListViewParams(true),
    })
    applyGalaxyData(packet.data as Partial<GalaxyStarListResponse>)
  } catch (error) {
    console.error('刷新星星评论关联失败', error)
    sceneError.value = '星星已发送，但评论关联刷新失败，请重新加载页面。'
  }
}

function selectSentStar(star: SentGalaxyStar) {
  if (blackHoleSwipeHandled.value) return
  if (!canViewStarDetails.value) {
    const listedStar = sentStars.value.find((candidate) => candidate.id === star.id)
    if (listedStar && !listedStar.isOwn) {
      window.dispatchEvent(new Event(TIME_FORTUNE_TOGGLE_EVENT))
    }
    return
  }
  selectedStar.value = sentStars.value.find((candidate) => candidate.id === star.id)
  selectedCommentId.value = ''
  selectedBlackHoleEntryKind.value = undefined
  voteError.value = ''
}

async function openBlackHoleEntry(entry: GalaxyBlackHoleEntry) {
  if (blackHoleSwipeHandled.value || !canViewStarDetails.value || blackHoleContentLoading.value)
    return
  try {
    const packet = await post('/wpi/user/galaxy-star/blackhole-content', blackHoleContentLoading, {
      entryId: entry.id,
    })
    const data = packet.data as { star?: GalaxyStarView; selectedCommentId?: string } | undefined
    if (!data?.star) throw new Error('黑洞内容详情格式无效')
    selectedStar.value = await resolveSourceStarColors(data.star)
    selectedCommentId.value = data.selectedCommentId ?? ''
    selectedBlackHoleEntryKind.value = entry.kind
    voteError.value = ''
    await nextTick()
    if (selectedCommentId.value) {
      document
        .getElementById(`sent-star-comment-${selectedCommentId.value}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } else if (entry.kind === 'star') {
      document
        .getElementById('sent-star-black-hole-content')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  } catch (error) {
    console.error('读取黑洞内容详情失败', error)
    sceneError.value =
      (error as { msg?: string; message?: string }).msg ||
      (error as { message?: string }).message ||
      '该内容已不再符合黑洞条件，请刷新后重试。'
  }
}

async function voteForStar(star: GalaxyStarView, vote: GalaxyStarVote) {
  if (voteLoading.value) return
  voteError.value = ''
  voteLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star/vote', voteRequestLoading, {
      starId: star.id,
      vote,
      ...(props.blackHoleView ? { view: 'normal' } : currentListViewParams(true)),
    })
    const data = packet.data as Partial<GalaxyStarListResponse>
    if (props.blackHoleView) {
      const updatedStar = data.stars?.find((candidate) => candidate.id === star.id)
      if (!updatedStar) throw new Error('星星评价数据格式无效')
      selectedStar.value = updatedStar
      sentStars.value = sentStars.value.map((candidate) =>
        candidate.id === updatedStar.id ? updatedStar : candidate,
      )
      const listPacket = await post(
        '/wpi/user/galaxy-star/list',
        listLoading,
        currentListViewParams(true),
      )
      applyGalaxyData(listPacket.data as Partial<GalaxyStarListResponse>)
    } else {
      applyGalaxyData(data)
    }
  } catch (error) {
    console.error('提交星星评价失败', error)
    voteError.value =
      (error as { msg?: string; message?: string }).msg ||
      (error as { message?: string }).message ||
      '评价失败，请稍后重试。'
  } finally {
    voteLoading.value = false
  }
}

async function voteForComment(
  star: GalaxyStarView,
  comment: GalaxyStarComment,
  vote: GalaxyStarVote,
) {
  if (voteLoading.value) return
  voteError.value = ''
  voteLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star/comment-vote', voteRequestLoading, {
      starId: star.id,
      commentId: comment.id,
      vote,
    })
    const data = packet.data as { star?: GalaxyStarView } | undefined
    if (!data?.star) throw new Error('评论评价数据格式无效')
    const updatedStar = await resolveSourceStarColors(data.star)
    selectedStar.value = updatedStar
    sentStars.value = sentStars.value.map((candidate) =>
      candidate.id === updatedStar.id ? updatedStar : candidate,
    )
    if (props.blackHoleView) {
      const listPacket = await post(
        '/wpi/user/galaxy-star/list',
        listLoading,
        currentListViewParams(true),
      )
      applyGalaxyData(listPacket.data as Partial<GalaxyStarListResponse>)
    } else {
      void loadGalaxyStars()
    }
  } catch (error) {
    console.error('提交评论评价失败', error)
    voteError.value =
      (error as { msg?: string; message?: string }).msg ||
      (error as { message?: string }).message ||
      '评价失败，请稍后重试。'
  } finally {
    voteLoading.value = false
  }
}

async function commentOnStar(star: GalaxyStarView, parentCommentId?: string) {
  const content = commentText.value.trim()
  if (!content || commentLoading.value) return
  commentError.value = ''
  commentLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star/comment', commentLoading, {
      starId: star.id,
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
      ...currentListViewParams(true),
    })
    if (props.blackHoleView) {
      const listPacket = await post('/wpi/user/galaxy-star/list', listLoading, {
        view: 'normal',
      })
      const data = listPacket.data as Partial<GalaxyStarListResponse>
      const updatedStar = data.stars?.find((candidate) => candidate.id === star.id)
      if (!updatedStar) throw new Error('评论更新后未能读取星星详情')
      selectedStar.value = updatedStar
      sentStars.value = sentStars.value.map((candidate) =>
        candidate.id === updatedStar.id ? updatedStar : candidate,
      )
    } else {
      applyGalaxyData(packet.data as Partial<GalaxyStarListResponse>)
    }
    commentText.value = ''
    replyingToCommentId.value = ''
  } catch (error) {
    console.error('提交星星评论失败', error)
    commentError.value =
      (error as { msg?: string; message?: string }).msg ||
      (error as { message?: string }).message ||
      '评论失败，请稍后重试。'
  } finally {
    commentLoading.value = false
  }
}

function toggleCommentReply(comment: GalaxyStarComment) {
  replyingToCommentId.value = replyingToCommentId.value === comment.id ? '' : comment.id
  commentText.value = ''
  commentError.value = ''
}

watch(
  () => props.blackHoleView,
  (enabled, previousEnabled) => {
    if (enabled === previousEnabled) return
    galaxyScene?.setBlackHoleView(enabled)
    void loadGalaxyStars()
    if (!enabled) void refreshCommentNotificationQueue()
  },
)

watch(canViewStarDetails, (canView, previousCanView) => {
  if (canView === previousCanView) return
  commentNotifications.value = []
  announceGalaxyStarCommentQueue(0)
  selectedStar.value = undefined
  todayStarId.value = ''
  if (!canView) {
    sentStars.value = sentStars.value.map((star) => ({
      ...star,
      content: '',
      comments: [],
      isOwn: false,
      myVote: undefined,
    }))
    galaxyScene?.setSentStars(sentStars.value)
  }
  void loadGalaxyStars()
  if (canView) void refreshCommentNotificationQueue()
})

function handlePointerDown(event: PointerEvent) {
  galaxyScene?.pointerDown(event)
}

function handlePointerMove(event: PointerEvent) {
  galaxyScene?.pointerMove(event)
}

function handlePointerUp(event: PointerEvent) {
  galaxyScene?.pointerUp(event)
}

function handleWheel(event: WheelEvent) {
  galaxyScene?.wheel(event)
}

function handleCameraZoomOut() {
  galaxyScene?.zoomOut()
}

function handleCameraCenter() {
  galaxyScene?.centerView()
}

function handleCameraDefault() {
  galaxyScene?.resetView()
}

onMounted(() => {
  if (canvasHost.value) {
    galaxyScene = new GalaxyScene(
      canvasHost.value,
      selectSentStar,
      () => void router.push({ name: 'blackhole' }),
      props.blackHoleView,
    )
    window.addEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
    window.addEventListener(GALAXY_STAR_NAVIGATE_EVENT, handleNavigateToStar)
    window.addEventListener(GALAXY_STAR_NAVIGATE_RANDOM_EVENT, handleNavigateToRandomStar)
    window.addEventListener(GALAXY_STAR_COMMENT_OPEN_EVENT, openNextCommentedStar)
    window.addEventListener(GALAXY_CAMERA_ZOOM_OUT_EVENT, handleCameraZoomOut)
    window.addEventListener(GALAXY_CAMERA_CENTER_EVENT, handleCameraCenter)
    window.addEventListener(GALAXY_CAMERA_DEFAULT_EVENT, handleCameraDefault)
    document.addEventListener('pointerdown', handleUserInteraction)
    document.addEventListener('wheel', handleUserInteraction)
    document.addEventListener('keydown', handleUserInteraction)
    void loadGalaxyStars()
    void refreshCommentNotificationQueue()
    commentNotificationTimer = window.setInterval(() => {
      void refreshCommentNotificationQueue()
    }, 30_000)
  }
})

onBeforeUnmount(() => {
  if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
  if (commentNotificationTimer !== undefined) window.clearInterval(commentNotificationTimer)
  window.removeEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
  window.removeEventListener(GALAXY_STAR_NAVIGATE_EVENT, handleNavigateToStar)
  window.removeEventListener(GALAXY_STAR_NAVIGATE_RANDOM_EVENT, handleNavigateToRandomStar)
  window.removeEventListener(GALAXY_STAR_COMMENT_OPEN_EVENT, openNextCommentedStar)
  window.removeEventListener(GALAXY_CAMERA_ZOOM_OUT_EVENT, handleCameraZoomOut)
  window.removeEventListener(GALAXY_CAMERA_CENTER_EVENT, handleCameraCenter)
  window.removeEventListener(GALAXY_CAMERA_DEFAULT_EVENT, handleCameraDefault)
  document.removeEventListener('pointerdown', handleUserInteraction)
  document.removeEventListener('wheel', handleUserInteraction)
  document.removeEventListener('keydown', handleUserInteraction)
  galaxyScene?.destroy()
  galaxyScene = undefined
})
</script>

<template>
  <main class="galaxy-demo" :class="{ 'black-hole-view': props.blackHoleView }"
    :aria-label="props.blackHoleView ? '黑洞星域' : '旋转星空 Demo'">
    <section v-if="props.blackHoleView" class="black-hole-list" aria-label="被踩内容"
      @pointerdown="handleBlackHolePointerDown" @pointerup="handleBlackHolePointerUp"
      @pointercancel="handleBlackHolePointerUp">
      <p v-if="listLoading && !blackHoleListLoaded" class="black-hole-empty">
        正在搜寻被引力捕获的内容…
      </p>
      <p v-else-if="blackHoleWave.length === 0" class="black-hole-empty">暂无符合条件的内容</p>
      <template v-else>
        <Transition name="black-hole-wave" :css="!voteLoading">
          <div :key="blackHoleWaveKey" class="black-hole-content-list">
            <div v-for="(entry, index) in blackHoleWave" :key="entry.id" class="black-hole-content-entry"
              :style="blackHoleEntryStyles[index]">
              <button class="black-hole-content-text" type="button"
                :aria-label="`打开被踩${entry.kind === 'comment' ? '评论' : '星体内容'}，被踩 ${entry.dislikeCount} 次`"
                @click="openBlackHoleEntry(entry)">
                {{ entry.content }}
              </button>
            </div>
          </div>
        </Transition>
      </template>
    </section>
    <section ref="canvasHost" class="galaxy-canvas" @pointerdown="handlePointerDown" @pointermove="handlePointerMove"
      @pointerup="handlePointerUp" @pointercancel="handlePointerUp" @wheel.prevent="handleWheel"></section>
    <p v-if="sceneError" class="galaxy-scene-error" role="alert">{{ sceneError }}</p>
    <GalaxyStarDetailsDialog
      :open="Boolean(selectedStar)"
      :star="selectedStar"
      :black-hole-view="props.blackHoleView"
      :selected-black-hole-entry-kind="selectedBlackHoleEntryKind"
      :selected-comment-id="selectedCommentId"
      :has-sent-today="hasSentToday"
      :vote-loading="voteLoading"
      :vote-error="voteError"
      :comment-loading="commentLoading"
      :comment-error="commentError"
      :comment-text="commentText"
      :replying-to-comment-id="replyingToCommentId"
      @close="selectedStar = undefined"
      @update:comment-text="commentText = $event"
      @toggle-reply="toggleCommentReply"
      @vote-star="selectedStar && voteForStar(selectedStar, $event)"
      @vote-comment="selectedStar && voteForComment(selectedStar, $event.comment, $event.vote)"
      @comment="selectedStar && commentOnStar(selectedStar, $event)"
    />
  </main>
</template>

<style scoped>
.galaxy-demo {
  position: fixed;
  inset: 0;
  isolation: isolate;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(circle at 50% 52%, #152441 0, #090e1d 33%, #02040b 72%);
  color: #eef4ff;
}

.black-hole-page-header {
  position: absolute;
  top: max(20px, env(safe-area-inset-top));
  left: max(20px, env(safe-area-inset-left));
  z-index: 3;
  display: flex;
  align-items: center;
  padding: 12px 18px;
  border: 1px solid rgba(150, 184, 232, 0.22);
  border-radius: 16px;
  background: rgba(5, 11, 27, 0.74);
  backdrop-filter: blur(12px);
}

.black-hole-page-header h1 {
  margin: 0;
  color: #d5c7ff;
  font-size: 18px;
}

.black-hole-page-header p {
  margin: 4px 0 0;
  color: #a9bfd9;
  font-size: 12px;
}

.black-hole-list {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: radial-gradient(ellipse at center, rgba(2, 5, 16, 0.12), rgba(2, 4, 12, 0.3));
  touch-action: none;
  user-select: none;
}

.black-hole-content-list {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(90vw, 90dvh);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  clip-path: circle(50%);
  overflow: hidden;
  pointer-events: none;
}

.black-hole-wave-enter-active,
.black-hole-wave-leave-active {
  transition: opacity 320ms ease;
}

.black-hole-wave-enter-from,
.black-hole-wave-leave-to {
  opacity: 0;
}

.black-hole-wave-enter-active {
  z-index: 1;
}

.black-hole-wave-leave-active {
  z-index: 0;
  pointer-events: none;
}

.black-hole-content-entry {
  position: absolute;
  top: var(--entry-y);
  left: var(--entry-x);
  width: 14%;
  padding: 4px;
  transform: translate(-50%, -50%) rotate(var(--entry-angle));
  animation: black-hole-drift var(--drift-duration) ease-in-out var(--drift-delay) infinite alternate;
  border: 0;
  background: transparent;
  color: rgba(229, 234, 250, var(--entry-opacity));
  cursor: pointer;
  filter: drop-shadow(0 0 10px rgba(165, 190, 255, 0.36));
  pointer-events: auto;
  text-align: left;
  text-shadow:
    0 0 12px rgba(147, 173, 255, 0.68),
    0 1px 8px #02040b;
  transition:
    color 180ms ease,
    filter 180ms ease;
}

.black-hole-content-entry:hover {
  color: #ffffff;
  filter: drop-shadow(0 0 14px rgba(195, 209, 255, 0.8));
}

@keyframes black-hole-drift {
  0% {
    transform: translate3d(-50%, -50%, 0) rotate(var(--entry-angle));
  }

  17% {
    transform: translate3d(calc(-50% + var(--drift-x-1)), calc(-50% + var(--drift-y-1)), 0) rotate(var(--entry-angle-27));
  }

  39% {
    transform: translate3d(calc(-50% + var(--drift-x-2)), calc(-50% + var(--drift-y-2)), 0) rotate(var(--entry-angle-61));
  }

  57% {
    transform: translate3d(calc(-50% + var(--drift-x-3)), calc(-50% + var(--drift-y-3)), 0) rotate(var(--entry-angle-27));
  }

  78% {
    transform: translate3d(calc(-50% + var(--drift-x-4)), calc(-50% + var(--drift-y-4)), 0) rotate(var(--entry-angle-61));
  }

  94% {
    transform: translate3d(calc(-50% + var(--drift-x-5)), calc(-50% + var(--drift-y-5)), 0) rotate(var(--entry-angle-100));
  }

  100% {
    transform: translate3d(-50%, -50%, 0) rotate(var(--entry-angle));
  }
}

.black-hole-content-text {
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: clamp(9px, var(--entry-size), 16px);
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

@media (prefers-reduced-motion: reduce) {
  .black-hole-content-entry {
    animation: none;
  }
}

.black-hole-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  margin: 0;
  transform: translate(-50%, -50%);
  color: #b7c8e2;
  text-align: center;
}

.galaxy-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.galaxy-canvas:active {
  cursor: grabbing;
}

.galaxy-canvas :deep(canvas) {
  position: absolute;
  inset: 0;
  display: block;
  max-width: none;
  width: 100%;
  height: 100%;
}

.galaxy-scene-error {
  position: absolute;
  top: 20px;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  margin: 0;
  padding: 10px 16px;
  border: 1px solid rgba(255, 159, 186, 0.5);
  border-radius: 12px;
  background: rgba(30, 9, 22, 0.85);
  color: #ffd9e3;
}
</style>
