<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import type {
  GalaxyStarComment,
  GalaxyStarView,
  GalaxyStarVote,
} from '../../../../common/entity/galaxy-star'
import {
  announceDialogStackState,
  DIALOG_STACK_CLOSE_DIALOG_EVENT,
  requestTopDialogClose,
} from '@/events/dialog-stack'

type ThreadedGalaxyStarComment = GalaxyStarComment & {
  depth: number
  replyToTitle?: string
}

const props = defineProps<{
  open: boolean
  star?: GalaxyStarView
  blackHoleView: boolean
  selectedBlackHoleEntryKind?: 'star' | 'comment'
  selectedCommentId: string
  hasSentToday: boolean
  voteLoading: boolean
  voteError: string
  commentLoading: boolean
  commentError: string
  commentText: string
  replyingToCommentId: string
}>()

const emit = defineEmits<{
  close: []
  'update:commentText': [value: string]
  'toggle-reply': [comment: GalaxyStarComment]
  'vote-star': [vote: GalaxyStarVote]
  'vote-comment': [payload: { comment: GalaxyStarComment; vote: GalaxyStarVote }]
  comment: [parentCommentId?: string]
}>()

function meetsBlackHoleThreshold(likeCount = 0, dislikeCount = 0) {
  return dislikeCount > 8 && dislikeCount > likeCount * 1.5
}

