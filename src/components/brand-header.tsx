import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link href="/" className="brand-mark" aria-label="Voltar para inicio">
          <svg viewBox="0 0 64 64" role="img" aria-hidden="true" className="brand-mark__svg">
            <defs>
              <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#brand-gradient)" />
            <circle cx="24" cy="24" r="7" fill="#ffffff" fillOpacity="0.94" />
            <circle cx="39" cy="32" r="10" fill="#ffffff" fillOpacity="0.84" />
            <path d="M17 40C22 48 33 50 43 45" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div>
            <p className="brand-mark__title">Indicacao</p>
            <p className="brand-mark__subtitle">Plataforma de atendimento</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
