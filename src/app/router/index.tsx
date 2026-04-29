import { Navigate, createBrowserRouter } from 'react-router-dom'
import { Suspense, lazy, type ReactNode } from 'react'

import { AdminLayout } from '@/app/layouts/admin-layout'
import { AdminCourseBuilderLayout } from '@/app/layouts/admin-course-builder-layout'
import { CreatorLayout } from '@/app/layouts/creator-layout'
import { StudentLayout } from '@/app/layouts/student-layout'
import { ProtectedRoute } from '@/app/router/protected-route'
import { MessagesPage } from '@/pages/shared/messages-page'
import { MessagesRedirectPage } from '@/pages/shared/messages-redirect-page'
import { EditablePageSeo } from '@/features/site-editor/editable-page-seo'
import { EditableControlsHintPanel, SiteContentScope, VisualEditorProvider } from '@/features/site-editor/visual-editor'
import type { SitePageKey } from '@/features/site-editor/types'

const PublicHomePage = lazy(async () => ({ default: (await import('@/pages/public/public-home-page')).PublicHomePage }))
const PublicCoursesPage = lazy(async () => ({ default: (await import('@/pages/public/public-courses-page')).PublicCoursesPage }))
const PublicCourseDetailsPage = lazy(async () => ({ default: (await import('@/pages/public/public-course-details-page')).PublicCourseDetailsPage }))
const PublicAboutPage = lazy(async () => ({ default: (await import('@/pages/public/public-about-page')).PublicAboutPage }))
const PublicBlogPage = lazy(async () => ({ default: (await import('@/pages/public/public-blog-page')).PublicBlogPage }))
const PublicBlogPostPage = lazy(async () => ({ default: (await import('@/pages/public/public-blog-post-page')).PublicBlogPostPage }))
const PublicCommunityPage = lazy(async () => ({ default: (await import('@/pages/public/public-community-page')).PublicCommunityPage }))
const PublicContactPage = lazy(async () => ({ default: (await import('@/pages/public/public-contact-page')).PublicContactPage }))
const PublicResourcesPage = lazy(async () => ({ default: (await import('@/pages/public/public-resources-page')).PublicResourcesPage }))
const PublicSupportPage = lazy(async () => ({ default: (await import('@/pages/public/public-support-page')).PublicSupportPage }))
const PublicRefundPolicyPage = lazy(async () => ({ default: (await import('@/pages/public/public-refund-policy-page')).PublicRefundPolicyPage }))
const PublicHelpPage = lazy(async () => ({ default: (await import('@/pages/public/public-help-page')).PublicHelpPage }))
const PublicReferPage = lazy(async () => ({ default: (await import('@/pages/public/public-refer-page')).PublicReferPage }))
const PublicTeachPage = lazy(async () => ({ default: (await import('@/pages/public/public-teach-page')).PublicTeachPage }))
const LoginPage = lazy(async () => ({ default: (await import('@/pages/public/login-page')).LoginPage }))
const AuthCallbackPage = lazy(async () => ({ default: (await import('@/pages/public/auth-callback-page')).AuthCallbackPage }))
const SignUpPage = lazy(async () => ({ default: (await import('@/pages/public/sign-up-page')).SignUpPage }))
const ForgotPasswordPage = lazy(async () => ({ default: (await import('@/pages/public/forgot-password-page')).ForgotPasswordPage }))
const ResetPasswordPage = lazy(async () => ({ default: (await import('@/pages/public/reset-password-page')).ResetPasswordPage }))
const UnauthorizedPage = lazy(async () => ({ default: (await import('@/pages/public/unauthorized-page')).UnauthorizedPage }))
const PrivacyPage = lazy(async () => ({ default: (await import('@/pages/public/privacy-page')).PrivacyPage }))
const CookiesPage = lazy(async () => ({ default: (await import('@/pages/public/cookies-page')).CookiesPage }))
const TermsOfUsePage = lazy(async () => ({ default: (await import('@/pages/public/terms-of-use-page')).TermsOfUsePage }))
const StudentDashboardPage = lazy(async () => ({ default: (await import('@/pages/student/student-dashboard-page')).StudentDashboardPage }))
const StudentCoursesPage = lazy(async () => ({ default: (await import('@/pages/student/student-courses-page')).StudentCoursesPage }))
const StudentCourseDetailsPage = lazy(async () => ({ default: (await import('@/pages/student/student-course-details-page')).StudentCourseDetailsPage }))
const StudentAccountPage = lazy(async () => ({ default: (await import('@/pages/student/student-account-page')).StudentAccountPage }))
const StudentSupportTicketsPage = lazy(async () => ({ default: (await import('@/pages/student/student-support-tickets-page')).StudentSupportTicketsPage }))
const CreatorSupportTicketsPage = lazy(async () => ({ default: (await import('@/pages/creator/creator-support-tickets-page')).CreatorSupportTicketsPage }))
const CreatorNotificationsPage = lazy(async () => ({ default: (await import('@/pages/creator/creator-notifications-page')).CreatorNotificationsPage }))
const StudentCoursePlayerLayout = lazy(async () => ({ default: (await import('@/pages/student/student-course-player-layout')).StudentCoursePlayerLayout }))
const StudentLessonPage = lazy(async () => ({ default: (await import('@/pages/student/student-lesson-page')).StudentLessonPage }))
const StudentAssessmentExecutionPage = lazy(async () => ({ default: (await import('@/pages/student/student-assessment-execution-page')).StudentAssessmentExecutionPage }))
const CreatorReportsPage = lazy(async () => ({ default: (await import('@/pages/creator/creator-reports-page')).CreatorReportsPage }))
const CreatorProfilePage = lazy(async () => ({ default: (await import('@/pages/creator/creator-profile-page')).CreatorProfilePage }))
const AdminDashboardPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-dashboard-page')).AdminDashboardPage }))
const AdminCoursesPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-courses-page')).AdminCoursesPage }))
const AdminModulesPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-modules-page')).AdminModulesPage }))
const AdminCourseReleasesPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-course-releases-page')).AdminCourseReleasesPage }))
const AdminLessonsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-lessons-page')).AdminLessonsPage }))
const AdminMaterialsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-materials-page')).AdminMaterialsPage }))
const AdminGroupsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-groups-page')).AdminGroupsPage }))
const AdminUsersPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-users-page')).AdminUsersPage }))
const AdminAccountPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-account-page')).AdminAccountPage }))
const AdminButtonTemplatesPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-button-templates-page')).AdminButtonTemplatesPage }))
const AdminReportsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-reports-page')).AdminReportsPage }))
const AdminPublicFormsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-public-forms-page')).AdminPublicFormsPage }))
const AdminNotificationsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-notifications-page')).AdminNotificationsPage }))
const AdminSupportTicketsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-support-tickets-page')).AdminSupportTicketsPage }))
const AdminSupportFaqPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-support-faq-page')).AdminSupportFaqPage }))
const AdminReviewsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-reviews-page')).AdminReviewsPage }))
const AdminPaymentSettingsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-payment-settings-page')).AdminPaymentSettingsPage }))
const AdminCreatorPayoutsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-creator-payouts-page')).AdminCreatorPayoutsPage }))
const AdminQuizTypesPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-quiz-types-page')).AdminQuizTypesPage }))
const AdminBannersPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-banners-page')).AdminBannersPage }))
const AdminBrandingSettingsPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-branding-settings-page')).AdminBrandingSettingsPage }))
const AdminOperationalPendingPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-operational-pending-page')).AdminOperationalPendingPage }))
const AdminSiteEditorPage = lazy(async () => ({ default: (await import('@/pages/admin/admin-site-editor-page')).AdminSiteEditorPage }))
const CourseOverviewPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/course-overview-panel')).CourseOverviewPanel }))
const ModuleEditorPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/module-editor-panel')).ModuleEditorPanel }))
const LessonEditorPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/lesson-editor-panel')).LessonEditorPanel }))
const LessonMaterialsPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/lesson-materials-panel')).LessonMaterialsPanel }))
const AssessmentBuilderPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/assessment-builder-panel')).AssessmentBuilderPanel }))
const CoursePublicPagePanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/course-public-page-panel')).CoursePublicPagePanel }))
const CourseSettingsPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/course-settings-panel')).CourseSettingsPanel }))
const CourseAssessmentsPanel = lazy(async () => ({ default: (await import('@/pages/admin/builder/course-assessments-panel')).CourseAssessmentsPanel }))
const SupportTicketDetailPage = lazy(async () => ({ default: (await import('@/pages/shared/support-ticket-detail-page')).SupportTicketDetailPage }))

