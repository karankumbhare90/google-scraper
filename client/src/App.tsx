// ─── App – Core State Controller & Layout Orchestrator ────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react'
import './index.css'

import type { Lead, Stats, Toast, AgentStatus } from './types'
import {
  fetchLeads,
  fetchStats,
  fetchAgentStatus,
  setAutoRun,
  runNow,
  deleteLead,
  batchDeleteLeads,
} from './services/api'

import { Navbar }           from './components/Navbar'
import { KpiSummary }       from './components/KpiSummary'
import { FiltersBar }       from './components/FiltersBar'
import { LeadsTable }       from './components/LeadsTable'
import { CreateJobModal }   from './components/CreateJobModal'
import { LeadDetailModal }  from './components/LeadDetailModal'
import { ToastStack }       from './components/ToastStack'

let toastSeq = 0

export default function App() {
  /* ── State ──────────────────────────────────────────────────────────────── */
  const [leads, setLeads]               = useState<Lead[]>([])
  const [stats, setStats]               = useState<Stats | null>(null)
  const [agentStatus, setAgentStatus]   = useState<AgentStatus | null>(null)
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [agentOnline, setAgentOnline]   = useState(false)
  const [isRunningNow, setIsRunningNow] = useState(false)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [strategyFilter, setStrategyFilter] = useState('All')

  const [showJobModal, setShowJobModal]     = useState(false)
  const [selectedLead, setSelectedLead]     = useState<Lead | null>(null)
  const [toasts, setToasts]                 = useState<Toast[]>([])

  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [selectedIds, setSelectedIds]       = useState<string[]>([])
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)

  /* ── Toast helper ────────────────────────────────────────────────────────── */
  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = `toast-${++toastSeq}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  /* ── Data loading ────────────────────────────────────────────────────────── */
  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const [leadsRes, statsRes, agentRes] = await Promise.all([
        fetchLeads(),
        fetchStats(),
        fetchAgentStatus(),
      ])
      setLeads(leadsRes.leads)
      setStats(statsRes.stats)
      setAgentStatus({ autoRun: agentRes.autoRun, intervalMinutes: agentRes.intervalMinutes, dbConnected: agentRes.dbConnected })
      setAgentOnline(true)
    } catch {
      setAgentOnline(false)
      if (!quiet) addToast('Cannot reach backend. Is dashboard.ts running on port 4200?', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addToast])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => loadData(true), 30_000)
    return () => clearInterval(id)
  }, [loadData])

  /* ── Auto-run toggle ─────────────────────────────────────────────────────── */
  const handleAutoRunToggle = useCallback(async (enabled: boolean) => {
    try {
      const res = await setAutoRun(enabled)
      setAgentStatus((prev) => prev ? { ...prev, autoRun: res.autoRun } : null)
      addToast(
        res.autoRun
          ? `✅ Auto-run enabled — agent will scrape every ${agentStatus?.intervalMinutes ?? 3} min`
          : '⏸️ Auto-run disabled — agent is now idle',
        'success'
      )
    } catch (err: any) {
      addToast(`Failed to toggle auto-run: ${err.message}`, 'error')
    }
  }, [addToast, agentStatus])

  /* ── Run Now ─────────────────────────────────────────────────────────────── */
  const handleRunNow = useCallback(async () => {
    setIsRunningNow(true)
    addToast('🤖 Agent cycle started — scraping Google Maps…', 'success')
    try {
      const res = await runNow()
      addToast(`✅ Run complete — ${res.total} leads discovered and saved to MongoDB!`, 'success')
      await loadData(true)
    } catch (err: any) {
      addToast(`❌ Run failed: ${err.message}`, 'error')
    } finally {
      setIsRunningNow(false)
    }
  }, [addToast, loadData])

  /* ── Filtered Leads & Metadata ───────────────────────────────────────────── */
  const existingNiches = useMemo(() => Array.from(new Set(leads.map((l) => l.niche).filter(Boolean))), [leads])
  const existingCities = useMemo(() => Array.from(new Set(leads.map((l) => l.city).filter(Boolean))), [leads])
  const existingBusinesses = useMemo(() => Array.from(new Set(leads.map((l) => l.businessName).filter(Boolean))), [leads])

  const filtered = useMemo(() => {
    let list = leads
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((l) =>
        l.businessName.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.niche.toLowerCase().includes(q) ||
        l.contactEmail?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'All') list = list.filter((l) => l.status === statusFilter)
    if (strategyFilter !== 'All') list = list.filter((l) => l.strategy === strategyFilter)
    return list
  }, [leads, search, statusFilter, strategyFilter])

  /* ── CSV Export ──────────────────────────────────────────────────────────── */
  function exportCsv() {
    if (filtered.length === 0) { addToast('No leads to export.', 'error'); return }
    const headers = ['ID','Business Name','Niche','City','Email','Phone','Website','Strategy','Status','Date Found']
    const rows = filtered.map((l) => [
      l.id, l.businessName, l.niche, l.city, l.contactEmail,
      l.phone, l.websiteUrl, l.strategy, l.status, l.dateFound,
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leadpulse-export-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    addToast(`Exported ${filtered.length} leads as CSV.`, 'success')
  }

  /* ── Delete single lead ─────────────────────────────────────────────────── */
  const handleDeleteLead = useCallback(async (lead: Lead) => {
    if (!window.confirm(`Are you sure you want to delete "${lead.businessName}"? This action cannot be undone.`)) {
      return
    }
    setDeletingId(lead.id)
    try {
      await deleteLead(lead.id)
      setLeads((prev) => prev.filter((l) => l.id !== lead.id))
      setSelectedIds((prev) => prev.filter((id) => id !== lead.id))
      addToast(`🗑️ "${lead.businessName}" deleted.`, 'success')
      fetchStats().then((res) => setStats(res.stats)).catch(() => {})
    } catch (err: any) {
      addToast(`Failed to delete lead: ${err.message}`, 'error')
    } finally {
      setDeletingId(null)
    }
  }, [addToast])

  /* ── Selection & Batch Delete ───────────────────────────────────────────── */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((l) => l.id))
    }
  }, [filtered, selectedIds.length])

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    if (!window.confirm(`Are you sure you want to delete ${count} selected lead${count > 1 ? 's' : ''}? This cannot be undone.`)) {
      return
    }
    setIsDeletingBatch(true)
    try {
      await batchDeleteLeads(selectedIds)
      setLeads((prev) => prev.filter((l) => !selectedIds.includes(l.id)))
      setSelectedIds([])
      addToast(`🗑️ ${count} lead${count > 1 ? 's' : ''} deleted successfully.`, 'success')
      fetchStats().then((res) => setStats(res.stats)).catch(() => {})
    } catch (err: any) {
      addToast(`Failed to delete selected leads: ${err.message}`, 'error')
    } finally {
      setIsDeletingBatch(false)
    }
  }, [addToast, selectedIds])

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Navigation ── */}
      <Navbar
        onNewJob={() => setShowJobModal(true)}
        onRefresh={() => loadData(true)}
        isRefreshing={refreshing}
        agentOnline={agentOnline}
        agentStatus={agentStatus}
        onAutoRunToggle={handleAutoRunToggle}
        onRunNow={handleRunNow}
        isRunningNow={isRunningNow}
      />

      {/* ── Main Content ── */}
      <main className="main-content">

        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>
            Lead Discovery <span style={{ color: 'var(--accent)' }}>Dashboard</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Real Google Maps business leads — scraped, stored in MongoDB & ready for outreach.
          </p>
        </div>

        {/* DB not configured warning */}
        {agentOnline && agentStatus && !agentStatus.dbConnected && (
          <div style={{
            background: 'var(--orange-dim)', border: '1px solid rgba(255,140,66,0.35)',
            borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20,
            fontSize: 13, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span>
              <strong>MongoDB not connected.</strong> Add your connection string to{' '}
              <code style={{ background: 'rgba(255,140,66,0.15)', padding: '1px 6px', borderRadius: 4 }}>
                .env → DATABASE_URL=mongodb+srv://...
              </code>
              {' '}and restart the backend.
            </span>
          </div>
        )}

        {/* KPI Cards */}
        <KpiSummary stats={stats} loading={loading} />

        <div style={{ height: 28 }} />

        {/* Filter Bar + Table */}
        <div className="card" style={{ padding: '0 20px 20px' }}>
          <FiltersBar
            search={search}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatus={setStatusFilter}
            strategyFilter={strategyFilter}
            onStrategy={setStrategyFilter}
            total={filtered.length}
            onExport={exportCsv}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleBatchDelete}
            isDeletingSelected={isDeletingBatch}
            suggestions={{
              businesses: existingBusinesses,
              cities: existingCities,
              niches: existingNiches,
            }}
          />
          <LeadsTable
            leads={filtered}
            loading={loading}
            onPitch={(lead) => setSelectedLead(lead)}
            onDelete={handleDeleteLead}
            deletingId={deletingId}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
          />
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: 'var(--text-muted)' }}>
          LeadPulse Agency Edition •{' '}
          <code style={{ color: 'var(--accent)' }}>Express :4200</code>
          {' '}→{' '}
          <code style={{ color: 'var(--green)' }}>MongoDB</code>
          {' '}→{' '}
          <code style={{ color: 'var(--accent)' }}>Vite :5173</code>
        </div>
      </main>

      {/* ── Modals ── */}
      {showJobModal && (
        <CreateJobModal
          onClose={() => setShowJobModal(false)}
          onSuccess={(newLeads) => {
            setLeads((prev) => [...newLeads, ...prev])
            loadData(true)
          }}
          onToast={addToast}
          existingNiches={existingNiches}
          existingCities={existingCities}
        />
      )}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={() => loadData(true)}
          onToast={addToast}
        />
      )}

      {/* ── Toasts ── */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
