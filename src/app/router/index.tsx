import { Navigate, createBrowserRouter } from 'react-router-dom'

import { AdminLayout } from '@/app/layouts/admin-layout'
import { AdminCourseBuilderLayout } from '@/app/layouts/admin-course-builder-layout'
import { CreatorLayout } from '@/app/layouts/creator-layout'
import { StudentLayout } from '@/app/layouts/student-layout'
import { StudentCoursePlayerLayout } from '@/pages/student/student-course-player-layout'
import { ProtectedRoute } from '@/app/router/protected-route'
import { AdminCourseReleasesPage } from '@/pages/admin/admin-course-releases-page'
import { AdminCoursesPage } from '@/pages/admin/admin-courses-page'
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard-page'
import { AdminGroupsPage } from '@/pages/admin/admin-groups-page'
import { AdminLessonsPage } from '@/pages/admin/admin-lessons-page'
import { AdminMaterialsPage } from '@/pages/admin/admin-materials-page'
import { AdminModulesPage } from '@/pages/admin/admin-modules-page'
import { AdminReportsPage } from '@/pages/admin/admin-reports-page'
import { AdminUsersPage } from '@/pages/admin/admin-users-page'
import { AdminAccountPage } from '@/pages/admin/admin-account-page'
import { AdminButtonTemplatesPage } from '@/pages/admin/admin-button-templates-page'
import { AdminPublicFormsPage } from '@/pages/admin/admin-public-forms-page'
import { AdminPaymentSettingsPage } from '@/pages/admin/admin-payment-settings-page'
import { AdminCreatorPayoutsPage } from '@/pages/admin/admin-creator-payouts-page'
import { AdminQuizTypesPage } from '@/pages/admin/admin-quiz-types-page'
import { AdminNotificationsPage } from '@/pages/admin/admin-notifications-page'
import { ForgotPasswordPage } from '@/pages/public/forgot-password-page'
import { AuthCallbackPage } from '@/pages/public/auth-callback-page'
import { CookiesPage } from '@/pages/public/cookies-page'
import { PublicBlogPage } from '@/pages/public/public-blog-page'
import { PublicBlogPostPage } from '@/pages/public/public-blog-post-page'
import { PublicCommunityPage } from '@/pages/public/public-community-page'
import { PublicContactPage } from '@/pages/public/public-contact-page'
import { PublicCourseDetailsPage } from '@/pages/public/public-course-details-page'
import { PublicAboutPage } from '@/pages/public/public-about-page'
import { LoginPage } from '@/pages/public/login-page'
import { SignUpPage } from '@/pages/public/sign-up-page'
import { PrivacyPage } from '@/pages/public/privacy-page'
import { PublicCoursesPage } from '@/pages/public/public-courses-page'
import { PublicHomePage } from '@/pages/public/public-home-page'
import { PublicResourcesPage } from '@/pages/public/public-resources-page'
import { ResetPasswordPage } from '@/pages/public/reset-password-page'
import { TermsOfUsePage } from '@/pages/public/terms-of-use-page'
import { UnauthorizedPage } from '@/pages/public/unauthorized-page'
import { MessagesPage } from '@/pages/shared/messages-page'
import { MessagesRedirectPage } from '@/pages/shared/messages-redirect-page'
import { StudentAssessmentExecutionPage } from '@/pages/student/student-assessment-execution-page'
import { StudentCourseDetailsPage } from '@/pages/student/student-course-details-page'
import { StudentCoursesPage } from '@/pages/student/student-courses-page'
import { StudentAccountPage } from '@/pages/student/student-account-page'
import { StudentDashboardPage } from '@/pages/student/student-dashboard-page'
import { StudentLessonPage } from '@/pages/student/student-lesson-page'
import { CreatorProfilePage } from '@/pages/creator/creator-profile-page'
import { CreatorReportsPage } from '@/pages/creator/creator-reports-page'
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
    element: <PublicHomePage />,
  },
  {
    path: '/cursos',
    element: <PublicCoursesPage />,
  },
  {
    path: '/cursos/:slug',
    element: <PublicCourseDetailsPage />,
  },
  {
    path: '/sobre',
    element: <PublicAboutPage />,
  },
  {
    path: '/blog',
    element: <PublicBlogPage />,
  },
  {
    path: '/blog/:slug',
    element: <PublicBlogPostPage />,
  },
  {
    path: '/contato',
    element: <PublicContactPage />,
  },
  {
    path: '/comunidade',
    element: <PublicCommunityPage />,
  },
  {
    path: '/recursos',
    element: <PublicResourcesPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    path: '/criar-conta',
    element: <SignUpPage />,
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
    element: <ProtectedRoute allowedRoles={['student', 'aluno']} />,
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
          {
            path: '/aluno/minha-conta',
            element: <StudentAccountPage />,
          },
          {
            path: '/aluno/mensagens',
            element: <MessagesPage contextLabel="Aluno" />,
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
    element: <ProtectedRoute allowedRoles={['criador', 'professor']} />,
    children: [
      {
        path: '/criador',
        element: <CreatorLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/criador/relatorios" replace />,
          },
          {
            path: '/criador/relatorios',
            element: <CreatorReportsPage />,
          },
          {
            path: '/criador/perfil',
            element: <CreatorProfilePage />,
          },
          {
            path: '/criador/mensagens',
            element: <MessagesPage contextLabel="Criador" />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['admin', 'criador', 'professor', 'student', 'aluno']} />,
    children: [
      {
        path: '/mensagens',
        element: <MessagesRedirectPage />,
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
            path: 'releases',
            element: <AdminCourseReleasesPage />,
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
            element: <Navigate to="/admin/usuarios" replace />,
          },
          {
            path: '/admin/usuarios',
            element: <AdminUsersPage />,
          },
          {
            path: '/admin/minha-conta',
            element: <AdminAccountPage />,
          },
          {
            path: '/admin/botoes-aula',
            element: <AdminButtonTemplatesPage />,
          },
          {
            path: '/admin/relatorios',
            element: <AdminReportsPage />,
          },
          {
            path: '/admin/formularios',
            element: <AdminPublicFormsPage />,
          },
          {
            path: '/admin/notificacoes',
            element: <AdminNotificationsPage />,
          },
          {
            path: '/admin/mensagens',
            element: <MessagesPage contextLabel="Admin" />,
          },
          {
            path: '/admin/pagamentos',
            element: <AdminPaymentSettingsPage />,
          },
          {
            path: '/admin/repasses',
            element: <AdminCreatorPayoutsPage />,
          },
          {
            path: '/admin/pagamento',
            element: <Navigate to="/admin/pagamentos" replace />,
          },
          {
            path: '/admin/tipos-quiz',
            element: <AdminQuizTypesPage />,
          },
        ],
      },
    ],
  },
])
