<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'
import {
  SITE_DECLARATIONS,
  type SiteDeclaration,
  type SiteDeclarationId,
  type SiteSuggestion,
} from '../../../../common/entity/site-info'
import { post } from '@/scripts/request'
import { useAuthStore } from '@/stores/auth'
import { requestTopDialogClose } from '@/events/dialog-stack'

const props = withDefaults(defineProps<{ dialog?: boolean }>(), { dialog: false })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const auth = useAuthStore()
const loading = ref(false)
const declarationSaving = ref(false)
const suggestionLoading = ref(false)
const suggestionReadSavingId = ref('')
const savingDeclarationId = ref('')
const errorMessage = ref('')
const statusMessage = ref('')
const suggestion = ref('')
const selectedPage = ref<SiteDeclarationId | 'suggestions' | ''>('')
const suggestionFilter = ref<'all' | 'unread' | 'read'>('all')
const declarations = ref<SiteDeclaration[]>(
  SITE_DECLARATIONS.map((item) => ({ id: item.id, content: '' })),
)
const dataLoaded = ref(false)
const suggestions = ref<SiteSuggestion[]>([])
const filteredSuggestions = computed(() => {
  const filtered = suggestions.value.filter((entry) => {
    if (suggestionFilter.value === 'unread') return !entry.isRead
    if (suggestionFilter.value === 'read') return entry.isRead
    return true
  })
  return filtered.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
  )
})
const currentDeclaration = () =>
  declarations.value.find((item) => item.id === selectedPage.value)
const selectedDeclarationInfo = () =>
  SITE_DECLARATIONS.find((item) => item.id === selectedPage.value)
const canManage = () =>
  Boolean(
    auth.currentUser?.isAdmin || auth.currentUser?.permissions?.includes('site.manage'),
  )

function setDeclarationContent(id: SiteDeclaration['id'], content: string) {
  const declaration = declarations.value.find((item) => item.id === id)
  if (!declaration) throw new Error(t('siteInfo.loadFailed'))
  declaration.content = content
}

function goBackToList() {
  selectedPage.value = ''
  errorMessage.value = ''
  statusMessage.value = ''
}

async function loadSiteInfo() {
  errorMessage.value = ''
  try {
    const packet = await post('/wpi/site-info', loading)
    const data = packet.data as
      | { declarations?: SiteDeclaration[]; suggestions?: SiteSuggestion[] }
      | undefined
    if (!Array.isArray(data?.declarations)) throw new Error(t('siteInfo.loadFailed'))
    declarations.value = data.declarations
    suggestions.value = Array.isArray(data.suggestions) ? data.suggestions : []
    dataLoaded.value = true
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('siteInfo.loadFailed')
  }
}

async function submitSuggestion() {
  const content = suggestion.value.trim()
  if (!content) {
    errorMessage.value = t('siteInfo.suggestionRequired')
    return
  }

  errorMessage.value = ''
  statusMessage.value = ''
  try {
    await post('/wpi/site-info/suggestion', suggestionLoading, { content })
    suggestion.value = ''
    statusMessage.value = t('siteInfo.suggestionSubmitted')
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('siteInfo.suggestionFailed')
  }
}

async function markSuggestionRead(entry: SiteSuggestion) {
  if (entry.isRead || suggestionReadSavingId.value) return
  suggestionReadSavingId.value = entry.id
  errorMessage.value = ''
  try {
    await post('/wpi/site-info/suggestion/read', suggestionLoading, { id: entry.id })
    entry.isRead = true
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('siteInfo.suggestionReadFailed')
  } finally {
    suggestionReadSavingId.value = ''
  }
}

async function saveDeclaration(declaration: SiteDeclaration) {
  if (savingDeclarationId.value) return
  errorMessage.value = ''
  statusMessage.value = ''
  savingDeclarationId.value = declaration.id
  try {
    const packet = await post('/wpi/site-info/declaration', declarationSaving, {
      id: declaration.id,
      content: declaration.content,
    })
    const saved = packet.data as SiteDeclaration | undefined
    if (!saved || saved.id !== declaration.id) throw new Error(t('siteInfo.saveFailed'))
    declaration.content = saved.content
    declaration.updatedAt = saved.updatedAt
    statusMessage.value = t('siteInfo.declarationSaved')
  } catch (error) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('siteInfo.saveFailed')
  } finally {
    savingDeclarationId.value = ''
  }
}

onMounted(() => {
  void loadSiteInfo()
})
</script>

