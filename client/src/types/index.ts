// ─── Types matching dashboard.ts backend DTO ──────────────────────────────────

export interface Lead {
  id: string
  businessName: string
  strategy: string
  niche: string
  city: string
  state: string
  contactEmail: string
  phone: string
  whatsappLink: string
  websiteUrl: string
  websiteStatus: string
  auditNotes: string
  status: string
  dateFound: string
  dateContacted: string
  emailSubject: string
}

export interface Stats {
  total: number
  withEmail: number
  missingWebsite: number
  hasWebsite: number
  contacted: number
  byNiche: Record<string, number>
  byCity: Record<string, number>
  byState: Record<string, number>
}

export interface ScrapePayload {
  niche: string
  city: string
  maxLeads?: number
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

export interface AgentStatus {
  autoRun: boolean
  intervalMinutes: number
  dbConnected: boolean
}
