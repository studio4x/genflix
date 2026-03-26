import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AdminLayout } from '@/app/layouts/admin-layout'
import { AdminCourseBuilderLayout } from '@/app/layouts/admin-course-builder-layout'
import { StudentLayout } from '@/app/layouts/student-layout'
import { StudentCoursePlayerLayout } from '@/pages/student/student-course-player-layout'
import { DefaultRedirect } from '@/app/router/default-redirect'
import { ProtectedRoute } from '@/app/router/protected-route'
import { AdminCourseReleasesPage } from '@/pages/admin/admin-course-releases-page'
import { AdminCoursesPage } from '@/pages/admin/admin-courses-page'
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard-page'
import { AdminGroupsPage } from '@/pages/admin/admin-groups-page'
import { AdminLessonsPage } from '@/pages/admin/admin-lessons-page'
import { AdminMaterialsPage } from '@/pages/admin/admin-materials-page'
import { AdminModulesPage } from '@/pages/admin/admin-modules-page'
import { AdminReportsPage } from '@/pages/admin/admin-reports-page'
import { AdminStudentsPage } from '@/pages/admin/admin-students-page'
import { ForgotPasswordPage } from '@/pages/public/forgot-password-page'
import { CookiesPage } from '@/pages/public/cookies-page'
import { LoginPage } from '@/pages/public/login-page'
import { PrivacyPage } from '@/pages/public/privacy-page'
import { ResetPasswordPage } from '@/pages/public/reset-password-page'
import { TermsOfUsePage } from '@/pages/public/terms-of-use-page'
import { UnauthorizedPage } from '@/pages/public/unauthorized-page'
import { StudentAssessmentExecutionPage } from '@/pages/student/student-assessment-execution-page'
import { StudentCourseDetailsPage } from '@/pages/student/student-course-details-page'
import { StudentCoursesPage } from '@/pages/student/student-courses-page'
import { StudentDashboardPage } from '@/pages/student/student-dashboard-page'
import { StudentLessonPage } from '@/pages/student/student-lesson-page'
import { CourseOverviewPanel } from '@/pages/admin/builder/course-overview-panel'
import { ModuleEditorPanel } from '@/pages/admin/builder/module-editor-panel'
import { LessonEditorPanel } from '@/pages/admin/builder/lesson-editor-panel'
import { LessonMaterialsPanel } from '@/pages/admin/builder/lesson-materials-panel'
import { CourseSettingsPanel } from '@/pages/admin/builder/course-settings-panel'
import { CourseAssessmentsPanel } from '@/pages/admin/builder/course-assessments-panel'
import { AssessmentBuilderPanel } from '@/pages/admin/builder/assessment-builder-panel'

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
    path: '/privacidade',
    element: <PrivacyPage />,
  },
  {
    path: '/cookies',
    element: <CookiesPage />,
  },
  {
    path: '/termos-de-uso',
    element: <TermsOfUsePage />,
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
      {
        path: '/aluno/cursos/:courseId/player',
        element: <StudentCoursePlayerLayout />,
        children: [
          {
            path: 'aulas/:lessonId',
            element: <StudentLessonPage />,
          },
          {
            path: 'avaliacoes/:assessmentId',
            element: <StudentAssessmentExecutionPage />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      {
        path: '/admin/cursos/:courseId/builder',
        element: <AdminCourseBuilderLayout />,
        children: [
          {
            index: true,
            element: <CourseOverviewPanel />,
          },
          {
            path: 'modulos/:moduleId',
            element: <ModuleEditorPanel />,
          },
          {
            path: 'modulos/:moduleId/aulas/:lessonId',
            element: <LessonEditorPanel />,
          },
          {
            path: 'modulos/:moduleId/aulas/:lessonId/materiais',
            element: <LessonMaterialsPanel />,
          },
          {
            path: 'modulos/:moduleId/avaliacoes/:assessmentId',
            element: <AssessmentBuilderPanel />,
          },
          {
            path: 'assessments/final',
            element: <AssessmentBuilderPanel />,
          },
          {
            path: 'settings',
            element: <CourseSettingsPanel />,
          },
          {
            path: 'assessments',
            element: <CourseAssessmentsPanel />,
          },
        ]
      },
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
          {
            path: '/admin/alunos',
            element: <AdminStudentsPage />,
          },
          {
            path: '/admin/relatorios',
            element: <AdminReportsPage />,
          },
        ],
      },
    ],
  },
])
