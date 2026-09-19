<script setup lang="ts">
import { ref } from 'vue'
import { post } from '../../../scripts/request'
import { useI18n } from 'vue-i18n'

interface ImportedUser {
  tag: string
  account: string
  name: string
  phone?: string
  isActive?: boolean
}

type QueryField = 'tag' | 'account' | 'phone'

const loading = ref(false)
const { t } = useI18n()
const queryLoading = ref(false)
const errorMessage = ref('')
const users = ref<ImportedUser[]>([])
const queryField = ref<QueryField>('tag')
const queryValue = ref('')
const newTag = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

function openFilePicker() {
  if (loading.value) return
  fileInput.value?.click()
}

async function importSelectedFile(file: File | undefined) {
  if (!file) return

  errorMessage.value = ''
  try {
    const content = await file.arrayBuffer()
    const bytes = new Uint8Array(content)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const packet = await post('/wpi/user/import', loading, {
      fileName: file.name,
      contentBase64: btoa(binary),
    })
    const data = packet.data as { users?: ImportedUser[] } | undefined
    users.value = data?.users ?? []
  } catch (error: unknown) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('users.importError')
  }
}

function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  void importSelectedFile(input.files?.[0])
  input.value = ''
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (!loading.value) isDragging.value = true
}

function handleDragLeave(event: DragEvent) {
  if (!event.currentTarget || !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) {
    isDragging.value = false
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  if (!loading.value) void importSelectedFile(event.dataTransfer?.files[0])
}

async function queryUser() {
  const value = queryValue.value.trim()
  if (!value) {
    errorMessage.value = t('users.queryRequired')
    return
  }

  errorMessage.value = ''
  try {
    const packet = await post('/wpi/user/get', queryLoading, { [queryField.value]: value })
    const user = packet.data as ImportedUser | undefined
    users.value = user ? [user] : []
  } catch (error: unknown) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('users.queryError')
    users.value = []
  }
}

async function addTag() {
  const tag = newTag.value.trim()
  if (!tag) {
    errorMessage.value = t('users.tagRequired')
    return
  }

  errorMessage.value = ''
  try {
    const packet = await post('/wpi/user/add-tag', queryLoading, { tag })
    const user = packet.data as ImportedUser | undefined
    if (user) users.value = [user, ...users.value.filter((item) => item.tag !== user.tag)]
    newTag.value = ''
  } catch (error: unknown) {
    const result = error as { msg?: string; message?: string }
    errorMessage.value = result.msg || result.message || t('users.addTagError')
  }
}
</script>

