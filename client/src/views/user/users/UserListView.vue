<script setup lang="ts">
import { ref } from 'vue'
import { post } from '../../../scripts/request'

interface ImportedUser {
  id: string
  account: string
  name: string
  isActive?: boolean
}

const loading = ref(false)
const errorMessage = ref('')
const users = ref<ImportedUser[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
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
    errorMessage.value = result.msg || result.message || '用户导入失败'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <section class="users-view">
    <div class="page-heading">
      <div>
        <p class="eyebrow">用户列表</p>
        <h2>导入用户 ID</h2>
        <p>上传 TXT、XLS 或 XLSX 文件，将列表中的 ID 记录为未激活用户。</p>
      </div>
      <button class="upload-button" type="button" :disabled="loading" @click="openFilePicker">
        {{ loading ? '正在导入...' : '选择文件' }}
      </button>
      <input ref="fileInput" class="hidden-input" type="file" accept=".txt,.xls,.xlsx" @change="importFile" />
    </div>

    <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

    <div v-if="users.length" class="user-table-wrap">
      <table>
        <thead>
          <tr><th>用户 ID</th><th>账号</th><th>状态</th></tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.account }}</td>
            <td><span class="status">{{ user.isActive === false ? '未激活' : '已激活' }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-state">选择文件后，导入的用户会显示在这里。</div>
  </section>
</template>

<style scoped lang="scss">
.users-view { max-width: 980px; }
.page-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; margin: 2rem 0 1.5rem; }
.eyebrow { margin: 0 0 .45rem; color: #d28f2d; font-size: .72rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
h2 { margin: 0; color: #172222; font-size: 2rem; }
.page-heading p:not(.eyebrow) { margin: .6rem 0 0; color: #71817d; }
.upload-button { border: 0; border-radius: 10px; padding: .8rem 1.2rem; background: #153f3d; color: #fff; font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap; }
.upload-button:disabled { opacity: .6; cursor: wait; }
.hidden-input { display: none; }
.error-message { padding: .8rem 1rem; border-radius: 8px; background: #fff0ed; color: #b44c3d; }
.user-table-wrap { overflow: auto; border-radius: 12px; background: rgba(255, 255, 255, .72); }
table { width: 100%; border-collapse: collapse; text-align: left; }
th, td { padding: 1rem 1.1rem; border-bottom: 1px solid rgba(21, 63, 61, .1); }
th { color: #71817d; font-size: .8rem; }
.status { display: inline-block; border-radius: 999px; padding: .25rem .6rem; background: #fff1d8; color: #9b681c; font-size: .8rem; }
.empty-state { padding: 3rem 1rem; color: #71817d; text-align: center; }
@media (max-width: 620px) { .page-heading { align-items: stretch; flex-direction: column; } }
</style>