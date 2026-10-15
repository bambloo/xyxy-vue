<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type {
  GalaxyStarComment,
  GalaxyStarConnection,
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

const canvasHost = ref<HTMLElement | null>(null)
const sceneError = ref('')
const sentStars = ref<GalaxyStarView[]>([])
const selectedStar = ref<GalaxyStarView>()
const listLoading = ref(false)
const statusLoading = ref(false)
const voteLoading = ref(false)
const voteError = ref('')
const commentLoading = ref(false)
const commentError = ref('')
const commentText = ref('')
const replyingToCommentId = ref('')
const todayStarId = ref('')
const hasSentToday = computed(() => sentStars.value.some((star) => star.id === todayStarId.value))
let galaxyScene: GalaxyScene | undefined
let dailyResetTimer: number | undefined

function applyGalaxyData(data: { stars?: GalaxyStarView[]; connections?: GalaxyStarConnection[] }) {
  if (!Array.isArray(data.stars) || !Array.isArray(data.connections)) {
    throw new Error('星星数据格式无效')
  }
  sentStars.value = data.stars
  galaxyScene?.setSentStars(sentStars.value)
  galaxyScene?.setConnections(data.connections)
  if (selectedStar.value) {
    selectedStar.value = sentStars.value.find((star) => star.id === selectedStar.value?.id)
  }
}

async function loadGalaxyStars() {
  try {
    const [listPacket, statusPacket] = await Promise.all([
      post('/wpi/user/galaxy-star', listLoading, { action: 'list' }),
      post('/wpi/user/galaxy-star', statusLoading, { action: 'status' }),
    ])
    const listData = listPacket.data as
      { stars?: GalaxyStarView[]; connections?: GalaxyStarConnection[] } | undefined
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
    galaxyScene?.setStarSendAvailable(statusData.canSend)
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
  galaxyScene?.setStarSendAvailable(false)
}

function selectSentStar(star: SentGalaxyStar) {
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
    })
    applyGalaxyData(
      packet.data as {
        stars?: GalaxyStarView[]
        connections?: GalaxyStarConnection[]
      },
    )
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
  if (!hasSentToday.value || star.isOwn || !content || commentLoading.value) return
  commentError.value = ''
  commentLoading.value = true
  try {
    const packet = await post('/wpi/user/galaxy-star', commentLoading, {
      action: 'comment',
      starId: star.id,
      content,
      ...(parentCommentId ? { parentCommentId } : {}),
    })
    applyGalaxyData(
      packet.data as {
        stars?: GalaxyStarView[]
        connections?: GalaxyStarConnection[]
      },
    )
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
        flattened.push({ ...comment, depth, replyToTitle: parentTitle })
        appendReplies(comment.id, depth + 1, comment.sourceStarTitle)
      })
  }
  comments
    .filter((comment) => !comment.parentCommentId)
    .forEach((comment) => {
      flattened.push({ ...comment, depth: 0 })
      appendReplies(comment.id, 1, comment.sourceStarTitle)
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
  galaxyScene?.setStarSendAvailable((event as CustomEvent<boolean>).detail)
}

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
  if (canvasHost.value) {
    galaxyScene = new GalaxyScene(
      canvasHost.value,
      () => window.dispatchEvent(new Event(TIME_FORTUNE_OPEN_EVENT)),
      () => window.dispatchEvent(new Event(GALAXY_STAR_COMPOSE_EVENT)),
      selectSentStar,
    )
    window.addEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
    window.addEventListener(GALAXY_STAR_SEND_STATUS_EVENT, handleStarSendStatus)
    void loadGalaxyStars()
  }
})

onBeforeUnmount(() => {
  if (dailyResetTimer !== undefined) window.clearTimeout(dailyResetTimer)
  window.removeEventListener(GALAXY_STAR_SENT_EVENT, handleStarSent)
  window.removeEventListener(GALAXY_STAR_SEND_STATUS_EVENT, handleStarSendStatus)
  galaxyScene?.destroy()
  galaxyScene = undefined
})
</script>

<template>
  <main class="galaxy-demo" aria-label="旋转星空 Demo">
    <section
      ref="canvasHost"
      class="galaxy-canvas"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @wheel.prevent="handleWheel"
    ></section>
    <GalaxyStarComposer />
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
            今天寄出星星后即可点赞、点踩或评论
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
                  <strong>{{ comment.sourceStarTitle }}</strong>
                  <time>{{ comment.createdAt }}</time>
                </div>
                <p v-if="comment.replyToTitle" class="sent-star-reply-context">
                  回复 {{ comment.replyToTitle }}
                </p>
                <p class="sent-star-comment-content">{{ comment.content }}</p>
                <button
                  v-if="hasSentToday && !selectedStar.isOwn"
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
          v-if="hasSentToday && !selectedStar.isOwn && !replyingToCommentId"
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
  font-size: 11px;
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
