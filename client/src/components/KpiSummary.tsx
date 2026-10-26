// ─── KPI Summary Cards ────────────────────────────────────────────────────────
import { Users, Globe, Mail, Phone, Target } from 'lucide-react'
import type { Stats } from '../types'

interface KpiSummaryProps {
  stats: Stats | null
  loading: boolean
}

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: number | string
  sub?: string
  color: string
  loading: boolean
}

function KpiCard({ icon, label, value, sub, color, loading }: KpiCardProps) {
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: -24, right: -24, width: 80, height: 80,
        borderRadius: '50%', background: color, opacity: 0.12, filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />
      <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${color}22`, border: `1px solid ${color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      {loading ? (
        <div style={{
          height: 28, borderRadius: 6,
          background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
        }} />
      ) : (
        <>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
        </>
      )}
    </div>
  )
}

export function KpiSummary({ stats, loading }: KpiSummaryProps) {
  return (
    <div className="kpi-grid">
      <KpiCard
        icon={<Users size={16} />}
        label="Total Leads"
        value={stats?.total ?? 0}
        sub="All time prospects"
        color="var(--accent)"
        loading={loading}
      />
      <KpiCard
        icon={<Mail size={16} />}
        label="With Email"
        value={stats?.withEmail ?? 0}
        sub="Ready for outreach"
        color="var(--green)"
        loading={loading}
      />
      <KpiCard
        icon={<Globe size={16} />}
        label="No Website"
        value={stats?.missingWebsite ?? 0}
        sub="Prime targets"
        color="var(--orange)"
        loading={loading}
      />
      <KpiCard
        icon={<Target size={16} />}
        label="Has Website"
        value={stats?.hasWebsite ?? 0}
        sub="Redesign candidates"
        color="var(--yellow)"
        loading={loading}
      />
      <KpiCard
        icon={<Phone size={16} />}
        label="Contacted"
        value={stats?.contacted ?? 0}
        sub="Emailed this session"
        color="#a78bfa"
        loading={loading}
      />
    </div>
  )
}
