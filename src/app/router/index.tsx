import { createBrowserRouter } from 'react-router-dom'

import { AdminLayout } from '@/app/layouts/admin-layout'
import { StudentLayout } from '@/app/layouts/student-layout'
import { DefaultRedirect } from '@/app/router/default-redirect'
import { ProtectedRoute } from '@/app/router/protected-route'
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard-page'
import { ForgotPasswordPage } from '@/pages/public/forgot-password-page'
import { LoginPage } from '@/pages/public/login-page'
import { ResetPasswordPage } from '@/pages/public/reset-password-page'
import { UnauthorizedPage } from '@/pages/public/unauthorized-page'
import { StudentDashboardPage } from '@/pages/student/student-dashboard-page'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <DefaultRedirect />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/recuperar-senha',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/redefinir-senha',
    element: <ResetPasswordPage />,
  },
  {
    path: '/nao-autorizado',
    element: <UnauthorizedPage />,
  },
  {
    element: <ProtectedRoute allowedRoles={['student']} />,
    children: [
      {
        path: '/aluno',
        element: <StudentLayout />,
        children: [
          {
            index: true,
            element: <StudentDashboardPage />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <AdminDashboardPage />,
          },
        ],
      },
    ],
  },
])
