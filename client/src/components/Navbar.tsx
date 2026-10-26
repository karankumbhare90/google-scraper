// ─── Navbar Component ─────────────────────────────────────────────────────────
import { Zap, Plus, RefreshCw, Play, Loader2, Database } from 'lucide-react'
import type { AgentStatus } from '../types'

interface NavbarProps {
  onNewJob: () => void
  onRefresh: () => void
  isRefreshing: boolean
  agentOnline: boolean
  agentStatus: AgentStatus | null
  onAutoRunToggle: (enabled: boolean) => void
  onRunNow: () => void
  isRunningNow: boolean
}

export function Navbar({
  onNewJob, onRefresh, isRefreshing, agentOnline,
  agentStatus, onAutoRunToggle, onRunNow, isRunningNow,
}: NavbarProps) {
  return (
    <nav className="navbar-wrap">

      {/* Brand */}
      <div className="navbar-brand">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px var(--accent-glow)', flexShrink: 0,
        }}>
          <Zap size={18} color="#fff" fill="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Lead<span style={{ color: 'var(--accent)' }}>Pulse</span>
          </div>
          <div className="navbar-brand-tag" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>
            AGENCY EDITION
          </div>
        </div>
      </div>

      {/* Center status cluster */}
      <div className="navbar-center">

        {/* Backend online status */}
        <div className="status-chip" style={{ color: agentOnline ? 'var(--green)' : 'var(--red)' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
            background: agentOnline ? 'var(--green)' : 'var(--red)',
            boxShadow: agentOnline ? '0 0 6px rgba(34,211,165,0.7)' : 'none',
            animation: agentOnline ? 'pulse 1.6s ease-in-out infinite' : 'none',
          }} />
          <span>{agentOnline ? 'Backend Online' : 'Backend Offline'}</span>
        </div>

        {/* DB status */}
        {agentStatus && (
          <div className="status-chip" style={{ color: agentStatus.dbConnected ? 'var(--green)' : 'var(--orange)' }}>
            <Database size={12} />
            <span>{agentStatus.dbConnected ? 'MongoDB Connected' : 'DB Offline'}</span>
          </div>
        )}

        {/* Auto-run toggle */}
        {agentOnline && (
          <div className="status-chip" style={{ padding: '3px 10px' }}>
            <label
              htmlFor="auto-run-toggle"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 11, color: 'var(--text-secondary)',
                cursor: 'pointer', userSelect: 'none', margin: 0, textTransform: 'none',
              }}
            >
              {/* Toggle switch */}
              <div style={{ position: 'relative', width: 34, height: 18, flexShrink: 0 }}>
                <input
                  id="auto-run-toggle"
                  type="checkbox"
                  checked={agentStatus?.autoRun ?? false}
                  onChange={(e) => onAutoRunToggle(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <div
                  onClick={() => onAutoRunToggle(!(agentStatus?.autoRun ?? false))}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 99,
                    background: agentStatus?.autoRun ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: `1px solid ${agentStatus?.autoRun ? 'var(--accent)' : 'var(--border-bright)'}`,
                    transition: 'all 0.2s ease', cursor: 'pointer',
                    boxShadow: agentStatus?.autoRun ? '0 0 8px var(--accent-glow)' : 'none',
                  }}
                />
                <div style={{
                  position: 'absolute', top: 2, left: agentStatus?.autoRun ? 18 : 2,
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s ease',
                  pointerEvents: 'none',
                }} />
              </div>
              <span>
                Auto-Run{' '}
                <strong style={{ color: agentStatus?.autoRun ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {agentStatus?.autoRun ? `ON (${agentStatus.intervalMinutes}m)` : 'OFF'}
                </strong>
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="navbar-actions">
        {/* Run Now button */}
        {agentOnline && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onRunNow}
            disabled={isRunningNow}
            title="Trigger one scrape cycle immediately"
            id="run-now-btn"
          >
            {isRunningNow
              ? <Loader2 size={13} className="spin" />
              : <Play size={13} color="var(--green)" />
            }
            <span className="btn-label-desktop">{isRunningNow ? 'Running…' : 'Run Now'}</span>
          </button>
        )}

        <button
          className="btn btn-ghost btn-sm"
          onClick={onRefresh}
          title="Refresh leads"
        >
          <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
          <span className="btn-label-desktop">Refresh</span>
        </button>

        <button className="btn btn-primary btn-sm" onClick={onNewJob} id="new-job-btn">
          <Plus size={14} />
          <span>New Job</span>
        </button>
      </div>
    </nav>
  )
}
