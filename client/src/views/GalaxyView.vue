<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type {
  GalaxyStarComment,
  GalaxyStarListResponse,
  GalaxyStarView,
  GalaxyStarVote,
  SentGalaxyStar,
} from '../../../common/entity/galaxy-star'
import GalaxyStarComposer from '@/components/GalaxyStarComposer.vue'
import { post } from '@/scripts/request'
import {
  GALAXY_STAR_COMPOSE_EVENT,
  GALAXY_STAR_SEND_STATUS_EVENT,
  GALAXY_STAR_SENT_EVENT,
} from '@/events/galaxy-star'
import { TIME_FORTUNE_OPEN_EVENT } from '@/events/time-fortune'
import { GalaxyScene } from '../scripts/core/galaxy/GalaxyScene.ts'
import { createGalaxyStarTextureCanvas } from '../scripts/core/galaxy/starTexture'

const props = withDefaults(defineProps<{ blackHoleView?: boolean }>(), {
  blackHoleView: false,
})
const router = useRouter()
const canvasHost = ref<HTMLElement | null>(null)
const sceneError = ref('')
const sentStars = ref<GalaxyStarView[]>([])
const selectedStar = ref<GalaxyStarView>()
const listLoading = ref(false)
const blackHoleListLoaded = ref(false)
const statusLoading = ref(false)
const voteLoading = ref(false)
const voteError = ref('')
const commentLoading = ref(false)
const commentError = ref('')
const commentText = ref('')
const replyingToCommentId = ref('')
const todayStarId = ref('')
const canSendStar = ref(false)
const hiddenStarIds = ref<string[]>([])
const blackHoleTotalCount = ref(0)
const viewportSize = ref({ width: window.innerWidth, height: window.innerHeight })
const blackHolePointerStart = ref<{ x: number; y: number }>()
const blackHoleSwipeHandled = ref(false)
const hasSentToday = computed(() => Boolean(todayStarId.value))
const downvotedStars = computed(() => sentStars.value.filter(isBlackHoleStar))
const blackHolePlanetRadius = computed(
  () => Math.min(viewportSize.value.width, viewportSize.value.height) * 0.45,
)
const blackHoleLayoutRadius = computed(() => Math.max(0, blackHolePlanetRadius.value - 72))
const blackHoleWaveSize = 20
const blackHoleWave = computed(() => downvotedStars.value)
const blackHoleWaveKey = computed(() => blackHoleWave.value.map((star) => star.id).join(':'))
const blackHolePlanetLayouts = computed(() => {
  const stars = blackHoleWave.value
  const count = stars.length
  if (count === 0) return []
  const radius = blackHoleLayoutRadius.value
  const planetSize = Math.max(20, Math.min(42, Math.sqrt((Math.PI * radius ** 2) / count) * 0.45))
  const minDistance = Math.max(34, planetSize + 8)
  let seed = stars.reduce((value, star) => {
    for (let index = 0; index < star.id.length; index += 1) {
      value = Math.imul(value ^ star.id.charCodeAt(index), 16777619)
    }
    return value >>> 0
  }, 2166136261)
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const positions: { x: number; y: number }[] = []
  for (let index = 0; index < count; index += 1) {
    let candidate: { x: number; y: number } | undefined
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * radius
      const next = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
      if (
        positions.every(
          (position) => Math.hypot(position.x - next.x, position.y - next.y) >= minDistance,
        )
      ) {
        candidate = next
        break
      }
    }
    if (!candidate) {
      const distance = radius * Math.sqrt((index + 0.5) / count)
      const angle = index * Math.PI * (3 - Math.sqrt(5))
      candidate = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
    }
    positions.push(candidate)
  }
  return stars.map((star, index) => {
    const position = positions[index]!
    return {
      star,
      style: {
        left: `${50 + (position.x / viewportSize.value.width) * 100}%`,
        top: `${50 + (position.y / viewportSize.value.height) * 100}%`,
        '--planet-color': star.color,
        '--planet-size': `${planetSize}px`,
        '--star-texture': `url("${createGalaxyStarTextureCanvas(star.color).toDataURL()}")`,
        '--twinkle-delay': `${random() * -3}s`,
      },
    }
  })
})
let galaxyScene: GalaxyScene | undefined
let dailyResetTimer: number | undefined

function currentListViewParams(preserveBlackHoleWave = false) {
  return {
    view: props.blackHoleView ? 'blackhole' : 'normal',
    ...(props.blackHoleView
      ? {
          limit: blackHoleWaveSize,
          ...(preserveBlackHoleWave ? { includeIds: sentStars.value.map((star) => star.id) } : {}),
        }
      : {}),
  }
}

