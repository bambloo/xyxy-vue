<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toggleLocale } from '@/i18n'
import {
  SITE_DECLARATIONS,
  type SiteDeclaration,
  type SiteDeclarationId,
  type SiteSuggestion,
} from '../../../../common/entity/site-info'
import { post } from '../../scripts/request'
import { useAuthStore } from '../../stores/auth'

const props = withDefaults(defineProps<{ dialog?: boolean }>(), { dialog: false })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const auth = useAuthStore()
const loading = ref(false)
const suggestionLoading = ref(false)
const savingDeclarationId = ref('')
const errorMessage = ref('')
const statusMessage = ref('')
const suggestion = ref('')
const selectedPage = ref<SiteDeclarationId | 'suggestions' | ''>('')
const declarations = ref<SiteDeclaration[]>(
  SITE_DECLARATIONS.map((item) => ({ id: item.id, content: '' })),
)
const dataLoaded = ref(false)
const suggestions = ref<SiteSuggestion[]>([])
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

async function saveDeclaration(declaration: SiteDeclaration) {
  if (savingDeclarationId.value) return
  errorMessage.value = ''
  statusMessage.value = ''
  savingDeclarationId.value = declaration.id
  try {
    const packet = await post('/wpi/site-info/declaration', loading, {
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
      @click.self="props.dialog && emit('close')"
    >
      <section :class="['site-info-page', { 'site-info-dialog': props.dialog }]" role="region">
        <button
          v-if="props.dialog"
          class="dialog-close"
          type="button"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          ×
        </button>
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
      <p>{{ t('siteInfo.feedbackIntro') }}</p>
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
        <p v-if="!suggestions.length" class="empty-state">{{ t('siteInfo.noSuggestions') }}</p>
        <article v-for="entry in suggestions" :key="entry.id" class="suggestion-card">
          <header>
            <strong>{{ entry.userTag }}</strong>
            <time>{{ entry.createdAt }}</time>
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
        :disabled="loading || savingDeclarationId === currentDeclaration()!.id"
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
  padding: 1rem;
  background: rgba(1, 7, 19, .78);
  backdrop-filter: blur(10px);
}

.site-info-dialog {
  position: relative;
  width: min(100%, 700px);
  max-height: min(88vh, 820px);
  overflow: auto;
  padding: 1.5rem;
  border: 1px solid rgba(163, 207, 255, .38);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 50% 0, rgba(103, 159, 231, .2), transparent 54%),
    linear-gradient(145deg, rgba(13, 34, 65, .99), rgba(5, 15, 32, .99));
  box-shadow: 0 28px 90px rgba(0, 0, 0, .55);
  color: #e8f1fb;
}

.dialog-close {
  position: absolute;
  top: .8rem;
  right: .8rem;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--space-text);
  font-size: 1.5rem;
  cursor: pointer;
}

.dialog-close:hover {
  background: rgba(137, 177, 226, .14);
}

.site-info-dialog .page-heading {
  padding-right: 2rem;
}

.page-heading {
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 .4rem;
  color: var(--space-gold);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: 1.6rem;
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

.page-list,
.detail-panel,
.suggestion-card {
  padding: 1rem;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  background: var(--space-panel);
}

.page-list {
  padding: 0;
  overflow: hidden;
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
  .page-list-item {
    grid-template-columns: minmax(0, 1fr) auto 1rem;
    padding-inline: .8rem;
  }

  .suggestion-card header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
