import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AdminLayout } from '@/app/layouts/admin-layout'
import { StudentLayout } from '@/app/layouts/student-layout'
import { DefaultRedirect } from '@/app/router/default-redirect'
import { ProtectedRoute } from '@/app/router/protected-route'
import { AdminCourseReleasesPage } from '@/pages/admin/admin-course-releases-page'
import { AdminCoursesPage } from '@/pages/admin/admin-courses-page'
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard-page'
import { AdminGroupsPage } from '@/pages/admin/admin-groups-page'
import { AdminLessonsPage } from '@/pages/admin/admin-lessons-page'
import { AdminMaterialsPage } from '@/pages/admin/admin-materials-page'
import { AdminModulesPage } from '@/pages/admin/admin-modules-page'
import { ForgotPasswordPage } from '@/pages/public/forgot-password-page'
import { LoginPage } from '@/pages/public/login-page'
import { ResetPasswordPage } from '@/pages/public/reset-password-page'
import { UnauthorizedPage } from '@/pages/public/unauthorized-page'
import { StudentCourseDetailsPage } from '@/pages/student/student-course-details-page'
import { StudentCoursesPage } from '@/pages/student/student-courses-page'
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
            element: <Navigate to="/aluno/dashboard" replace />,
          },
          {
            path: '/aluno/dashboard',
            element: <StudentDashboardPage />,
          },
          {
            path: '/aluno/cursos',
            element: <StudentCoursesPage />,
          },
          {
            path: '/aluno/cursos/:courseId',
            element: <StudentCourseDetailsPage />,
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
          {
            path: '/admin/cursos',
            element: <AdminCoursesPage />,
          },
          {
            path: '/admin/cursos/:courseId/modulos',
            element: <AdminModulesPage />,
          },
          {
            path: '/admin/cursos/:courseId/liberacoes',
            element: <AdminCourseReleasesPage />,
          },
          {
            path: '/admin/modulos/:moduleId/aulas',
            element: <AdminLessonsPage />,
          },
          {
            path: '/admin/aulas/:lessonId/materiais',
            element: <AdminMaterialsPage />,
          },
          {
            path: '/admin/grupos',
            element: <AdminGroupsPage />,
          },
        ],
      },
    ],
  },
])
