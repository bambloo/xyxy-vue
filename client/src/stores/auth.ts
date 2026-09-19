import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { post } from '../scripts/request'
import type { UserPublicProfile } from '../../../common/entity/user'

export type AuthUser = UserPublicProfile

const STORAGE_KEY = 'bambloo-auth'

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  const user = ref<AuthUser | null>(null)
  let hydrationPromise: Promise<void> | null = null

  const currentUser = computed(() => user.value)

  function clearLocalState() {
    isLoggedIn.value = false
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function hydrate() {
    if (hydrationPromise) return hydrationPromise

    hydrationPromise = post('/wpi/user/check', ref(false))
      .then((packet) => {
        const data = packet.data as (UserPublicProfile & { token?: string }) | undefined
        if (!data?.token || !data.account || !data.tag) {
          throw new Error('Invalid session response')
        }
        const { token, ...profile } = data
        localStorage.setItem(STORAGE_KEY, token)
        isLoggedIn.value = true
        user.value = profile
      })
      .catch(() => {
        clearLocalState()
      })

    return hydrationPromise
  }

  function resetHydration() {
    hydrationPromise = null
  }

  function clear() {
    clearLocalState()
    resetHydration()
  }

  function loadCachedState() {
    isLoggedIn.value = !!localStorage.getItem(STORAGE_KEY)
  }

  function login(token: string, nextUser: AuthUser) {
    localStorage.setItem(STORAGE_KEY, token)
    user.value = nextUser ?? null
    isLoggedIn.value = true
  }

  async function logout() {
    try {
      await post('/wpi/user/logout', ref(false))
    } catch {
      // Local credentials must still be cleared when the server is unavailable.
    }
    clearLocalState()
    resetHydration()
  }

  loadCachedState()

  return {
    isLoggedIn,
    currentUser,
    login,
    logout,
    clear,
    hydrate,
  }
})
