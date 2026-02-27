import { createRouter, createWebHistory } from 'vue-router'
import OrderView from '../views/OrderView.vue'
import CompleteProfileView from '../views/CompleteProfileView.vue'
import EditProfileView from '../views/EditProfileView.vue'
import ProfileView from '../views/ProfileView.vue'
import AdminDashboardView from '../views/AdminDashboardView.vue'
import LoginView from '../views/LoginView.vue'
import ClaimOrderView from '../views/ClaimOrderView.vue'
import UserOrdersView from '../views/UserOrdersView.vue'
import PaymentMethodsView from '../views/PaymentMethodsView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { authService } from '../api/authService'
import { isAdmin } from '../types/auth'

// Auth guard for protected routes
const isAuthenticated = (): boolean => {
  return localStorage.getItem('token') !== null
}

// Check if user has admin role
const checkAdminRole = async (): Promise<boolean> => {
  try {
    const response = await authService.me()
    return isAdmin(response.data)
  } catch {
    return false
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/profile'
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true }
    },
    {
      path: '/order/claim/:token',
      name: 'claim-order',
      component: ClaimOrderView,
      meta: { requiresAuth: true }
    },
    {
      path: '/order/:id',
      name: 'order',
      component: OrderView
    },
    {
      path: '/complete-profile/:token',
      name: 'complete-profile',
      component: CompleteProfileView
    },
    {
      path: '/edit-profile/:id',
      name: 'edit-profile',
      component: EditProfileView,
      meta: { requiresAuth: true }
    },
    {
      path: '/my-orders',
      name: 'my-orders',
      component: UserOrdersView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminDashboardView,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/imports',
      name: 'admin-imports',
      component: () => import('../views/AdminImportsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/payment-methods',
      name: 'payment-methods',
      component: PaymentMethodsView,
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView
    }
  ]
})

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  const authenticated = isAuthenticated()

  // If route requires auth and user is not authenticated
  if (to.meta.requiresAuth && !authenticated) {
    // Save the intended destination for redirect after login
    const redirectPath = to.fullPath
    next({ name: 'login', query: { redirect: redirectPath } })
    return
  }

  // If route requires admin role
  if (to.meta.requiresAdmin && authenticated) {
    const hasAdminRole = await checkAdminRole()
    if (!hasAdminRole) {
      next({ name: 'profile' })
      return
    }
  }

  // If route requires guest (login page) and user is authenticated
  if (to.meta.requiresGuest && authenticated) {
    next({ name: 'profile' })
    return
  }

  next()
})

export default router
