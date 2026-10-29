// ─── Typed fetch client for the Express backend (dashboard.ts) ───────────────
// Backend runs at http://127.0.0.1:4200, proxied via Vite at /api/*

import type { Lead, Stats, ScrapePayload, AgentStatus } from '../types'

const RAW_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '')
const BASE = RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data as T
  } catch (err: any) {
    if (err.name === 'TypeError' && (err.message?.includes('fetch') || err.message?.includes('network'))) {
      throw new Error('Backend is waking up (Render free tier takes ~30-45s). Please wait a moment and try again.')
    }
    throw err
  }
}

/* ── Leads ────────────────────────────────────────────────────────────────── */

export async function fetchLeads(): Promise<{ success: boolean; total: number; leads: Lead[] }> {
  return request('/leads')
}

export async function updateLeadStatus(id: string, status: string): Promise<{ success: boolean }> {
  return request(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function deleteLead(id: string): Promise<{ success: boolean }> {
  return request(`/leads/${id}`, { method: 'DELETE' })
}

export async function batchDeleteLeads(ids: string[]): Promise<{ success: boolean; deletedCount?: number }> {
  try {
    return await request('/leads/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  } catch {
    // Graceful fallback if batch endpoint is not yet restarted on remote backend
    await Promise.all(ids.map((id) => deleteLead(id)))
    return { success: true, deletedCount: ids.length }
  }
}

export async function createLead(lead: Partial<Lead>): Promise<{ success: boolean; lead: Lead }> {
  return request('/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  })
}

/* ── Stats ────────────────────────────────────────────────────────────────── */

export async function fetchStats(): Promise<{ success: boolean; stats: Stats }> {
  return request('/stats')
}

/* ── Scrape ───────────────────────────────────────────────────────────────── */

export async function triggerScrape(
  payload: ScrapePayload,
): Promise<{ success: boolean; total: number; leads: Lead[] }> {
  return request('/scrape', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ── Agent Control ────────────────────────────────────────────────────────── */

export async function fetchAgentStatus(): Promise<{ success: boolean } & AgentStatus> {
  return request('/agent/status')
}

export async function setAutoRun(enabled: boolean): Promise<{ success: boolean; autoRun: boolean }> {
  return request('/agent/auto-run', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function runNow(): Promise<{ success: boolean; total: number; leads: Lead[] }> {
  return request('/agent/run-now', { method: 'POST' })
}
