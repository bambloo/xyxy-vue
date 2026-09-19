import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import TagView from '@/views/TagView.vue'
import UserManagementView from '@/views/user/UserManagementView.vue'
import ProfileView from '@/views/user/profile/ProfileView.vue'
import PasswordView from '@/views/user/security/PasswordView.vue'
import SecuritySettingsView from '@/views/user/security/SecuritySettingsView.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/user',
      component: UserManagementView,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'user-profile' } },
        { path: 'profile', name: 'user-profile', component: ProfileView },
        { path: 'password', name: 'user-password', component: PasswordView },
        { path: 'security', name: 'user-security', component: SecuritySettingsView },
      ],
    },
    {
      path: '/:tag',
      name: 'tag',
      component: TagView,
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/user/profile',
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  await auth.hydrate()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    next('/login')
    return
  }

  if (to.path === '/login' && auth.isLoggedIn) {
    next('/user/profile')
    return
  }

  next()
})

export default router