<template>
  <Teleport to="body" :disabled="!props.dialog">
    <div
      :class="{ 'site-info-overlay': props.dialog }"
      @click.self="props.dialog && requestTopDialogClose()"
    >
      <section :class="['site-info-page', { 'site-info-dialog': props.dialog }]" role="region">
    <header class="page-heading">
      <button v-if="selectedPage" class="back-button" type="button" @click="goBackToList">
        {{ t('siteInfo.backToList') }}
      </button>
      <p class="eyebrow">{{ t('siteInfo.eyebrow') }}</p>
      <h2>
        {{
          selectedPage === 'suggestions'
            ? t('siteInfo.feedbackTitle')
            : selectedDeclarationInfo()
              ? t(`siteInfo.declarationTitles.${selectedDeclarationInfo()!.titleKey}`)
              : t('siteInfo.title')
        }}
      </h2>
      <p v-if="!selectedPage">{{ t('siteInfo.intro') }}</p>
    </header>

    <p v-if="errorMessage" class="message error" role="alert">{{ errorMessage }}</p>
    <p v-if="statusMessage" class="message success" role="status">{{ statusMessage }}</p>
    <p v-if="loading && !dataLoaded" class="message">{{ t('common.loading') }}</p>

    <nav v-if="!selectedPage" class="page-list" :aria-label="t('siteInfo.title')">
      <button class="page-list-item" type="button" @click="toggleLocale">
        <span>{{ t('siteInfo.language') }}</span>
        <span class="page-list-value">{{ t('siteInfo.currentLanguage') }}</span>
        <span class="page-list-arrow" aria-hidden="true">›</span>
      </button>
      <button class="page-list-item" type="button" @click="selectedPage = 'suggestions'">
        <span>{{ t('siteInfo.feedbackTitle') }}</span>
        <span class="page-list-arrow" aria-hidden="true">›</span>
      </button>
      <button
        v-for="item in SITE_DECLARATIONS"
        :key="item.id"
        class="page-list-item"
        type="button"
        @click="selectedPage = item.id"
      >
        <span>{{ t(`siteInfo.declarationTitles.${item.titleKey}`) }}</span>
        <span class="page-list-arrow" aria-hidden="true">›</span>
      </button>
    </nav>

    <section v-else-if="selectedPage === 'suggestions'" class="detail-panel">
      <p v-if="!canManage()">{{ t('siteInfo.feedbackIntro') }}</p>
      <form v-if="!canManage()" @submit.prevent="submitSuggestion">
        <textarea
          v-model="suggestion"
          :maxlength="5000"
          :disabled="suggestionLoading"
          :placeholder="t('siteInfo.suggestionPlaceholder')"
          rows="5"
        />
        <button class="primary-button" type="submit" :disabled="suggestionLoading">
          {{ suggestionLoading ? t('common.loading') : t('siteInfo.submitSuggestion') }}
        </button>
      </form>

      <div v-else class="suggestion-list">
        <div class="suggestion-filters" :aria-label="t('siteInfo.suggestionFilters')">
          <button
            v-for="filter in ['all', 'unread', 'read'] as const"
            :key="filter"
            type="button"
            :class="{ active: suggestionFilter === filter }"
            :aria-pressed="suggestionFilter === filter"
            @click="suggestionFilter = filter"
          >
            {{ t(`siteInfo.suggestionFilter.${filter}`) }}
          </button>
        </div>
        <p v-if="!suggestions.length" class="empty-state">{{ t('siteInfo.noSuggestions') }}</p>
        <p v-else-if="!filteredSuggestions.length" class="empty-state">
          {{ t('siteInfo.noFilteredSuggestions') }}
        </p>
        <article v-for="entry in filteredSuggestions" :key="entry.id" class="suggestion-card">
          <header>
            <div class="suggestion-meta">
              <strong>{{ entry.userTag }}</strong>
              <time>{{ entry.createdAt }}</time>
              <span :class="['suggestion-read-status', { read: entry.isRead }]">
                {{ entry.isRead ? t('siteInfo.suggestionRead') : t('siteInfo.suggestionUnread') }}
              </span>
            </div>
            <button
              v-if="!entry.isRead"
              class="secondary-button"
              type="button"
              :disabled="Boolean(suggestionReadSavingId)"
              @click="markSuggestionRead(entry)"
            >
              {{
                suggestionReadSavingId === entry.id
                  ? t('common.loading')
                  : t('siteInfo.markSuggestionRead')
              }}
            </button>
          </header>
          <p>{{ entry.content }}</p>
        </article>
      </div>
    </section>

    <section v-else-if="currentDeclaration()" class="detail-panel">
      <textarea
        v-if="canManage()"
        :value="currentDeclaration()!.content"
        :maxlength="20000"
        :disabled="loading"
        :readonly="savingDeclarationId === currentDeclaration()!.id"
        :aria-label="t(`siteInfo.declarationTitles.${selectedDeclarationInfo()!.titleKey}`)"
        :placeholder="t('siteInfo.declarationPlaceholder')"
        rows="12"
        @input="
          setDeclarationContent(
            currentDeclaration()!.id,
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
      <p v-else class="declaration-content">
        {{ currentDeclaration()!.content || t('siteInfo.notPublished') }}
      </p>
      <button
        v-if="canManage()"
        class="primary-button"
        type="button"
        :disabled="Boolean(savingDeclarationId)"
        @click="saveDeclaration(currentDeclaration()!)"
      >
        {{
          savingDeclarationId === currentDeclaration()!.id
            ? t('common.loading')
            : t('siteInfo.saveDeclaration')
        }}
      </button>
    </section>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.site-info-page {
  max-width: 900px;
}

.site-info-overlay {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px 24px var(--dialog-bottom-reserve, calc(clamp(112px, 13vh, 168px) + 104px));
  background: rgba(1, 7, 19, 0.36);
  backdrop-filter: blur(3px);
}

.site-info-dialog {
  box-sizing: border-box;
  position: relative;
  width: min(520px, 100%);
  height: min(
    720px,
    var(--dialog-available-height, calc(100vh - 24px - clamp(112px, 13vh, 168px) - 104px))
  );
  overflow: auto;
  scrollbar-width: none;
  padding: 34px clamp(24px, 6vw, 48px) 24px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  box-shadow: none;
  color: #e8f1fb;
}

.site-info-dialog::-webkit-scrollbar {
  display: none;
}

.site-info-dialog .page-heading {
  text-align: center;
}

.page-heading {
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 .4rem;
  color: #96bce7;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}

h2 {
  margin: 8px 0 26px;
  color: #f4e6bf;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: 0.18em;
}

.page-heading > p:last-child,
.suggestion-section > p {
  color: var(--space-muted);
  line-height: 1.6;
}

.suggestion-list {
  display: grid;
  gap: .8rem;
}

.suggestion-filters {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.suggestion-filters button {
  border: 1px solid var(--space-line);
  border-radius: 999px;
  padding: .45rem .8rem;
  background: transparent;
  color: var(--space-muted);
  font: inherit;
  cursor: pointer;
}

.suggestion-filters button.active {
  border-color: var(--space-gold);
  background: rgba(233, 180, 94, .16);
  color: var(--space-gold);
}

.page-list,
.detail-panel,
.suggestion-card {
  padding: 1rem;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  background: var(--space-panel);
}

.site-info-dialog .page-list,
.site-info-dialog .detail-panel,
.site-info-dialog .suggestion-card {
  border: 0;
  background: transparent;
}

.site-info-dialog .message,
.site-info-dialog .empty-state {
  padding: 0;
  border-radius: 0;
  background: transparent;
}

.page-list {
  padding: 0;
  overflow: hidden;
}

.site-info-dialog .page-list {
  display: grid;
  gap: 8px;
  overflow: visible;
}

.page-list-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 1.2rem;
  align-items: center;
  gap: .7rem;
  width: 100%;
  padding: .9rem 1rem;
  border: 0;
  border-bottom: 1px solid var(--space-line);
  background: transparent;
  color: var(--space-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.site-info-dialog .page-list-item {
  border-bottom: 0;
}

.page-list-item:last-child {
  border-bottom: 0;
}

.page-list-value {
  color: var(--space-muted);
  font-size: .9rem;
}

.page-list-arrow {
  color: var(--space-gold);
  font-size: 1.5rem;
  text-align: right;
}

.suggestion-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.suggestion-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .6rem 1rem;
}

.suggestion-read-status {
  color: #ffd27d;
  font-size: .8rem;
}

.suggestion-read-status.read {
  color: var(--space-muted);
}

.back-button {
  margin-bottom: .8rem;
  border: 0;
  padding: 0;
  background: none;
  color: var(--space-gold);
  font: inherit;
  cursor: pointer;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: .8rem;
  border: 1px solid var(--space-line);
  border-radius: 9px;
  padding: .8rem;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
  line-height: 1.6;
  resize: vertical;
}

.declaration-content,
.suggestion-card p {
  margin: .8rem 0 0;
  color: var(--space-text);
  line-height: 1.7;
  white-space: pre-wrap;
}

.declaration-content:empty {
  display: none;
}

.detail-panel > p {
  color: var(--space-muted);
  line-height: 1.6;
}

.detail-panel form {
  display: grid;
  gap: .8rem;
}

.detail-panel > .primary-button {
  margin-top: .8rem;
}

.suggestion-card header {
  color: var(--space-gold);
}

.suggestion-card time {
  color: var(--space-muted);
  font-size: .8rem;
}

.primary-button,
.secondary-button {
  justify-self: start;
  border: 0;
  border-radius: 9px;
  padding: .7rem 1rem;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.secondary-button {
  background: rgba(233, 180, 94, .16);
  color: var(--space-gold);
}

button:disabled {
  cursor: wait;
  opacity: .6;
}

.message,
.empty-state {
  padding: .8rem 1rem;
  border-radius: 9px;
  background: rgba(92, 171, 218, .12);
  color: #b9d9f2;
}

.message.error {
  background: rgba(220, 80, 72, .14);
  color: #ffb6ab;
}

.message.success {
  background: rgba(100, 180, 130, .14);
  color: #a8e0b5;
}

@media (max-width: 560px) {
  .site-info-overlay {
    padding: 16px 16px var(--dialog-bottom-reserve, calc(clamp(112px, 13vh, 168px) + 104px));
  }

  .page-list-item {
    grid-template-columns: minmax(0, 1fr) auto 1rem;
    padding-inline: .8rem;
  }

  .suggestion-card header {
    align-items: flex-start;
    flex-direction: column;
  }

  .suggestion-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: .35rem;
  }
}
</style>
