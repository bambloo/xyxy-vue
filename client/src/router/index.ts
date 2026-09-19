import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import TagView from '@/views/TagView.vue'
import UserManagementView from '@/views/user/UserManagementView.vue'
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
      name: 'user',
      component: UserManagementView,
      meta: { requiresAuth: true },
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
      redirect: '/user',
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    next('/login')
    return
  }

  if (to.path === '/login' && auth.isLoggedIn) {
    next('/user')
    return
  }

  next()
})

export default router
