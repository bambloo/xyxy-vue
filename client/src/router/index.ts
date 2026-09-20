import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import TagUserView from '@/views/TagUserView.vue'
import UserManagementView from '@/views/user/UserManagementView.vue'
import ProfileView from '@/views/user/profile/ProfileView.vue'
import PasswordView from '@/views/user/security/PasswordView.vue'
import SecuritySettingsView from '@/views/user/security/SecuritySettingsView.vue'
import UserListView from '@/views/user/users/UserListView.vue'
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
      path: '/admin',
      component: UserManagementView,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'user-profile' } },
        { path: 'profile', name: 'user-profile', component: ProfileView },
        { path: 'password', name: 'user-password', component: PasswordView },
        { path: 'security', name: 'user-security', component: SecuritySettingsView },
        { path: 'users', name: 'user-users', component: UserListView },
      ],
    },
    {
      path: '/home',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/',
      redirect: { name: 'home' },
    },
    {
      path: '/:tag(.*)*',
      name: 'tag',
      component: TagUserView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/admin/profile',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.hydrate()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return '/login'
  }

  if (to.path === '/login' && auth.isLoggedIn) {
    return '/admin/profile'
  }

  return true
})

export default router
