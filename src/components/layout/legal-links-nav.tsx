import { Link } from 'react-router-dom'

const LEGAL_LINKS = [
  { to: '/privacidade', label: 'PRIVACIDADE' },
  { to: '/cookies', label: 'COOKIES' },
  { to: '/termos-de-uso', label: 'TERMOS DE USO' },
]

interface LegalLinksNavProps {
  className?: string
  linkClassName?: string
  separatorClassName?: string
}

export function LegalLinksNav({
  className = '',
  linkClassName = '',
  separatorClassName = '',
}: LegalLinksNavProps) {
  return (
    <nav
      aria-label="Links institucionais"
      className={`flex flex-wrap items-center justify-center gap-3 ${className}`.trim()}
    >
      {LEGAL_LINKS.map((item, index) => (
        <div key={item.to} className="flex items-center gap-3">
          {index > 0 ? (
            <span
              aria-hidden="true"
              className={`text-slate-300 ${separatorClassName}`.trim()}
            >
              /
            </span>
          ) : null}
          <Link
            className={`text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 transition-colors hover:text-blue-600 ${linkClassName}`.trim()}
            to={item.to}
          >
            {item.label}
          </Link>
        </div>
      ))}
    </nav>
  )
}
