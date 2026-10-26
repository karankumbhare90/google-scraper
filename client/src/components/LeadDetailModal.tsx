// ─── Lead Detail / Pitch Modal ────────────────────────────────────────────────
import { useState } from 'react'
import {
  X, Phone, MessageCircle, MapPin, Search, Copy, Check,
  Globe, Mail, Trash2, ExternalLink, Building2
} from 'lucide-react'
import type { Lead } from '../types'
import { updateLeadStatus, deleteLead } from '../services/api'

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdated: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}

const PIPELINE_STAGES = ['Pending', 'Emailed', 'Phone / WhatsApp Logged', 'Logged (Dev Mode)', 'Failed']

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value || value === 'N/A' || value === 'No Site') return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function PitchScript(lead: Lead): string {
  const isOpt1 = lead.strategy?.includes('Option 1')
  if (isOpt1) {
    return `Hi ${lead.businessName} team 👋

I noticed your business on Google Maps but couldn't find an official website. In today's market, 80% of customers research businesses online before calling.

At Webnexa Digital, we build fast, mobile-first websites for ${lead.niche} businesses that generate 3x more customer inquiries.

🔹 Custom mobile-responsive website
🔹 Google Maps & Local SEO setup
🔹 WhatsApp & call lead capture

Would you be open to a FREE 2-minute website prototype?

Best,
Karan Kumbhare | Webnexa Digital
https://webnexacms.vercel.app`
  }
  return `Hi ${lead.businessName} team 👋

I visited your website recently while researching top ${lead.niche} businesses in ${lead.city}. Your business is great, but your site could be upgraded to convert more leads.

At Webnexa Digital, we upgrade business websites to modern tech stacks (Next.js, React) with lightning load times and premium UI/UX.

🚀 Modern redesign that wows customers
⚡ Next.js upgrade for instant page loads
📱 Perfect mobile experience + CMS panel

Would you like a quick comparison showing how a modernized site would boost your conversions?

Best,
Karan Kumbhare | Webnexa Digital
https://webnexacms.vercel.app`
}

export function LeadDetailModal({ lead, onClose, onUpdated, onToast }: LeadDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState(lead.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const script = PitchScript(lead)
  const mapsQuery = encodeURIComponent(`${lead.businessName} ${lead.city}`)
  const waMsg = encodeURIComponent(
    `Hi ${lead.businessName} team! I found your business on Google Maps and wanted to reach out about your online presence.`
  )

  async function handleCopy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    onToast('Pitch script copied to clipboard!', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true)
    try {
      await updateLeadStatus(lead.id, newStatus)
      setStatus(newStatus)
      onToast(`Status updated to "${newStatus}"`, 'success')
      onUpdated()
    } catch (err: any) {
      onToast(`Failed to update status: ${err.message}`, 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${lead.businessName}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteLead(lead.id)
      onToast(`"${lead.businessName}" deleted.`, 'success')
      onUpdated()
      onClose()
    } catch (err: any) {
      onToast(`Delete failed: ${err.message}`, 'error')
      setDeleting(false)
    }
  }

  const isOpt1 = lead.strategy?.includes('Option 1')

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 760 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: isOpt1 ? 'var(--orange-dim)' : 'var(--accent-dim)',
              border: `1px solid ${isOpt1 ? 'rgba(255,140,66,0.3)' : 'rgba(99,120,255,0.3)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isOpt1 ? 'var(--orange)' : 'var(--accent)',
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <div className="modal-title">{lead.businessName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.niche} • {lead.city}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {lead.phone && lead.phone !== 'N/A' && (
            <a href={`tel:${lead.phone}`} className="btn btn-green btn-sm">
              <Phone size={13} /> Call
            </a>
          )}
          {lead.whatsappLink && lead.whatsappLink !== 'N/A' && (
            <a
              href={`${lead.whatsappLink}?text=${waMsg}`}
              target="_blank" rel="noreferrer"
              className="btn btn-sm"
              style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          {lead.contactEmail && lead.contactEmail !== 'N/A' && (
            <a href={`mailto:${lead.contactEmail}?subject=${encodeURIComponent(lead.emailSubject)}`} className="btn btn-ghost btn-sm">
              <Mail size={13} /> Email
            </a>
          )}
          <a
            href={`https://www.google.com/maps/search/${mapsQuery}`}
            target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"
          >
            <MapPin size={13} /> Maps Pin
          </a>
          <a
            href={`https://www.google.com/search?q=${mapsQuery}`}
            target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"
          >
            <Search size={13} /> Google Search
          </a>
          {lead.websiteUrl && lead.websiteUrl !== 'No Site' && lead.websiteUrl !== 'N/A' && (
            <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={13} /> Visit Site
            </a>
          )}
        </div>

        <div className="divider" />

        {/* Two-column layout */}
        <div className="modal-grid-2" style={{ gap: 20 }}>
          {/* Left: Business Info */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em' }}>BUSINESS DETAILS</div>
            <InfoRow label="Lead ID" value={lead.id} />
            <InfoRow label="Niche" value={lead.niche} />
            <InfoRow label="City" value={lead.city} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow label="Email" value={lead.contactEmail} />
            <InfoRow label="Website" value={lead.websiteUrl} />
            <InfoRow label="Date Found" value={lead.dateFound} />
            <InfoRow label="Date Contacted" value={lead.dateContacted} />

            {/* Strategy badge */}
            <div style={{ marginTop: 10 }}>
              <span className={`badge ${isOpt1 ? 'badge-orange' : 'badge-accent'}`} style={{ fontSize: 12, padding: '4px 12px' }}>
                {isOpt1 ? '🔨 Strategy: New Website Build' : '✨ Strategy: Modern Site Redesign'}
              </span>
            </div>
          </div>

          {/* Right: Audit Notes */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.08em' }}>AUDIT NOTES</div>
            <div style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px', fontSize: 12,
              color: 'var(--text-secondary)', lineHeight: 1.7, minHeight: 90,
            }}>
              {lead.auditNotes || 'No audit notes available.'}
            </div>

            {/* Pipeline Stage */}
            <div style={{ marginTop: 16 }}>
              <label>Pipeline Stage</label>
              <select
                className="select"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
              >
                {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Pitch Script */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              📋 OUTREACH PITCH SCRIPT
            </div>
            <button className="btn btn-ghost btn-xs" onClick={handleCopy}>
              {copied ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy Script'}
            </button>
          </div>
          <pre style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px', fontSize: 12,
            color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.65,
            maxHeight: 260, overflowY: 'auto', fontFamily: 'inherit',
          }}>
            {script}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between" style={{ marginTop: 20 }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 size={13} />
            {deleting ? 'Deleting…' : 'Delete Lead'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