function withRouteSuspense(children: ReactNode) {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-[320px] items-center justify-center bg-[#F2F7F9] px-6 py-10 text-sm font-bold text-[#5F7077]">
          Carregando pagina...
        </div>
      )}
    >
      {children}
    </Suspense>
  )
}

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
        <EditableControlsHintPanel />
        {seo ? <EditablePageSeo pageKey={pageKey} entryKey={seo.entryKey} fallback={seo.fallback} label={seo.label} /> : null}
        {withRouteSuspense(children)}
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
    path: '/suporte',
    element: withRouteSuspense(<PublicSupportPage />),
  },
  {
    path: '/politica-de-reembolso',
    element: <PublicEditableRoute pageKey="global" seo={{ entryKey: 'global.refund.seo', fallback: { title: 'GenFlix | Política de reembolso', description: 'Entenda as diretrizes de reembolso e cancelamento aplicadas aos serviços e conteúdos da GenFlix.', slug: '/politica-de-reembolso', image: '' } }}><PublicRefundPolicyPage /></PublicEditableRoute>,
  },
  {
    path: '/perguntas-frequentes',
    element: <Navigate to="/suporte#perguntas-frequentes" replace />,
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
            element: withRouteSuspense(<StudentDashboardPage />),
          },
          {
            path: '/aluno/cursos',
            element: withRouteSuspense(<StudentCoursesPage />),
          },
          {
            path: '/aluno/cursos/:courseId',
            element: withRouteSuspense(<StudentCourseDetailsPage />),
          },
          {
            path: '/aluno/minha-conta',
            element: withRouteSuspense(<StudentAccountPage />),
          },
          {
            path: '/aluno/suporte',
            element: withRouteSuspense(<StudentSupportTicketsPage />),
          },
          {
            path: '/aluno/suporte/:ticketId',
            element: withRouteSuspense(<SupportTicketDetailPage />),
          },
          {
            path: '/aluno/mensagens',
            element: <MessagesPage contextLabel="Aluno" />,
          },
          {
            path: '/aluno/notificacoes',
            element: <Navigate to="/aluno/dashboard?tab=notificacoes" replace />,
          },
        ],
      },
      {
        path: '/aluno/cursos/:courseId/player',
        element: withRouteSuspense(<StudentCoursePlayerLayout />),
        children: [
          {
            path: 'aulas/:lessonId',
            element: withRouteSuspense(<StudentLessonPage />),
          },
          {
            path: 'avaliacoes/:assessmentId',
            element: withRouteSuspense(<StudentAssessmentExecutionPage />),
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
            element: withRouteSuspense(<CreatorReportsPage />),
          },
          {
            path: '/criador/perfil',
            element: withRouteSuspense(<CreatorProfilePage />),
          },
          {
            path: '/criador/mensagens',
            element: <MessagesPage contextLabel="Criador" />,
          },
          {
            path: '/criador/suporte',
            element: withRouteSuspense(<CreatorSupportTicketsPage />),
          },
          {
            path: '/criador/notificacoes',
            element: withRouteSuspense(<CreatorNotificationsPage />),
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
            element: withRouteSuspense(<CourseOverviewPanel />),
          },
          {
            path: 'modulos/:moduleId',
            element: withRouteSuspense(<ModuleEditorPanel />),
          },
          {
            path: 'modulos/:moduleId/aulas/:lessonId',
            element: withRouteSuspense(<LessonEditorPanel />),
          },
          {
            path: 'modulos/:moduleId/aulas/:lessonId/materiais',
            element: withRouteSuspense(<LessonMaterialsPanel />),
          },
          {
            path: 'modulos/:moduleId/avaliacoes/:assessmentId',
            element: withRouteSuspense(<AssessmentBuilderPanel />),
          },
          {
            path: 'assessments/final',
            element: withRouteSuspense(<AssessmentBuilderPanel />),
          },
          {
            path: 'public-page',
            element: withRouteSuspense(<CoursePublicPagePanel />),
          },
          {
            path: 'settings',
            element: withRouteSuspense(<CourseSettingsPanel />),
          },
          {
            path: 'releases',
            element: withRouteSuspense(<AdminCourseReleasesPage />),
          },
          {
            path: 'assessments',
            element: withRouteSuspense(<CourseAssessmentsPanel />),
          },
        ]
      },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: withRouteSuspense(<AdminDashboardPage />),
          },
          {
            path: '/admin/cursos',
            element: withRouteSuspense(<AdminCoursesPage />),
          },
          {
            path: '/admin/cursos/:courseId/modulos',
            element: withRouteSuspense(<AdminModulesPage />),
          },
          {
            path: '/admin/cursos/:courseId/liberacoes',
            element: withRouteSuspense(<AdminCourseReleasesPage />),
          },
          {
            path: '/admin/modulos/:moduleId/aulas',
            element: withRouteSuspense(<AdminLessonsPage />),
          },
          {
            path: '/admin/aulas/:lessonId/materiais',
            element: withRouteSuspense(<AdminMaterialsPage />),
          },
          {
            path: '/admin/grupos',
            element: withRouteSuspense(<AdminGroupsPage />),
          },
          {
            path: '/admin/alunos',
            element: <Navigate to="/admin/usuarios" replace />,
          },
          {
            path: '/admin/usuarios',
            element: withRouteSuspense(<AdminUsersPage />),
          },
          {
            path: '/admin/minha-conta',
            element: withRouteSuspense(<AdminAccountPage />),
          },
          {
            path: '/admin/botoes-aula',
            element: withRouteSuspense(<AdminButtonTemplatesPage />),
          },
          {
            path: '/admin/relatorios',
            element: withRouteSuspense(<AdminReportsPage />),
          },
          {
            path: '/admin/formularios',
            element: withRouteSuspense(<AdminPublicFormsPage />),
          },
          {
            path: '/admin/notificacoes',
            element: withRouteSuspense(<AdminNotificationsPage />),
          },
          {
            path: '/admin/preferencias-notificacoes',
            element: <Navigate to="/admin/notificacoes" replace />,
          },
          {
            path: '/admin/mensagens',
            element: <MessagesPage contextLabel="Admin" />,
          },
          {
            path: '/admin/suporte',
            element: withRouteSuspense(<AdminSupportTicketsPage />),
          },
          {
            path: '/admin/faq',
            element: withRouteSuspense(<AdminSupportFaqPage />),
          },
          {
            path: '/admin/suporte/faq',
            element: <Navigate to="/admin/faq" replace />,
          },
          {
            path: '/admin/suporte/:ticketId',
            element: withRouteSuspense(<SupportTicketDetailPage />),
          },
          {
            path: '/admin/reviews',
            element: withRouteSuspense(<AdminReviewsPage />),
          },
          {
            path: '/admin/pagamentos',
            element: withRouteSuspense(<AdminPaymentSettingsPage />),
          },
          {
            path: '/admin/repasses',
            element: withRouteSuspense(<AdminCreatorPayoutsPage />),
          },
          {
            path: '/admin/pagamento',
            element: <Navigate to="/admin/pagamentos" replace />,
          },
          {
            path: '/admin/tipos-quiz',
            element: withRouteSuspense(<AdminQuizTypesPage />),
          },
          {
            path: '/admin/banners',
            element: withRouteSuspense(<AdminBannersPage />),
          },
          {
            path: '/admin/configuracoes-site',
            element: withRouteSuspense(<AdminBrandingSettingsPage />),
          },
          {
            path: '/admin/pendencias',
            element: withRouteSuspense(<AdminOperationalPendingPage />),
          },
          {
            path: '/admin/site-editor',
            element: withRouteSuspense(<AdminSiteEditorPage />),
          },
        ],
      },
    ],
  },
])
