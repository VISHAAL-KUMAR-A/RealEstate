import './App.css'
import CityScene from './components/CityScene.jsx'
import Logos from './components/Logos.jsx'

function Stat({ label, value }) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  )
}

function SectionHeading({ title, subtitle }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <h2 className="text-3xl font-bold text-slate-100 sm:text-4xl">{title}</h2>
      <p className="mt-3 text-slate-400">{subtitle}</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="sticky top-0 z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6" style={{backdropFilter:'blur(8px)', background:'rgba(2,6,12,0.35)', borderBottom:'1px solid rgba(148,163,184,0.08)'}}>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" aria-hidden style={{background:'#0ea5e9', boxShadow:'0 0 30px rgba(56,189,248,0.35)'}} />
            <span className="text-sm font-semibold tracking-wide text-slate-200">Atlas REI AI</span>
          </div>
          <div className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-slate-100" style={{textShadow:'0 2px 12px rgba(0,0,0,0.45)'}}>Features</a>
            <a href="#analytics" className="hover:text-slate-100" style={{textShadow:'0 2px 12px rgba(0,0,0,0.45)'}}>Analytics</a>
            <a href="#reports" className="hover:text-slate-100" style={{textShadow:'0 2px 12px rgba(0,0,0,0.45)'}}>Reports</a>
            <a href="#team" className="hover:text-slate-100" style={{textShadow:'0 2px 12px rgba(0,0,0,0.45)'}}>For Engineers</a>
          </div>
          <a href="#cta" className="btn-primary text-sm" style={{padding:'0.55rem 0.95rem'}}>Get Access</a>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="hero-grid-bg relative mx-auto flex min-h-[78vh] max-w-7xl flex-col items-center justify-center px-4 pt-12 text-center sm:px-6 sm:pt-16" style={{textShadow:'0 2px 12px rgba(0,0,0,0.45)'}}>
          <CityScene />
          <h1 className="hero-title text-gradient bg-clip-text text-5xl font-extrabold leading-tight sm:text-6xl">
            Ingest. Analyze. Rank. Invest.
          </h1>
          <p className="hero-subtitle mt-4 max-w-2xl text-base text-slate-300 sm:mt-5 sm:text-lg">
            AI that ingests MLS, off-market, tax, zoning, and lien data to surface undervalued assets, forecast yield, and automate underwriting.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <a href="#cta" className="btn-primary">Request Early Access</a>
            <a href="#features" className="btn-secondary">See How It Works</a>
          </div>
          <Logos />
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16" style={{background:'linear-gradient(180deg,#05080f 0%, #070b12 100%)', borderTop:'1px solid rgba(148,163,184,0.08)', borderBottom:'1px solid rgba(148,163,184,0.06)'}}>
          <SectionHeading title="A full-stack ingestion and intelligence engine" subtitle="From raw data to ranked deals and automated reports" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="badge" />
                <div className="text-sm font-semibold text-slate-100">Data Intake</div>
              </div>
              <p className="mt-2 text-sm text-slate-400">MLS, off-market, tax, zoning, code violations, foreclosures, liens.</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="badge" />
                <div className="text-sm font-semibold text-slate-100">Underwriting</div>
              </div>
              <p className="mt-2 text-sm text-slate-400">NOI, Cap Rate, RRR, Cash-on-Cash with sensitivity scenarios.</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="badge" />
                <div className="text-sm font-semibold text-slate-100">Forecasting</div>
              </div>
              <p className="mt-2 text-sm text-slate-400">Economic and migration trends to project rent growth and yield.</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="badge" />
                <div className="text-sm font-semibold text-slate-100">Risk & Arbitrage</div>
              </div>
              <p className="mt-2 text-sm text-slate-400">Distress detection and zoning/upzoning arbitrage potential.</p>
            </div>
          </div>
        </section>

        <section id="analytics" className="mx-auto max-w-7xl px-4 pb-10 sm:px-6" style={{background:'linear-gradient(180deg,#070b12 0%, #090e18 100%)', borderTop:'1px solid rgba(148,163,184,0.06)', borderBottom:'1px solid rgba(148,163,184,0.06)'}}>
          <SectionHeading title="Underwriting metrics at a glance" subtitle="Audit-ready analytics to move from lead to LOI fast" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="metric"><div className="text-xs uppercase tracking-wider text-slate-400">NOI</div><div className="text-2xl font-semibold text-slate-100">$1.25M</div></div>
            <div className="metric"><div className="text-xs uppercase tracking-wider text-slate-400">Cap Rate</div><div className="text-2xl font-semibold text-slate-100">6.8%</div></div>
            <div className="metric"><div className="text-xs uppercase tracking-wider text-slate-400">RRR</div><div className="text-2xl font-semibold text-slate-100">14%</div></div>
            <div className="metric"><div className="text-xs uppercase tracking-wider text-slate-400">Cash-on-Cash</div><div className="text-2xl font-semibold text-slate-100">18%</div></div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <div className="text-sm font-semibold text-slate-100">Deal Ranking</div>
              <p className="mt-2 text-sm text-slate-400">Score opportunities by profitability, risk, and timeline using a composite signal model.</p>
            </div>
            <div className="card">
              <div className="text-sm font-semibold text-slate-100">Daily Briefing</div>
              <p className="mt-2 text-sm text-slate-400">Automated investor reports delivered every morning with top movers and new mispricings.</p>
            </div>
          </div>
        </section>

        <section id="cta" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16" style={{background:'linear-gradient(180deg,#090e18 0%, #0b1220 100%)', borderTop:'1px solid rgba(148,163,184,0.06)'}}>
          <div className="card" style={{borderRadius:'1.25rem', padding:'2rem'}}>
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-2xl font-bold text-slate-100">Built for serious AI engineers</h3>
                <p className="mt-2 text-slate-400">Help us build the foundational AI product for real estate. Ship ingestion, ranking models, and internal dashboards at scale.</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li>— High-volume pipelines and feature stores</li>
                  <li>— Forecasting and risk signal models</li>
                  <li>— Dashboards and investor-grade reporting</li>
                </ul>
              </div>
              <form className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="input" placeholder="Name" />
                  <input className="input" placeholder="Email" type="email" />
                </div>
                <input className="input" placeholder="LinkedIn or GitHub" />
                <button type="button" className="btn-primary w-full">Request Invite</button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto max-w-7xl px-6 pb-10">
        <div className="border-t border-slate-800 pt-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} Atlas REI AI</div>
      </footer>
    </div>
  )
}
