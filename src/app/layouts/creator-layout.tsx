import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { ImpersonationBanner } from '@/components/auth/impersonation-banner';
import { PlatformFooter } from '@/components/layout/platform-footer';
import { GenflixLogo } from '@/components/public/genflix-logo';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/features/notifications/notification-center';
const creatorLinks = [
    { to: '/criador/relatorios', label: 'Meus relatórios', description: 'Vendas e cancelamentos' },
    { to: '/criador/mensagens', label: 'Mensagens', description: 'Conversas com usuários' },
    { to: '/criador/suporte', label: 'Tickets', description: 'Chamados e atendimento' },
    { to: '/criador/notificacoes', label: 'Notificações', description: 'Canais e preferências' },
    { to: '/criador/perfil', label: 'Minha conta', description: 'Dados da conta' },
];
function getCreatorDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
    if (fullName?.trim()) {
        return fullName.trim();
    }
    if (email?.trim()) {
        return email.split('@')[0];
    }
    return 'Criador';
}
function CreatorAvatar({ avatarUrl, fallback, className, }: {
    avatarUrl: string | null | undefined;
    fallback: string;
    className: string;
}) {
    if (avatarUrl?.trim()) {
        return (<img src={avatarUrl} alt="Avatar do criador" className={`${className} object-cover`}/>);
    }
    return (<div className={`${className} bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-white`}>
      {fallback}
    </div>);
}
export function CreatorLayout() {
    const { profile, signOut } = useAuth();
    const location = useLocation();
    const displayName = getCreatorDisplayName(profile?.full_name, profile?.email);
    const initials = displayName
        .split(' ')
        .slice(0, 2)
        .map((namePart) => namePart[0])
        .join('')
        .toUpperCase();
    return (<main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <ImpersonationBanner />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A3640] backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Ir para a home da GenFlix">
              <GenflixLogo theme="dark" />
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Painel do Criador</p>
              <h1 className="font-readex text-xl font-semibold tracking-tight text-white">GenFlix</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter compact/>
            <div className="hidden items-center gap-3 rounded-full border border-[#D8E6EB] bg-white px-2 py-1.5 shadow-sm md:flex">
              <CreatorAvatar avatarUrl={profile?.avatar_url} fallback={initials || 'CR'} className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black"/>
              <div className="pr-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Criador</p>
                <p className="max-w-[220px] truncate text-sm font-semibold text-[#163138]">{displayName}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void signOut()} className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]">
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start lg:sticky lg:top-[92px]">
          <div className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_20px_50px_rgba(22,49,56,0.05)]">
            <div className="border-b border-[#D8E6EB] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Navegação</p>
              <h2 className="mt-1 font-readex text-lg font-semibold tracking-tight text-[#15323b]">Criador</h2>
            </div>
            <nav className="space-y-2 p-3">
              {creatorLinks.map((link) => {
            const isActive = location.pathname.startsWith(link.to);
            return (<Link key={link.to} to={link.to} className={`block rounded-2xl px-4 py-3 transition-all ${isActive
                    ? 'bg-[#1398B7] text-white shadow-lg shadow-[#1398B7]/20'
                    : 'text-[#5f7077] hover:bg-[#F2F7F9] hover:text-[#163138]'}`}>
                    <span className="block text-sm font-black">{link.label}</span>
                    <span className={`block text-[11px] font-medium ${isActive ? 'text-white/80' : 'text-[#5F7077]'}`}>
                      {link.description}
                    </span>
                  </Link>);
        })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
            <Outlet />
          </section>
          <PlatformFooter className="rounded-[28px] border border-[#D8E6EB] bg-white px-5 py-5 shadow-sm" linksClassName="text-[#5F7077]" versionClassName="text-[#5F7077]" compact/>
        </div>
      </div>
    </main>);
}
