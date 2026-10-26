// ─── Leads Table ─────────────────────────────────────────────────────────────
import { ExternalLink, MessageCircle, Phone, Globe, Mail, Eye } from 'lucide-react'
import type { Lead } from '../types'

interface LeadsTableProps {
  leads: Lead[]
  loading: boolean
  onPitch: (lead: Lead) => void
}

function WebsiteCell({ lead }: { lead: Lead }) {
  if (!lead.websiteUrl || lead.websiteUrl === 'No Site' || lead.websiteUrl === 'N/A') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="badge badge-red" style={{ alignSelf: 'flex-start' }}>NO WEBSITE</span>
        <a
          href={`https://www.google.com/maps/search/${encodeURIComponent(lead.businessName + ' ' + lead.city)}`}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
        >
          <ExternalLink size={10} />Maps Search
        </a>
      </div>
    )
  }
  const domain = (() => { try { return new URL(lead.websiteUrl).hostname.replace('www.', '') } catch { return lead.websiteUrl } })()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="badge badge-green" style={{ alignSelf: 'flex-start' }}>ACTIVE SITE</span>
      <a href={lead.websiteUrl} target="_blank" rel="noreferrer"
        style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
        title={lead.websiteUrl}
      >
        <Globe size={10} />{domain}
      </a>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Pending': 'badge-muted',
    'Emailed': 'badge-accent',
    'Phone / WhatsApp Logged': 'badge-green',
    'Logged (Dev Mode)': 'badge-yellow',
    'Failed': 'badge-red',
  }
  return <span className={`badge ${map[status] ?? 'badge-muted'}`}>{status}</span>
}

function StrategyBadge({ strategy }: { strategy: string }) {
  const isOpt1 = strategy?.includes('Option 1')
  return (
    <span className={`badge ${isOpt1 ? 'badge-orange' : 'badge-accent'}`} style={{ fontSize: 10 }}>
      {isOpt1 ? '🔨 New Build' : '✨ Redesign'}
    </span>
  )
}

const SKELETON_ROWS = 6

export function LeadsTable({ leads, loading, onPitch }: LeadsTableProps) {
  if (loading) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['Business', 'Niche', 'City', 'Contact', 'Website', 'Status', 'Strategy', ''].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j}>
                    <div style={{
                      height: 14, borderRadius: 4, background: 'var(--bg-elevated)',
                      width: j === 0 ? '70%' : j === 7 ? '60px' : '80%',
                      animation: 'shimmer 1.4s infinite',
                      backgroundImage: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
                      backgroundSize: '200% 100%',
                    }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="card empty-state">
        <div style={{ fontSize: 52 }}>🔍</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>No leads found</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
          Launch a new search job to discover real local business leads from Google Maps.
        </div>
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Business</th>
            <th>Niche</th>
            <th>City</th>
            <th>Contact</th>
            <th>Website</th>
            <th>Status</th>
            <th>Strategy</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              {/* Business Name */}
              <td style={{ maxWidth: 200 }}>
                <div className="truncate" style={{ fontWeight: 600, fontSize: 13 }} title={lead.businessName}>
                  {lead.businessName}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{lead.id}</div>
              </td>

              {/* Niche */}
              <td style={{ maxWidth: 160 }}>
                <span className="truncate" style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }} title={lead.niche}>
                  {lead.niche}
                </span>
              </td>

              {/* City */}
              <td style={{ maxWidth: 140 }}>
                <span className="truncate" style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }} title={lead.city}>
                  {lead.city}
                </span>
              </td>

              {/* Contact */}
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lead.contactEmail && lead.contactEmail !== 'N/A' ? (
                    <a href={`mailto:${lead.contactEmail}`} style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                      <Mail size={11} />
                      <span className="truncate" style={{ maxWidth: 130 }} title={lead.contactEmail}>{lead.contactEmail}</span>
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No email</span>
                  )}
                  {lead.phone && lead.phone !== 'N/A' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={`tel:${lead.phone}`} style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>
                        <Phone size={10} />{lead.phone}
                      </a>
                      {lead.whatsappLink && lead.whatsappLink !== 'N/A' && (
                        <a href={lead.whatsappLink} target="_blank" rel="noreferrer" style={{ color: '#25d366', display: 'flex', alignItems: 'center' }} title="WhatsApp">
                          <MessageCircle size={12} />
                        </a>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No phone</span>
                  )}
                </div>
              </td>

              {/* Website */}
              <td><WebsiteCell lead={lead} /></td>

              {/* Status */}
              <td><StatusBadge status={lead.status} /></td>

              {/* Strategy */}
              <td><StrategyBadge strategy={lead.strategy} /></td>

              {/* Action */}
              <td style={{ textAlign: 'right' }}>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={() => onPitch(lead)}
                  title="Open full client dossier"
                >
                  <Eye size={11} /> Pitch
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
