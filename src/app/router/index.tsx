import { Navigate, createBrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

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
import { AdminReviewsPage } from '@/pages/admin/admin-reviews-page'
import { AdminOperationalPendingPage } from '@/pages/admin/admin-operational-pending-page'
import { AdminBrandingSettingsPage } from '@/pages/admin/admin-branding-settings-page'
import { AdminSiteEditorPage } from '@/pages/admin/admin-site-editor-page'
import { ForgotPasswordPage } from '@/pages/public/forgot-password-page'
import { AuthCallbackPage } from '@/pages/public/auth-callback-page'
import { CookiesPage } from '@/pages/public/cookies-page'
import { PublicBlogPage } from '@/pages/public/public-blog-page'
import { PublicBlogPostPage } from '@/pages/public/public-blog-post-page'
import { PublicCommunityPage } from '@/pages/public/public-community-page'
import { PublicContactPage } from '@/pages/public/public-contact-page'
import { PublicCourseDetailsPage } from '@/pages/public/public-course-details-page'
import { PublicAboutPage } from '@/pages/public/public-about-page'
import { PublicFaqPage } from '@/pages/public/public-faq-page'
import { PublicHelpPage } from '@/pages/public/public-help-page'
import { LoginPage } from '@/pages/public/login-page'
import { SignUpPage } from '@/pages/public/sign-up-page'
import { PrivacyPage } from '@/pages/public/privacy-page'
import { PublicReferPage } from '@/pages/public/public-refer-page'
import { PublicRefundPolicyPage } from '@/pages/public/public-refund-policy-page'
import { PublicCoursesPage } from '@/pages/public/public-courses-page'
import { PublicHomePage } from '@/pages/public/public-home-page'
import { PublicResourcesPage } from '@/pages/public/public-resources-page'
import { PublicTeachPage } from '@/pages/public/public-teach-page'
import { ResetPasswordPage } from '@/pages/public/reset-password-page'
import { TermsOfUsePage } from '@/pages/public/terms-of-use-page'
import { UnauthorizedPage } from '@/pages/public/unauthorized-page'
import { MessagesPage } from '@/pages/shared/messages-page'
import { MessagesRedirectPage } from '@/pages/shared/messages-redirect-page'
import { NotificationPreferencesPage } from '@/pages/shared/notification-preferences-page'
import { EditablePageSeo } from '@/features/site-editor/editable-page-seo'
import { EditableControlsHint, SiteContentScope, VisualEditorProvider } from '@/features/site-editor/visual-editor'
import type { SitePageKey } from '@/features/site-editor/types'
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
import { CoursePublicPagePanel } from '@/pages/admin/builder/course-public-page-panel'
import { CourseAssessmentsPanel } from '@/pages/admin/builder/course-assessments-panel'
import { AssessmentBuilderPanel } from '@/pages/admin/builder/assessment-builder-panel'

type PublicSeoConfig = {
  entryKey: string
  fallback: {
    title: string
    description: string
    slug: string
    image: string
  }
  label?: string
}

function PublicEditableRoute({
  pageKey,
  children,
  seo,
}: {
  pageKey: SitePageKey
  children: ReactNode
  seo?: PublicSeoConfig
}) {
  return (
    <VisualEditorProvider>
      <SiteContentScope pageKey={pageKey}>
        <EditableControlsHint />
        {seo ? <EditablePageSeo pageKey={pageKey} entryKey={seo.entryKey} fallback={seo.fallback} label={seo.label} /> : null}
        {children}
      </SiteContentScope>
    </VisualEditorProvider>
  )
}

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <PublicEditableRoute pageKey="home" seo={{ entryKey: 'home.seo', fallback: { title: 'GenFlix | Início', description: 'A plataforma GenFlix reúne cursos, trilhas e ferramentas de estudo para avanço real de carreira.', slug: '/', image: '' } }}><PublicHomePage /></PublicEditableRoute>,
  },
  {
    path: '/cursos',
    element: <PublicEditableRoute pageKey="courses" seo={{ entryKey: 'courses.seo', fallback: { title: 'GenFlix | Cursos', description: 'Explore os cursos e trilhas da GenFlix para aprofundar seu conhecimento com mais clareza.', slug: '/cursos', image: '' } }}><PublicCoursesPage /></PublicEditableRoute>,
  },
  {
    path: '/cursos/:slug',
    element: <PublicEditableRoute pageKey="course-detail" seo={{ entryKey: 'course-detail.seo', fallback: { title: 'GenFlix | Detalhes do curso', description: 'Conheça a estrutura, os benefícios e os diferenciais do curso selecionado na GenFlix.', slug: '/cursos', image: '' } }}><PublicCourseDetailsPage /></PublicEditableRoute>,
  },
  {
    path: '/sobre',
    element: <PublicEditableRoute pageKey="about" seo={{ entryKey: 'about.seo', fallback: { title: 'GenFlix | Sobre', description: 'Saiba mais sobre a proposta da GenFlix e como a plataforma organiza conteúdo educacional.', slug: '/sobre', image: '' } }}><PublicAboutPage /></PublicEditableRoute>,
  },
  {
    path: '/blog',
    element: <PublicEditableRoute pageKey="blog" seo={{ entryKey: 'blog.seo', fallback: { title: 'GenFlix | Blog', description: 'Leituras, artigos e conteúdos editoriais da GenFlix para aprofundar estudo e repertório.', slug: '/blog', image: '' } }}><PublicBlogPage /></PublicEditableRoute>,
  },
  {
    path: '/blog/:slug',
    element: <PublicEditableRoute pageKey="blog-post" seo={{ entryKey: 'blog-post.seo', fallback: { title: 'GenFlix | Artigo', description: 'Leia o artigo selecionado no blog da GenFlix.', slug: '/blog', image: '' } }}><PublicBlogPostPage /></PublicEditableRoute>,
  },
  {
    path: '/contato',
    element: <PublicEditableRoute pageKey="contact" seo={{ entryKey: 'contact.seo', fallback: { title: 'GenFlix | Contato', description: 'Fale com a equipe da GenFlix para tirar dúvidas, solicitar suporte ou iniciar um contato comercial.', slug: '/contato', image: '' } }}><PublicContactPage /></PublicEditableRoute>,
  },
  {
    path: '/comunidade',
    element: <PublicEditableRoute pageKey="community" seo={{ entryKey: 'community.seo', fallback: { title: 'GenFlix | Comunidade', description: 'Conheça os espaços de troca e comunidades ligadas à plataforma GenFlix.', slug: '/comunidade', image: '' } }}><PublicCommunityPage /></PublicEditableRoute>,
  },
  {
    path: '/recursos',
    element: <PublicEditableRoute pageKey="resources" seo={{ entryKey: 'resources.seo', fallback: { title: 'GenFlix | Recursos', description: 'Acesse materiais, ferramentas e recursos complementares organizados pela GenFlix.', slug: '/recursos', image: '' } }}><PublicResourcesPage /></PublicEditableRoute>,
  },
  {
    path: '/politica-de-reembolso',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.refund.seo', fallback: { title: 'GenFlix | Política de reembolso', description: 'Entenda as diretrizes de reembolso e cancelamento aplicadas aos serviços e conteúdos da GenFlix.', slug: '/politica-de-reembolso', image: '' } }}><PublicRefundPolicyPage /></PublicEditableRoute>,
  },
  {
    path: '/perguntas-frequentes',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.faq.seo', fallback: { title: 'GenFlix | Perguntas frequentes', description: 'Veja respostas rápidas para as dúvidas mais comuns sobre a GenFlix.', slug: '/perguntas-frequentes', image: '' } }}><PublicFaqPage /></PublicEditableRoute>,
  },
  {
    path: '/ajuda',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.help.seo', fallback: { title: 'GenFlix | Ajuda', description: 'Consulte orientações práticas sobre uso da plataforma GenFlix.', slug: '/ajuda', image: '' } }}><PublicHelpPage /></PublicEditableRoute>,
  },
  {
    path: '/indique-a-genflix',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.refer.seo', fallback: { title: 'GenFlix | Indique a GenFlix', description: 'Conheça a página de indicação da GenFlix e compartilhe a plataforma com sua rede.', slug: '/indique-a-genflix', image: '' } }}><PublicReferPage /></PublicEditableRoute>,
  },
  {
    path: '/ensine-na-genflix',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.teach.seo', fallback: { title: 'GenFlix | Ensine na GenFlix', description: 'Apresente sua proposta de curso e conheça a frente de parcerias educacionais da GenFlix.', slug: '/ensine-na-genflix', image: '' } }}><PublicTeachPage /></PublicEditableRoute>,
  },
  {
    path: '/login',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.auth.login.seo', fallback: { title: 'GenFlix | Login', description: 'Acesse sua conta na GenFlix.', slug: '/login', image: '' } }}><LoginPage /></PublicEditableRoute>,
  },
  {
    path: '/auth/callback',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.auth.callback.seo', fallback: { title: 'GenFlix | Autenticação', description: 'Concluindo sua autenticação na GenFlix.', slug: '/auth/callback', image: '' } }}><AuthCallbackPage /></PublicEditableRoute>,
  },
  {
    path: '/criar-conta',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.auth.signup.seo', fallback: { title: 'GenFlix | Criar conta', description: 'Crie sua conta na GenFlix para começar a usar a plataforma.', slug: '/criar-conta', image: '' } }}><SignUpPage /></PublicEditableRoute>,
  },
  {
    path: '/recuperar-senha',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.auth.forgot.seo', fallback: { title: 'GenFlix | Recuperar senha', description: 'Solicite a recuperação de acesso à sua conta GenFlix.', slug: '/recuperar-senha', image: '' } }}><ForgotPasswordPage /></PublicEditableRoute>,
  },
  {
    path: '/redefinir-senha',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.auth.reset.seo', fallback: { title: 'GenFlix | Redefinir senha', description: 'Defina uma nova senha para sua conta na GenFlix.', slug: '/redefinir-senha', image: '' } }}><ResetPasswordPage /></PublicEditableRoute>,
  },
  {
    path: '/nao-autorizado',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.auth.unauthorized.seo', fallback: { title: 'GenFlix | Não autorizado', description: 'Você não possui acesso liberado para esta área da GenFlix.', slug: '/nao-autorizado', image: '' } }}><UnauthorizedPage /></PublicEditableRoute>,
  },
  {
    path: '/privacidade',
    element: <PublicEditableRoute pageKey="privacy" seo={{ entryKey: 'privacy.seo', fallback: { title: 'GenFlix | Privacidade', description: 'Consulte a política de privacidade e proteção de dados da GenFlix.', slug: '/privacidade', image: '' } }}><PrivacyPage /></PublicEditableRoute>,
  },
  {
    path: '/cookies',
    element: <PublicEditableRoute pageKey="cookies" seo={{ entryKey: 'cookies.seo', fallback: { title: 'GenFlix | Cookies', description: 'Entenda como a GenFlix utiliza cookies e tecnologias semelhantes.', slug: '/cookies', image: '' } }}><CookiesPage /></PublicEditableRoute>,
  },
  {
    path: '/termos-de-uso',
    element: <PublicEditableRoute pageKey="terms" seo={{ entryKey: 'terms.seo', fallback: { title: 'GenFlix | Termos de uso', description: 'Leia os termos de uso aplicáveis à plataforma GenFlix.', slug: '/termos-de-uso', image: '' } }}><TermsOfUsePage /></PublicEditableRoute>,
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
          {
            path: '/aluno/notificacoes',
            element: <NotificationPreferencesPage contextLabel="Aluno" />,
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
          {
            path: '/criador/notificacoes',
            element: <NotificationPreferencesPage contextLabel="Criador" />,
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
            path: 'public-page',
            element: <CoursePublicPagePanel />,
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
            path: '/admin/preferencias-notificacoes',
            element: <NotificationPreferencesPage contextLabel="Admin" />,
          },
          {
            path: '/admin/mensagens',
            element: <MessagesPage contextLabel="Admin" />,
          },
          {
            path: '/admin/reviews',
            element: <AdminReviewsPage />,
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
          {
            path: '/admin/configuracoes-site',
            element: <AdminBrandingSettingsPage />,
          },
          {
            path: '/admin/pendencias',
            element: <AdminOperationalPendingPage />,
          },
          {
            path: '/admin/site-editor',
            element: <AdminSiteEditorPage />,
          },
        ],
      },
    ],
  },
])