<template>
  <section class="users-view">
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ t('users.eyebrow') }}</p>
        <h2>{{ t('users.title') }}</h2>
        <p>{{ t('users.intro') }}</p>
      </div>
      <input ref="fileInput" class="hidden-input" type="file" accept=".txt,.xls,.xlsx" @change="importFile" />
    </div>

    <form class="query-form add-tag-form" @submit.prevent="addTag">
      <label for="new-tag">{{ t('users.addTag') }}</label>
      <input id="new-tag" v-model="newTag" type="search" :placeholder="t('users.tagPlaceholder')" />
      <button type="submit" :disabled="queryLoading">{{ t('users.addTagButton') }}</button>
    </form>

    <button class="drop-zone" :class="{ dragging: isDragging, busy: loading }" type="button" :disabled="loading"
      :aria-label="t('users.uploadAria')" @click="openFilePicker" @keydown.enter.prevent="openFilePicker"
      @keydown.space.prevent="openFilePicker" @dragover="handleDragOver" @dragleave="handleDragLeave"
      @drop="handleDrop">
      <ion-icon name="cloud-upload-outline"></ion-icon>
      <strong>{{ loading ? t('users.uploading') : t('users.drop') }}</strong>
      <span>{{ loading ? t('users.wait') : t('users.choose') }}</span>
    </button>

    <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

    <form class="query-form" @submit.prevent="queryUser">
      <label for="query-field">{{ t('users.query') }}</label>
      <select id="query-field" v-model="queryField">
        <option value="tag">{{ t('users.tag') }}</option>
        <option value="account">{{ t('common.account') }}</option>
        <option value="phone">{{ t('common.phone') }}</option>
      </select>
      <input v-model="queryValue" type="search" :placeholder="t('users.queryPlaceholder')" />
      <button type="submit" :disabled="queryLoading">
        {{ queryLoading ? t('users.querying') : t('users.queryButton') }}
      </button>
    </form>

    <div v-if="users.length" class="user-table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('users.tag') }}</th>
            <th>{{ t('common.account') }}</th>
            <th>{{ t('common.name') }}</th>
            <th>{{ t('common.phone') }}</th>
            <th>{{ t('common.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.tag">
            <td>{{ user.tag }}</td>
            <td>{{ user.account }}</td>
            <td>{{ user.name }}</td>
            <td>{{ user.phone || '-' }}</td>
            <td><span class="status">{{ user.isActive === false ? t('common.inactive') : t('common.active') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-state">{{ t('users.empty') }}</div>
  </section>
</template>

<style scoped lang="scss">
.users-view {
  max-width: 980px;
}

.page-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  margin: 2rem 0 1.5rem;
}

.eyebrow {
  margin: 0 0 .45rem;
  color: var(--space-gold);
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  color: var(--space-text);
  font-size: 2rem;
}

.page-heading p:not(.eyebrow) {
  margin: .6rem 0 0;
  color: var(--space-muted);
}

.hidden-input {
  display: none;
}

.drop-zone {
  display: grid;
  justify-items: center;
  gap: .45rem;
  width: 100%;
  margin-bottom: 1.5rem;
  padding: 2.5rem 1rem;
  border: 1.5px dashed rgba(151, 197, 237, .34);
  border-radius: 14px;
  background: var(--space-panel-soft);
  color: var(--space-text);
  backdrop-filter: blur(14px);
  font: inherit;
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--space-gold);
  background: rgba(233, 180, 94, .14);
  transform: translateY(-1px);
}

.drop-zone.busy {
  cursor: wait;
  opacity: .7;
}

.drop-zone ion-icon {
  color: var(--space-gold);
  font-size: 2rem;
}

.drop-zone strong {
  font-size: 1rem;
}

.drop-zone span {
  color: var(--space-muted);
  font-size: .85rem;
}

.error-message {
  padding: .8rem 1rem;
  border-radius: 8px;
  background: #fff0ed;
  color: #b44c3d;
}

.query-form {
  display: flex;
  align-items: center;
  gap: .7rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--space-panel);
  backdrop-filter: blur(14px);
}

.query-form label {
  color: var(--space-text);
  font-weight: 700;
  white-space: nowrap;
}

.query-form select,
.query-form input {
  min-width: 0;
  padding: .7rem .8rem;
  border: 1px solid var(--space-line);
  border-radius: 8px;
  background: rgba(13, 38, 67, .72);
  color: var(--space-text);
  font: inherit;
}

.query-form input {
  flex: 1;
}

.query-form button {
  border: 0;
  border-radius: 8px;
  padding: .7rem 1.1rem;
  background: var(--space-gold);
  color: #091728;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.query-form button:disabled {
  cursor: wait;
  opacity: .6;
}

.user-table-wrap {
  overflow: auto;
  border-radius: 12px;
  background: var(--space-panel);
  backdrop-filter: blur(14px);
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 1rem 1.1rem;
  border-bottom: 1px solid rgba(21, 63, 61, .1);
}

th {
  color: var(--space-muted);
  font-size: .8rem;
}

.status {
  display: inline-block;
  border-radius: 999px;
  padding: .25rem .6rem;
  background: #fff1d8;
  color: #9b681c;
  font-size: .8rem;
}

.empty-state {
  padding: 3rem 1rem;
  color: #71817d;
  text-align: center;
}

@media (max-width: 620px) {
  .page-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .query-form {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