function isBlackHoleStar(star: GalaxyStarView) {
  return star.dislikeCount > 8 && star.dislikeCount > star.likeCount * 1.5
}

function updateBlackHoleGridSize() {
  viewportSize.value = { width: window.innerWidth, height: window.innerHeight }
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
      ? ((target.closest('.black-hole-planet') as HTMLElement | null) ??
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
    typeof data.totalCount !== 'number'
  ) {
    throw new Error('星星数据格式无效')
  }
  sentStars.value = data.stars
  hiddenStarIds.value = data.hiddenStarIds
  blackHoleTotalCount.value = data.totalCount
  if (props.blackHoleView) blackHoleListLoaded.value = true
  galaxyScene?.setSentStars(sentStars.value)
  galaxyScene?.setDownvotedStarIds(hiddenStarIds.value)
  galaxyScene?.setConnections(data.connections)
  if (selectedStar.value) {
    const updatedSelection = sentStars.value.find((star) => star.id === selectedStar.value?.id)
    selectedStar.value =
      updatedSelection && (props.blackHoleView || !isBlackHoleStar(updatedSelection))
        ? updatedSelection
        : undefined
  }
}

async function loadGalaxyStars() {
  try {
    const [listPacket, statusPacket] = await Promise.all([
      post('/wpi/user/galaxy-star', listLoading, {
        action: 'list',
        ...currentListViewParams(),
      }),
      post('/wpi/user/galaxy-star', statusLoading, { action: 'status' }),
    ])
    const listData = listPacket.data as Partial<GalaxyStarListResponse> | undefined
    const statusData = statusPacket.data as
      | { canSend?: boolean; hasSentToday?: boolean; todayStarId?: string; resetsAt?: string }
      | undefined
    if (
      !listData ||
      !statusData ||
      typeof statusData.canSend !== 'boolean' ||
      typeof statusData.hasSentToday !== 'boolean' ||
      typeof statusData.resetsAt !== 'string'
    ) {
      throw new Error('星星数据格式无效')
    }
    applyGalaxyData(listData)
    todayStarId.value = statusData.todayStarId ?? ''
    canSendStar.value = statusData.canSend
    galaxyScene?.setStarSendAvailable(canSendStar.value && !props.blackHoleView)
    if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
    const resetDelay = Date.parse(statusData.resetsAt) - Date.now()
    if (Number.isFinite(resetDelay)) {
      dailyResetTimer = window.setTimeout(
        () => void loadGalaxyStars(),
        Math.max(0, resetDelay) + 250,
      )
    }
  } catch (error) {
    console.error('读取银河星星失败', error)
    sceneError.value = '星星加载失败，请刷新后重试。'
  }
}