function commentThreads(comments: GalaxyStarComment[]) {
  const flattened: ThreadedGalaxyStarComment[] = []
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

const visibleComments = computed(() => {
  if (!props.star) return []
  const comments = commentThreads(props.star.comments)
  return props.blackHoleView
    ? comments.filter(
      (comment) =>
        !meetsBlackHoleThreshold(comment.likeCount, comment.dislikeCount) ||
        comment.id === props.selectedCommentId,
    )
    : comments
})

function handleDialogStackClose(event: Event) {
  if ((event as CustomEvent<string>).detail === 'star-details') emit('close')
}

watch(
  () => props.open,
  (open) => announceDialogStackState('star-details', open),
  { immediate: true },
)

onMounted(() => {
  window.addEventListener(DIALOG_STACK_CLOSE_DIALOG_EVENT, handleDialogStackClose)
})

onBeforeUnmount(() => {
  window.removeEventListener(DIALOG_STACK_CLOSE_DIALOG_EVENT, handleDialogStackClose)
  announceDialogStackState('star-details', false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fortune-dialog">
      <div v-if="props.open && props.star" class="sent-star-dialog-overlay"
        :style="{ '--star-color': props.star.color }" @click.self="requestTopDialogClose">
        <section class="sent-star-dialog" role="dialog" aria-modal="true"
          aria-labelledby="sent-star-dialog-title">
          <header class="sent-star-dialog-header">
            <div>
              <span class="sent-star-dialog-eyebrow">星际回响</span>
              <h2 id="sent-star-dialog-title">{{ props.star.title }}</h2>
              <p class="sent-star-created-at">
                发送时间：<time>{{ props.star.createdAt }}</time>
              </p>
            </div>
          </header>
          <div class="sent-star-dialog-scroll">
        <p v-if="!props.blackHoleView || props.selectedBlackHoleEntryKind === 'star'" id="sent-star-black-hole-content"
          class="sent-star-content"
          :class="{ 'selected-black-hole-content': props.selectedBlackHoleEntryKind === 'star' }">
          <template v-if="
            !props.blackHoleView &&
            meetsBlackHoleThreshold(props.star.likeCount, props.star.dislikeCount)
          ">
            该内容因被踩过多已隐藏，可在黑洞星域查看。
          </template>
          <template v-else>{{ props.star.content }}</template>
        </p>
        <div v-if="
          props.blackHoleView
            ? props.selectedBlackHoleEntryKind === 'star'
            : !meetsBlackHoleThreshold(props.star.likeCount, props.star.dislikeCount)
        " class="sent-star-votes">
          <button type="button" class="vote-like" :class="{ selected: props.star.myVote === 'like' }"
            :aria-pressed="props.star.myVote === 'like'" :disabled="props.voteLoading"
            @click="emit('vote-star', 'like')">
            赞 <strong>{{ props.star.likeCount }}</strong>
          </button>
          <button type="button" class="vote-dislike" :class="{ selected: props.star.myVote === 'dislike' }"
            :aria-pressed="props.star.myVote === 'dislike'" :disabled="props.voteLoading"
            @click="emit('vote-star', 'dislike')">
            踩 <strong>{{ props.star.dislikeCount }}</strong>
          </button>
          <span v-if="!props.blackHoleView" class="sent-star-comment-count">
            {{ props.star.comments.length }} 条评论
          </span>
        </div>
        <p v-if="props.star.isOwn" class="sent-star-permission-hint">这是你寄出的星星</p>
        <p v-else-if="!props.hasSentToday" class="sent-star-permission-hint">
          寄出星星前的评论将匿名显示；寄出后会自动关联到你的星星
        </p>
        <p v-if="props.voteError" class="sent-star-vote-error" role="alert">{{ props.voteError }}</p>

        <section class="sent-star-comment-section" aria-labelledby="sent-star-comments-title">
          <h3 id="sent-star-comments-title">星际讨论</h3>
          <p v-if="!visibleComments.length" class="sent-star-empty-comments">
            {{ props.blackHoleView ? '没有其他正常评论。' : '还没有评论，来留下第一条回响吧。' }}
          </p>
          <ul v-else class="sent-star-comments">
            <li v-for="comment in visibleComments" :key="comment.id" class="sent-star-comment"
              :class="{ 'selected-comment': comment.id === props.selectedCommentId }"
              :style="{
                '--thread-depth': Math.min(comment.depth, 5),
                '--comment-star-color': comment.sourceStarColor || '#9db4cb',
              }" :id="`sent-star-comment-${comment.id}`">
              <div class="sent-star-comment-author">
                <strong>{{ comment.sourceStarTitle || '匿名用户' }}</strong>
                <time>{{ comment.createdAt }}</time>
              </div>
              <p v-if="comment.replyToTitle" class="sent-star-reply-context">
                回复 {{ comment.replyToTitle }}
              </p>
              <p class="sent-star-comment-content">
                <template v-if="
                  !props.blackHoleView &&
                  meetsBlackHoleThreshold(comment.likeCount, comment.dislikeCount)
                ">
                  该评论因被踩过多已隐藏，可在黑洞星域查看。
                </template>
                <template v-else>{{ comment.content }}</template>
              </p>
              <div class="sent-star-comment-actions">
                <div class="sent-star-comment-votes">
                  <button type="button" class="vote-like" :class="{ selected: comment.myVote === 'like' }"
                    :aria-pressed="comment.myVote === 'like'" :disabled="props.voteLoading"
                    @click="emit('vote-comment', { comment, vote: 'like' })">
                    赞 {{ comment.likeCount ?? 0 }}
                  </button>
                  <button type="button" class="vote-dislike" :class="{ selected: comment.myVote === 'dislike' }"
                    :aria-pressed="comment.myVote === 'dislike'" :disabled="props.voteLoading"
                    @click="emit('vote-comment', { comment, vote: 'dislike' })">
                    踩 {{ comment.dislikeCount ?? 0 }}
                  </button>
                </div>
                <button class="sent-star-reply-toggle" type="button" @click="emit('toggle-reply', comment)">
                  {{ props.replyingToCommentId === comment.id ? '取消回复' : '回复' }}
                </button>
              </div>
              <form v-if="props.replyingToCommentId === comment.id"
                class="sent-star-comment-form sent-star-reply-form" @submit.prevent="emit('comment', comment.id)">
                <textarea :value="props.commentText" maxlength="500" rows="2"
                  :aria-label="`回复${comment.sourceStarTitle}`" placeholder="写下回复…"
                  :disabled="props.commentLoading"
                  @input="emit('update:commentText', ($event.target as HTMLTextAreaElement).value)"></textarea>
                <button type="submit" :disabled="props.commentLoading || !props.commentText.trim()">
                  {{ props.commentLoading ? '发送中…' : '发送回复' }}
                </button>
              </form>
              <p v-if="props.replyingToCommentId === comment.id && props.commentError"
                class="sent-star-vote-error" role="alert">
                {{ props.commentError }}
              </p>
            </li>
          </ul>
          <p v-if="props.commentError && !props.replyingToCommentId" class="sent-star-vote-error" role="alert">
            {{ props.commentError }}
          </p>
        </section>
          </div>
          <form v-if="!props.replyingToCommentId" class="sent-star-comment-form sent-star-main-comment-form"
            @submit.prevent="emit('comment')">
            <textarea :value="props.commentText" maxlength="500" rows="2" aria-label="评论内容"
              placeholder="参与讨论…" :disabled="props.commentLoading"
              @input="emit('update:commentText', ($event.target as HTMLTextAreaElement).value)"></textarea>
            <button type="submit" :disabled="props.commentLoading || !props.commentText.trim()">
              {{ props.commentLoading ? '发送中…' : '发送评论' }}
            </button>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sent-star-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px 24px
    calc(var(--portal-control-bottom, clamp(112px, 13vh, 168px)) + 77.6px);
  background: rgba(1, 7, 19, 0.36);
  backdrop-filter: blur(3px);
}

.sent-star-dialog-overlay.fortune-dialog-leave-active {
  pointer-events: none;
}

.sent-star-dialog {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 24px;
  background: transparent;
  box-shadow: none;
  color: #eef4ff;
}

.fortune-dialog-enter-active,
.fortune-dialog-leave-active {
  transition: opacity 220ms ease;
}

.fortune-dialog-enter-active .sent-star-dialog,
.fortune-dialog-leave-active .sent-star-dialog {
  transition: transform 220ms ease;
}

.fortune-dialog-enter-from,
.fortune-dialog-leave-to {
  opacity: 0;
}

.fortune-dialog-enter-from .sent-star-dialog,
.fortune-dialog-leave-to .sent-star-dialog {
  transform: translateY(12px);
}

.sent-star-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) 18px
    max(24px, env(safe-area-inset-left));
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
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 22px max(24px, env(safe-area-inset-right)) 22px max(24px, env(safe-area-inset-left));
}

