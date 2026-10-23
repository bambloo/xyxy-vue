<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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
import { GALAXY_STAR_SENT_EVENT } from '@/events/galaxy-star'
import { GALAXY_CAMERA_CENTER_EVENT, GALAXY_CAMERA_ZOOM_OUT_EVENT } from '@/events/galaxy-camera'
import { TIME_FORTUNE_OPEN_EVENT } from '@/events/time-fortune'
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
const blackHoleListLoaded = ref(false)
const statusLoading = ref(false)
const voteLoading = ref(false)
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
const blackHolePointerStart = ref<{ x: number; y: number }>()
const blackHoleSwipeHandled = ref(false)
const hasSentToday = computed(() => Boolean(todayStarId.value))
const canViewStarDetails = computed(() => auth.isLoggedIn && auth.isSessionValidated)
const blackHoleWaveSize = 20
const blackHoleWave = computed(() => blackHoleEntries.value)
const blackHoleWaveKey = computed(() => blackHoleWave.value.map((entry) => entry.id).join(':'))
let galaxyScene: GalaxyScene | undefined
let dailyResetTimer: number | undefined

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

function blackHoleEntryStyle(entry: GalaxyBlackHoleEntry, index: number) {
  let seed = 2166136261
  for (const character of `${entry.id}:${index}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  }
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }

  const drift = () => `${Math.round(random() * 72 - 36)}px`
  return {
    '--entry-x': `${Math.round(random() * 48 + 22)}%`,
    '--entry-y': `${Math.round(random() * 48 + 22)}%`,
    '--drift-x': drift(),
    '--drift-y': drift(),
    '--drift-duration': `${Math.round(random() * 12 + 13)}s`,
    '--drift-delay': `${Math.round(random() * -20)}s`,
    '--entry-angle': `${Math.round(random() * 12 - 6)}deg`,
    '--entry-opacity': `${(random() * 0.22 + 0.68).toFixed(2)}`,
    '--entry-size': `${Math.round(random() * 5 + 13)}px`,
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
      ? (target.closest('.black-hole-content-text') as HTMLElement | null) ??
        (event.currentTarget as HTMLElement)
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
  sentStars.value = data.stars
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
      { hasSentToday?: boolean; todayStarId?: string; resetsAt?: string } | undefined
    if (!listData) {
      throw new Error('星星数据格式无效')
    }
    applyGalaxyData(listData)
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
  galaxyScene?.setDownvotedStarIds(hiddenStarIds.value)
  void refreshGalaxyAfterStarSent()
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
  if (blackHoleSwipeHandled.value || !canViewStarDetails.value) return
  selectedStar.value = sentStars.value.find((candidate) => candidate.id === star.id)
  selectedCommentId.value = ''
  voteError.value = ''
}

async function openBlackHoleEntry(entry: GalaxyBlackHoleEntry) {
  if (blackHoleSwipeHandled.value || !canViewStarDetails.value || blackHoleContentLoading.value)
    return
  try {
    const packet = await post('/wpi/user/galaxy-star/blackhole-content', blackHoleContentLoading, {
      entryId: entry.id,
    })
    const data = packet.data as
      | { star?: GalaxyStarView; selectedCommentId?: string }
      | undefined
    if (!data?.star) throw new Error('黑洞内容详情格式无效')
    selectedStar.value = data.star
    selectedCommentId.value = data.selectedCommentId ?? ''
    voteError.value = ''
    await nextTick()
    if (selectedCommentId.value) {
      document
        .getElementById(`sent-star-comment-${selectedCommentId.value}`)
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
  if (!hasSentToday.value || star.isOwn || star.myVote || voteLoading.value) return
  voteError.value = ''
  voteLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star/vote', voteLoading, {
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

async function voteForComment(star: GalaxyStarView, comment: GalaxyStarComment, vote: GalaxyStarVote) {
  if (!hasSentToday.value || comment.isOwn || comment.myVote || voteLoading.value) return
  voteError.value = ''
  voteLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star/comment-vote', voteLoading, {
      starId: star.id,
      commentId: comment.id,
      vote,
    })
    const data = packet.data as { star?: GalaxyStarView } | undefined
    if (!data?.star) throw new Error('评论评价数据格式无效')
    selectedStar.value = data.star
    sentStars.value = sentStars.value.map((candidate) =>
      candidate.id === data.star?.id ? data.star : candidate,
    )
    void loadGalaxyStars()
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

watch(
  () => props.blackHoleView,
  (enabled, previousEnabled) => {
    if (enabled === previousEnabled) return
    galaxyScene?.setBlackHoleView(enabled)
    void loadGalaxyStars()
  },
)

watch(canViewStarDetails, (canView, previousCanView) => {
  if (canView === previousCanView) return
  selectedStar.value = undefined
  todayStarId.value = ''
  if (!canView) {
    sentStars.value = sentStars.value.map((star) => ({
      ...star,
      title: '',
      content: '',
      comments: [],
      isOwn: false,
      myVote: undefined,
    }))
    galaxyScene?.setSentStars(sentStars.value)
  }
  void loadGalaxyStars()
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
  galaxyScene?.resetView()
}

onMounted(() => {
  if (canvasHost.value) {
    galaxyScene = new GalaxyScene(
      canvasHost.value,
      () => window.dispatchEvent(new Event(TIME_FORTUNE_OPEN_EVENT)),
      selectSentStar,
      () => void router.push({ name: 'blackhole' }),
      props.blackHoleView,
    )
    window.addEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
    window.addEventListener(GALAXY_CAMERA_ZOOM_OUT_EVENT, handleCameraZoomOut)
    window.addEventListener(GALAXY_CAMERA_CENTER_EVENT, handleCameraCenter)
    void loadGalaxyStars()
  }
})

onBeforeUnmount(() => {
  if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
  window.removeEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
  window.removeEventListener(GALAXY_CAMERA_ZOOM_OUT_EVENT, handleCameraZoomOut)
  window.removeEventListener(GALAXY_CAMERA_CENTER_EVENT, handleCameraCenter)
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
        <p>踩数 > 赞数 × 1.5 且踩数 > 8 · 共 {{ blackHoleTotalCount }} 条内容</p>
      </div>
    </header>
    <section
      v-if="props.blackHoleView"
      class="black-hole-list"
      aria-label="被踩内容"
      @pointerdown="handleBlackHolePointerDown"
      @pointerup="handleBlackHolePointerUp"
      @pointercancel="handleBlackHolePointerUp"
    >
      <p v-if="listLoading && !blackHoleListLoaded" class="black-hole-empty">
        正在搜寻被引力捕获的内容…
      </p>
      <p v-else-if="blackHoleWave.length === 0" class="black-hole-empty">暂无符合条件的内容</p>
      <template v-else>
        <Transition name="black-hole-wave">
          <div :key="blackHoleWaveKey" class="black-hole-content-list">
            <div
              v-for="(entry, index) in blackHoleWave"
              :key="entry.id"
              class="black-hole-content-entry"
              :style="blackHoleEntryStyle(entry, index)"
            >
              <button
                class="black-hole-content-text"
                type="button"
                :aria-label="`打开被踩${entry.kind === 'comment' ? '评论' : '星体内容'}，被踩 ${entry.dislikeCount} 次`"
                @click="openBlackHoleEntry(entry)"
              >
                {{ entry.content }}
              </button>
            </div>
          </div>
        </Transition>
        <p class="black-hole-wave-hint">
          {{ blackHoleWave.length }} / {{ blackHoleTotalCount }} 条 · 滑动屏幕刷新下一批
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
                :class="{ 'selected-comment': comment.id === selectedCommentId }"
                :style="{ '--thread-depth': Math.min(comment.depth, 5) }"
                :id="`sent-star-comment-${comment.id}`"
              >
                <div class="sent-star-comment-author">
                  <strong>{{ comment.sourceStarTitle || '匿名用户' }}</strong>
                  <time>{{ comment.createdAt }}</time>
                </div>
                <p v-if="comment.replyToTitle" class="sent-star-reply-context">
                  回复 {{ comment.replyToTitle }}
                </p>
                <p class="sent-star-comment-content">{{ comment.content }}</p>
                <div class="sent-star-comment-actions">
                  <div class="sent-star-comment-votes">
                    <button
                      type="button"
                      :class="{ selected: comment.myVote === 'like' }"
                      :disabled="
                        comment.isOwn ||
                        !hasSentToday ||
                        voteLoading ||
                        Boolean(comment.myVote)
                      "
                      @click="voteForComment(selectedStar, comment, 'like')"
                    >
                      赞 {{ comment.likeCount ?? 0 }}
                    </button>
                    <button
                      type="button"
                      :class="{ selected: comment.myVote === 'dislike' }"
                      :disabled="
                        comment.isOwn ||
                        !hasSentToday ||
                        voteLoading ||
                        Boolean(comment.myVote)
                      "
                      @click="voteForComment(selectedStar, comment, 'dislike')"
                    >
                      踩 {{ comment.dislikeCount ?? 0 }}
                    </button>
                  </div>
                  <button
                    class="sent-star-reply-toggle"
                    type="button"
                    @click="toggleCommentReply(comment)"
                  >
                    {{ replyingToCommentId === comment.id ? '取消回复' : '回复' }}
                  </button>
                </div>
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

.black-hole-content-list {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(90vw, 90vh);
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
  width: min(68%, 300px);
  padding: 4px;
  transform: rotate(var(--entry-angle));
  animation: black-hole-drift var(--drift-duration) ease-in-out var(--drift-delay) infinite alternate;
  border: 0;
  background: transparent;
  color: rgba(229, 234, 250, var(--entry-opacity));
  cursor: pointer;
  filter: drop-shadow(0 0 10px rgba(165, 190, 255, 0.36));
  pointer-events: auto;
  text-align: left;
  text-shadow: 0 0 12px rgba(147, 173, 255, 0.68), 0 1px 8px #02040b;
  transition: color 180ms ease, filter 180ms ease;
}

.black-hole-content-entry:hover {
  color: #ffffff;
  filter: drop-shadow(0 0 14px rgba(195, 209, 255, 0.8));
}

@keyframes black-hole-drift {
  0% {
    transform: translate3d(0, 0, 0) rotate(var(--entry-angle));
  }

  27% {
    transform: translate3d(var(--drift-x), calc(var(--drift-y) * -0.45), 0)
      rotate(calc(var(--entry-angle) * -0.6));
  }

  61% {
    transform: translate3d(calc(var(--drift-x) * -0.5), var(--drift-y), 0)
      rotate(calc(var(--entry-angle) * 0.4));
  }

  100% {
    transform: translate3d(var(--drift-x), var(--drift-y), 0)
      rotate(calc(var(--entry-angle) * -0.35));
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
  font-size: var(--entry-size);
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

@media (prefers-reduced-motion: reduce) {
  .black-hole-content-entry {
    animation: none;
  }
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

.sent-star-comment.selected-comment {
  border-color: color-mix(in srgb, var(--star-color) 72%, transparent);
  background: color-mix(in srgb, var(--star-color) 14%, rgba(86, 121, 168, 0.1));
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

.sent-star-comment-actions,
.sent-star-comment-votes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.sent-star-comment-actions {
  justify-content: space-between;
  margin-top: 10px;
}

.sent-star-comment-votes button {
  padding: 4px 9px;
  border: 1px solid rgba(174, 203, 239, 0.2);
  border-radius: 999px;
  background: rgba(86, 121, 168, 0.12);
  color: #b8c9de;
  cursor: pointer;
  font-size: 12px;
}

.sent-star-comment-votes button:disabled {
  cursor: default;
  opacity: 0.6;
}

.sent-star-comment-votes button.selected {
  border-color: var(--star-color);
  color: var(--star-color);
}

.sent-star-reply-toggle {
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