async function loadBlackHoleWave() {
  try {
    const packet = await post('/wpi/user/galaxy-star', listLoading, {
      action: 'list',
      view: 'blackhole',
      limit: blackHoleWaveSize,
      excludeIds: sentStars.value.map((star) => star.id),
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
  canSendStar.value = false
  galaxyScene?.setSentStars(sentStars.value)
  galaxyScene?.setDownvotedStarIds(hiddenStarIds.value)
  galaxyScene?.setStarSendAvailable(false)
  void refreshGalaxyAfterStarSent()
}

async function refreshGalaxyAfterStarSent() {
  try {
    const packet = await post('/wpi/user/galaxy-star', listLoading, {
      action: 'list',
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
  selectedStar.value = sentStars.value.find((candidate) => candidate.id === star.id)
  voteError.value = ''
}

async function voteForStar(star: GalaxyStarView, vote: GalaxyStarVote) {
  if (!hasSentToday.value || star.isOwn || star.myVote || voteLoading.value) return
  voteError.value = ''
  voteLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star', voteLoading, {
      action: 'vote',
      starId: star.id,
      vote,
      ...currentListViewParams(true),
    })
    applyGalaxyData(packet.data as Partial<GalaxyStarListResponse>)
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

async function commentOnStar(star: GalaxyStarView, parentCommentId?: string) {
  const content = commentText.value.trim()
  if (!content || commentLoading.value) return
  commentError.value = ''
  commentLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star', commentLoading, {
      action: 'comment',
      starId: star.id,
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
      ...currentListViewParams(true),
    })
    applyGalaxyData(packet.data as Partial<GalaxyStarListResponse>)
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

function commentThreads(comments: GalaxyStarComment[]) {
  const flattened: (GalaxyStarComment & { depth: number; replyToTitle?: string })[] = []
  const appendReplies = (parentCommentId: string, depth: number, parentTitle: string) => {
    comments
      .filter((comment) => comment.parentCommentId === parentCommentId)
      .forEach((comment) => {
        flattened.push({ ...comment, depth, replyToTitle: parentTitle || '匿名用户' })
        appendReplies(comment.id, depth + 1, comment.sourceStarTitle ?? '匿名用户')
      })
  }
  comments
    .filter((comment) => !comment.parentCommentId)
    .forEach((comment) => {
      flattened.push({ ...comment, depth: 0 })
      appendReplies(comment.id, 1, comment.sourceStarTitle ?? '匿名用户')
    })
  return flattened
}

const selectedCommentThreads = computed(() =>
  selectedStar.value ? commentThreads(selectedStar.value.comments) : [],
)

function toggleCommentReply(comment: GalaxyStarComment) {
  replyingToCommentId.value = replyingToCommentId.value === comment.id ? '' : comment.id
  commentText.value = ''
  commentError.value = ''
}

function handleStarSendStatus(event: Event) {
  canSendStar.value = (event as CustomEvent<boolean>).detail
  galaxyScene?.setStarSendAvailable(canSendStar.value && !props.blackHoleView)
}

watch(
  () => props.blackHoleView,
  (enabled, previousEnabled) => {
    if (enabled === previousEnabled) return
    galaxyScene?.setBlackHoleView(enabled)
    galaxyScene?.setStarSendAvailable(canSendStar.value && !enabled)
    void loadGalaxyStars()
  },
)

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

onMounted(() => {
  updateBlackHoleGridSize()
  window.addEventListener('resize', updateBlackHoleGridSize)
})

onMounted(() => {
  if (canvasHost.value) {
    galaxyScene = new GalaxyScene(
      canvasHost.value,
      () => window.dispatchEvent(new Event(TIME_FORTUNE_OPEN_EVENT)),
      () => window.dispatchEvent(new Event(GALAXY_STAR_COMPOSE_EVENT)),
      selectSentStar,
      () => void router.push({ name: 'blackhole' }),
      props.blackHoleView,
    )
    window.addEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
    window.addEventListener(GALAXY_STAR_SEND_STATUS_EVENT, handleStarSendStatus)
    void loadGalaxyStars()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateBlackHoleGridSize)
  if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
  window.removeEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
  window.removeEventListener(GALAXY_STAR_SEND_STATUS_EVENT, handleStarSendStatus)
  galaxyScene?.destroy()
  galaxyScene = undefined
})
</script>

<template>
  <main
    class="galaxy-demo"
    :class="{ 'black-hole-view': props.blackHoleView }"
    :aria-label="props.blackHoleView ? '黑洞星域' : '旋转星空 Demo'"
  >
    <header v-if="props.blackHoleView" class="black-hole-page-header">
      <button type="button" @click="router.push({ name: 'galaxy' })">返回星空</button>
      <div>
        <h1>黑洞星域</h1>
        <p>踩数 > 赞数 × 1.5 且踩数 > 8 · 共 {{ blackHoleTotalCount }} 颗</p>
      </div>
    </header>
    <section
      v-if="props.blackHoleView"
      class="black-hole-list"
      aria-label="被踩星球"
      @pointerdown="handleBlackHolePointerDown"
      @pointerup="handleBlackHolePointerUp"
      @pointercancel="handleBlackHolePointerUp"
    >
      <p v-if="listLoading && !blackHoleListLoaded" class="black-hole-empty">
        正在搜寻被引力捕获的星球…
      </p>
      <p v-else-if="downvotedStars.length === 0" class="black-hole-empty">暂无符合条件的星球</p>
      <template v-else>
        <Transition name="black-hole-wave">
          <div :key="blackHoleWaveKey" class="black-hole-grid">
            <button
              v-for="layout in blackHolePlanetLayouts"
              :key="layout.star.id"
              class="black-hole-planet"
              type="button"
              :style="layout.style"
              :aria-label="`${layout.star.title}，被踩 ${layout.star.dislikeCount} 次`"
              @click="selectSentStar(layout.star)"
            >
              <span class="black-hole-planet-orb" aria-hidden="true"></span>
              <strong class="black-hole-planet-name">{{ layout.star.title }}</strong>
            </button>
          </div>
        </Transition>
        <p class="black-hole-wave-hint">
          {{ blackHoleWave.length }} / {{ blackHoleTotalCount }} · 滑动屏幕刷新下一波
        </p>
      </template>
    </section>
    <section
      ref="canvasHost"
      class="galaxy-canvas"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @wheel.prevent="handleWheel"
    ></section>
    <GalaxyStarComposer v-if="!props.blackHoleView" />
    <p v-if="sceneError" class="galaxy-scene-error" role="alert">{{ sceneError }}</p>
    <div
      v-if="selectedStar"
      class="sent-star-dialog-overlay"
      :style="{ '--star-color': selectedStar.color }"
      @click.self="selectedStar = undefined"
    >
      <section
        class="sent-star-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sent-star-dialog-title"
      >
        <header class="sent-star-dialog-header">
          <div>
            <span class="sent-star-dialog-eyebrow">星际回响</span>
            <h2 id="sent-star-dialog-title">{{ selectedStar.title }}</h2>
            <p class="sent-star-created-at">
              发送时间：<time>{{ selectedStar.createdAt }}</time>
            </p>
          </div>
          <button
            class="sent-star-close"
            type="button"
            aria-label="关闭星星详情"
            @click="selectedStar = undefined"
          >
            ×
          </button>
        </header>
        <div class="sent-star-dialog-scroll">
          <p class="sent-star-content">{{ selectedStar.content }}</p>
          <div class="sent-star-votes">
            <button
              type="button"
              :class="{ selected: selectedStar.myVote === 'like' }"
              :disabled="
                selectedStar.isOwn || !hasSentToday || voteLoading || Boolean(selectedStar.myVote)
              "
              @click="voteForStar(selectedStar, 'like')"
            >
              赞 <strong>{{ selectedStar.likeCount }}</strong>
            </button>
            <button
              type="button"
              :class="{ selected: selectedStar.myVote === 'dislike' }"
              :disabled="
                selectedStar.isOwn || !hasSentToday || voteLoading || Boolean(selectedStar.myVote)
              "
              @click="voteForStar(selectedStar, 'dislike')"
            >
              踩 <strong>{{ selectedStar.dislikeCount }}</strong>
            </button>
            <span class="sent-star-comment-count">{{ selectedStar.comments.length }} 条评论</span>
          </div>
          <p v-if="selectedStar.isOwn" class="sent-star-permission-hint">这是你寄出的星星</p>
          <p v-else-if="!hasSentToday" class="sent-star-permission-hint">
            寄出星星前的评论将匿名显示；寄出后会自动关联到你的星星
          </p>
          <p v-if="voteError" class="sent-star-vote-error" role="alert">{{ voteError }}</p>

          <section class="sent-star-comment-section" aria-labelledby="sent-star-comments-title">
            <h3 id="sent-star-comments-title">星际讨论</h3>
            <p v-if="!selectedStar.comments.length" class="sent-star-empty-comments">
              还没有评论，来留下第一条回响吧。
            </p>
            <ul v-else class="sent-star-comments">
              <li
                v-for="comment in selectedCommentThreads"
                :key="comment.id"
                class="sent-star-comment"
                :style="{ '--thread-depth': Math.min(comment.depth, 5) }"
              >
                <div class="sent-star-comment-author">
                  <strong>{{ comment.sourceStarTitle || '匿名用户' }}</strong>
                  <time>{{ comment.createdAt }}</time>
                </div>
                <p v-if="comment.replyToTitle" class="sent-star-reply-context">
                  回复 {{ comment.replyToTitle }}
                </p>
                <p class="sent-star-comment-content">{{ comment.content }}</p>
                <button
                  class="sent-star-reply-toggle"
                  type="button"
                  @click="toggleCommentReply(comment)"
                >
                  {{ replyingToCommentId === comment.id ? '取消回复' : '回复' }}
                </button>
                <form
                  v-if="replyingToCommentId === comment.id"
                  class="sent-star-comment-form sent-star-reply-form"
                  @submit.prevent="commentOnStar(selectedStar, comment.id)"
                >
                  <textarea
                    v-model="commentText"
                    maxlength="500"
                    rows="2"
                    :aria-label="`回复${comment.sourceStarTitle}`"
                    placeholder="写下回复…"
                    :disabled="commentLoading"
                  ></textarea>
                  <button type="submit" :disabled="commentLoading || !commentText.trim()">
                    {{ commentLoading ? '发送中…' : '发送回复' }}
                  </button>
                </form>
                <p
                  v-if="replyingToCommentId === comment.id && commentError"
                  class="sent-star-vote-error"
                  role="alert"
                >
                  {{ commentError }}
                </p>
              </li>
            </ul>
            <p
              v-if="commentError && !replyingToCommentId"
              class="sent-star-vote-error"
              role="alert"
            >
              {{ commentError }}
            </p>
          </section>
        </div>
        <form
          v-if="!replyingToCommentId"
          class="sent-star-comment-form sent-star-main-comment-form"
          @submit.prevent="commentOnStar(selectedStar)"
        >
          <textarea
            v-model="commentText"
            maxlength="500"
            rows="2"
            aria-label="评论内容"
            placeholder="参与讨论…"
            :disabled="commentLoading"
          ></textarea>
          <button type="submit" :disabled="commentLoading || !commentText.trim()">
            {{ commentLoading ? '发送中…' : '发送评论' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.galaxy-demo {
  position: relative;
  isolation: isolate;
  width: 100vw;
  height: 100dvh;
  min-height: 100vh;
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
  gap: 18px;
  padding: 12px 18px;
  border: 1px solid rgba(150, 184, 232, 0.22);
  border-radius: 16px;
  background: rgba(5, 11, 27, 0.74);
  backdrop-filter: blur(12px);
}

.black-hole-page-header button {
  padding: 8px 13px;
  border: 1px solid rgba(174, 203, 239, 0.32);
  border-radius: 999px;
  background: rgba(86, 121, 168, 0.2);
  color: #e8f1fb;
  cursor: pointer;
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

.black-hole-grid {
  position: absolute;
  inset: 0;
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

.black-hole-planet {
  position: absolute;
  display: flex;
  width: clamp(90px, 12vw, 132px);
  min-height: 60px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0;
  transform: translate(-50%, -50%);
  border: 0;
  background: transparent;
  color: #edf4ff;
  cursor: pointer;
  text-shadow: 0 1px 8px #02040b;
  transition:
    filter 180ms ease,
    z-index 180ms ease;
}

.black-hole-planet:hover {
  z-index: 1;
  filter: brightness(1.3);
}

.black-hole-planet-orb {
  width: calc(var(--planet-size) * 1.6);
  aspect-ratio: 1;
  flex: 0 0 auto;
  border-radius: 50%;
  background-image: var(--star-texture);
  background-size: contain;
  filter: drop-shadow(0 0 3px var(--planet-color));
  animation: black-hole-star-pulse 3s ease-in-out var(--twinkle-delay) infinite alternate;
}

@keyframes black-hole-star-pulse {
  from {
    opacity: 0.86;
    transform: scale(0.86);
  }

  to {
    opacity: 1;
    transform: scale(1.14);
  }
}

.black-hole-planet-name,
.black-hole-planet > span:last-child {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(8px, 1vh, 11px);
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.black-hole-planet-name {
  display: block;
  width: 100%;
  margin-top: 2px;
  overflow: visible;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  opacity: 1;
  text-align: center;
  text-overflow: clip;
  text-shadow:
    0 0 5px var(--planet-color),
    0 0 12px var(--planet-color),
    0 1px 8px #02040b;
  visibility: visible;
  -webkit-text-fill-color: #ffffff;
}

.black-hole-planet > span:last-child {
  color: #ffb7c5;
}

.black-hole-wave-hint {
  position: absolute;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(2, 5, 16, 0.58);
  color: #d4def0;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  text-shadow: 0 1px 8px #02040b;
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

.sent-star-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: rgba(1, 5, 14, 0.72);
  backdrop-filter: blur(12px);
}

.sent-star-dialog {
  display: flex;
  flex-direction: column;
  width: min(760px, 100%);
  max-height: min(860px, 100%);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--star-color) 60%, transparent);
  border-radius: 22px;
  background: linear-gradient(155deg, rgba(12, 27, 50, 0.98), rgba(4, 10, 24, 0.99));
  box-shadow:
    0 24px 90px rgba(0, 0, 0, 0.58),
    0 0 34px color-mix(in srgb, var(--star-color) 18%, transparent);
  color: #eef4ff;
}

.sent-star-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 28px 18px;
  border-bottom: 1px solid rgba(166, 202, 239, 0.14);
}

.sent-star-dialog-header h2 {
  margin: 4px 0 0;
  color: var(--star-color);
  font-size: 24px;
}

.sent-star-created-at {
  margin: 6px 0 0;
  color: #8098b3;
  font-size: 11px;
}

.sent-star-dialog-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, var(--star-color) 38%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--star-color) 9%, transparent);
  color: color-mix(in srgb, var(--star-color) 68%, white);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.22em;
  line-height: 1;
  text-shadow: 0 0 12px color-mix(in srgb, var(--star-color) 45%, transparent);
}

.sent-star-dialog-eyebrow::before,
.sent-star-dialog-eyebrow::after {
  color: var(--star-color);
  content: '✦';
  font-size: 9px;
  letter-spacing: 0;
}

.sent-star-dialog-eyebrow::after {
  opacity: 0.65;
  transform: scale(0.72);
}

.sent-star-dialog-scroll {
  overflow-y: auto;
  padding: 22px 28px;
}

.sent-star-content {
  margin: 0;
  color: #e2edf9;
  font-size: 16px;
  line-height: 1.85;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sent-star-votes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.sent-star-votes button {
  padding: 9px 16px;
  border: 1px solid rgba(174, 203, 239, 0.3);
  border-radius: 999px;
  background: rgba(86, 121, 168, 0.2);
  color: #e8f1fb;
  cursor: pointer;
}

.sent-star-votes button:disabled {
  cursor: default;
  opacity: 0.68;
}

.sent-star-votes button.selected {
  border-color: var(--star-color);
  background: color-mix(in srgb, var(--star-color) 22%, transparent);
  color: var(--star-color);
}

.sent-star-comment-count {
  margin-left: auto;
  color: #a9bfd9;
  font-size: 13px;
}

.sent-star-permission-hint,
.sent-star-empty-comments {
  margin: 12px 0 0;
  color: #9db4cb;
  font-size: 13px;
}

.sent-star-vote-error {
  margin: 10px 0 0;
  color: #ffb8c5;
  font-size: 13px;
}

.sent-star-comment-section {
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid rgba(166, 202, 239, 0.14);
}

.sent-star-comment-section h3 {
  margin: 0 0 16px;
  color: #d9e9fb;
  font-size: 17px;
}

.sent-star-comments {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sent-star-comment {
  margin-left: calc(min(var(--thread-depth), 5) * 22px);
  padding: 16px;
  border: 1px solid rgba(166, 202, 239, 0.12);
  border-radius: 14px;
  background: rgba(86, 121, 168, 0.1);
}

.sent-star-comment-author {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sent-star-comment-author strong {
  color: var(--star-color);
  font-size: 13px;
}

.sent-star-comment-author time {
  flex: none;
  color: #8098b3;
  font-size: 11px;
}

.sent-star-reply-context {
  margin: 8px 0 0;
  color: #8fa6c1;
  font-size: 12px;
}

.sent-star-comment-content {
  margin: 9px 0 0;
  color: #e3edf8;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sent-star-reply-toggle {
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  color: #9db4cb;
  cursor: pointer;
  font-size: 12px;
}

.sent-star-comment-form {
  display: grid;
  flex: none;
  gap: 9px;
}

.sent-star-main-comment-form {
  padding: 16px 28px 22px;
  border-top: 1px solid rgba(166, 202, 239, 0.14);
}

.sent-star-reply-form {
  margin-top: 12px;
}

.sent-star-comment-form textarea {
  box-sizing: border-box;
  width: 100%;
  max-height: 140px;
  resize: vertical;
  padding: 10px;
  border: 1px solid rgba(174, 203, 239, 0.3);
  border-radius: 10px;
  background: rgba(4, 12, 27, 0.72);
  color: #e8f1fb;
  font: inherit;
}

.sent-star-comment-form button {
  justify-self: end;
  padding: 8px 15px;
  border: 1px solid color-mix(in srgb, var(--star-color) 48%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--star-color) 15%, transparent);
  color: #edf5ff;
  cursor: pointer;
}

.sent-star-comment-form button:disabled {
  cursor: default;
  opacity: 0.5;
}

.sent-star-close {
  flex: none;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #b7c8dc;
  cursor: pointer;
  font-size: 27px;
}

.sent-star-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

@media (max-width: 600px) {
  .sent-star-dialog-overlay {
    padding: 10px;
  }

  .sent-star-dialog {
    max-height: 100%;
    border-radius: 17px;
  }

  .sent-star-dialog-header {
    padding: 19px 18px 15px;
  }

  .sent-star-dialog-scroll {
    padding: 18px;
  }

  .sent-star-main-comment-form {
    padding: 13px 18px 17px;
  }

  .sent-star-comment-author {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }

  .sent-star-comment {
    margin-left: calc(min(var(--thread-depth), 4) * 10px);
  }
}
</style>