.sent-star-dialog-scroll::-webkit-scrollbar {
  display: none;
}

.sent-star-content {
  margin: 0;
  color: #e2edf9;
  font-size: 16px;
  line-height: 1.85;
}

.sent-star-content.selected-black-hole-content {
  border-radius: 8px;
  background: color-mix(in srgb, var(--star-color) 16%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--star-color) 65%, transparent),
    0 0 24px color-mix(in srgb, var(--star-color) 42%, transparent);
  animation: black-hole-target-highlight 1.2s ease-out 2;
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
}

.sent-star-votes button.vote-like.selected,
.sent-star-comment-votes button.vote-like.selected {
  border-color: #75d99a;
  background: rgba(73, 180, 111, 0.18);
  color: #8ff0b3;
}

.sent-star-votes button.vote-dislike.selected,
.sent-star-comment-votes button.vote-dislike.selected {
  border-color: #ff7889;
  background: rgba(204, 72, 91, 0.18);
  color: #ff9aa8;
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
  animation: black-hole-target-highlight 1.2s ease-out 2;
}

@keyframes black-hole-target-highlight {
  50% {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--star-color) 82%, transparent),
      0 0 30px color-mix(in srgb, var(--star-color) 56%, transparent);
  }
}

.sent-star-comment-author {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sent-star-comment-author strong {
  color: var(--comment-star-color);
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
  padding: 16px max(24px, env(safe-area-inset-right)) max(22px, env(safe-area-inset-bottom))
    max(24px, env(safe-area-inset-left));
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

@media (max-width: 600px) {
  .sent-star-dialog-overlay {
    padding: 24px 16px
      calc(var(--portal-control-bottom, clamp(112px, 13vh, 168px)) + 77.6px);
  }

  .sent-star-dialog-header {
    padding: max(19px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) 15px
      max(18px, env(safe-area-inset-left));
  }

  .sent-star-dialog-scroll {
    padding: 18px max(18px, env(safe-area-inset-right)) 18px max(18px, env(safe-area-inset-left));
  }

  .sent-star-main-comment-form {
    padding: 13px max(18px, env(safe-area-inset-right)) max(17px, env(safe-area-inset-bottom))
      max(18px, env(safe-area-inset-left));
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
