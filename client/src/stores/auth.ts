import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface AuthUser {
  account: string
  name?: string
}

const STORAGE_KEY = 'bambloo-auth'

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  const user = ref<AuthUser | null>(null)

  const currentUser = computed(() => user.value)

  function hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        isLoggedIn.value = false
        user.value = null
        return
      }

      const parsed = JSON.parse(raw) as { isLoggedIn?: boolean; user?: AuthUser | null }
      isLoggedIn.value = !!parsed.isLoggedIn
      user.value = parsed.user ?? null
    } catch {
      isLoggedIn.value = false
      user.value = null
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        isLoggedIn: isLoggedIn.value,
        user: user.value,
      }),
    )
  }

  function login(nextUser: AuthUser) {
    user.value = nextUser
    isLoggedIn.value = true
    persist()
  }

  function logout() {
    user.value = null
    isLoggedIn.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  hydrate()

  return {
    isLoggedIn,
    currentUser,
    login,
    logout,
    hydrate,
  }
})
