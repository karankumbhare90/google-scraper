import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import mongoose, { Schema, Document, Model } from 'mongoose'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import exceljsPkg from 'exceljs'
const ExcelJS = (exceljsPkg as any).default || exceljsPkg
import { scrapeGoogleMapsLeads } from './scraper.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 4200

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (_req, res) => {
  res.json({
    name: 'LeadPulse Agent API',
    status: 'online',
    version: '1.0.0',
    dbConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString(),
  })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// Disable buffering so queries fail or return immediately if DB is offline instead of hanging
mongoose.set('bufferCommands', false)

// ─── MongoDB Connection ────────────────────────────────────────────────────────

const MONGO_URI = process.env.DATABASE_URL || ''

async function connectDB() {
  if (!MONGO_URI) {
    console.warn('[MongoDB] DATABASE_URL not set in .env — DB features disabled.')
    return false
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log('[MongoDB] Connected ✅')
    return true
  } catch (err: any) {
    console.error('[MongoDB] Connection failed:', err.message)
    if (err.message?.includes('SSL') || err.message?.includes('alert') || err.message?.includes('internal error')) {
      console.warn('👉 Tip: MongoDB Atlas SSL/TLS alert usually means your current IP address is not whitelisted. In MongoDB Atlas, go to "Network Access" and add "0.0.0.0/0" (Allow Access from Anywhere).')
    }
    return false
  }
}

// ─── Lead Schema ───────────────────────────────────────────────────────────────

interface ILead extends Document {
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
  createdAt: Date
}

const leadSchema = new Schema<ILead>({
  id:            { type: String, required: true, unique: true },
  businessName:  { type: String, required: true },
  strategy:      { type: String, default: '' },
  niche:         { type: String, default: '' },
  city:          { type: String, default: '' },
  state:         { type: String, default: '' },
  contactEmail:  { type: String, default: '' },
  phone:         { type: String, default: '' },
  whatsappLink:  { type: String, default: '' },
  websiteUrl:    { type: String, default: '' },
  websiteStatus: { type: String, default: '' },
  auditNotes:    { type: String, default: '' },
  status:        { type: String, default: 'Pending' },
  dateFound:     { type: String, default: '' },
  dateContacted: { type: String, default: '' },
  emailSubject:  { type: String, default: '' },
  createdAt:     { type: Date, default: Date.now },
})

let LeadModel: Model<ILead>
try {
  LeadModel = mongoose.model<ILead>('Lead')
} catch {
  LeadModel = mongoose.model<ILead>('Lead', leadSchema)
}

// ─── Auto-Run State ────────────────────────────────────────────────────────────
// Controls whether the background scrape agent cycles automatically.

let autoRunEnabled = false
let autoRunInterval: ReturnType<typeof setInterval> | null = null
const INTERVAL_MS = parseInt(process.env.EMAIL_INTERVAL_MINUTES || '3', 10) * 60 * 1000

function extractState(city: string): string {
  const match = city.match(/,\s*([A-Z]{2})$/)
  return match ? match[1] : city
}

// ─── Multi-Storage Sync (Google Sheets & Excel) ───────────────────────────────

const EXCEL_PATH = process.env.EXCEL_FILE_PATH || path.join(__dirname, 'leads_database.xlsx')

async function getGoogleSheetsClient() {
  const sheetId = process.env.GOOGLE_SHEET_ID
  if (!sheetId) return null

  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let privateKey = process.env.GOOGLE_PRIVATE_KEY

  const keyPath = path.join(__dirname, 'mail-agent-510115-aa88ca0745d5.json')
  if ((!clientEmail || !privateKey) && fs.existsSync(keyPath)) {
    try {
      const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
      clientEmail = clientEmail || keyData.client_email
      privateKey = privateKey || keyData.private_key
    } catch {}
  }

  if (!clientEmail || !privateKey) return null

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  return { sheets, sheetId, clientEmail }
}

async function appendLeadToGoogleSheet(lead: any) {
  const clientInfo = await getGoogleSheetsClient()
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL

  const row = [
    lead.id,
    lead.businessName,
    lead.strategy,
    lead.niche,
    lead.city,
    lead.contactEmail,
    lead.phone,
    lead.whatsappLink,
    lead.websiteUrl,
    lead.websiteStatus,
    lead.auditNotes,
    lead.status,
    lead.dateFound,
    lead.dateContacted,
    lead.emailSubject,
  ]

  let apiSuccess = false

  // Method 1: Direct Google Sheets API via Service Account
  if (clientInfo) {
    try {
      const { sheets, sheetId, clientEmail } = clientInfo

      // Fetch dynamic first sheet name so range never fails
      let tabName = 'Sheet1'
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
        tabName = meta.data.sheets?.[0]?.properties?.title || 'Sheet1'
      } catch (err: any) {
        if (err.message?.includes('permission') || err.message?.includes('403') || err.message?.includes('404')) {
          console.warn(`\n⚠️  [Google Sheets Permission] Sheet is not shared with Service Account:`)
          console.warn(`   👉 Open Google Sheet and click "Share", then add: ${clientEmail} as Editor.\n`)
        }
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'${tabName}'!A:O`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })
      console.log(`📊 [Google Sheet] Row appended to "${tabName}" for: ${lead.businessName}`)
      apiSuccess = true
    } catch (err: any) {
      console.warn(`[Google Sheets API Error]:`, err.message)
      if (err.message?.includes('permission') || err.message?.includes('403')) {
        console.warn(`👉 ACTION: Share your Google Sheet with "${clientInfo.clientEmail}" as Editor!`)
      }
    }
  }

  // Method 2: Google Apps Script Webhook fallback
  if (webhookUrl && !apiSuccess) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      })
      console.log(`📊 [Google Sheet Webhook] Sent lead: ${lead.businessName}`)
    } catch (err: any) {
      console.warn(`[Google Sheet Webhook Warning]`, err.message)
    }
  }
}

async function appendLeadToExcel(lead: any) {
  try {
    const workbook = new ExcelJS.Workbook()
    let worksheet: ExcelJS.Worksheet
    if (fs.existsSync(EXCEL_PATH)) {
      await workbook.xlsx.readFile(EXCEL_PATH)
      worksheet = workbook.getWorksheet(1) || workbook.addWorksheet('Leads')
    } else {
      worksheet = workbook.addWorksheet('Leads')
      worksheet.addRow([
        'Lead ID', 'Business Name', 'Strategy', 'Niche', 'City',
        'Contact Email', 'Phone', 'WhatsApp Link', 'Website URL', 'Website Status',
        'Audit Notes', 'Status', 'Date Found', 'Date Contacted', 'Email Subject',
      ])
    }
    worksheet.addRow([
      lead.id, lead.businessName, lead.strategy, lead.niche, lead.city,
      lead.contactEmail, lead.phone, lead.whatsappLink, lead.websiteUrl, lead.websiteStatus,
      lead.auditNotes, lead.status, lead.dateFound, lead.dateContacted, lead.emailSubject,
    ])
    await workbook.xlsx.writeFile(EXCEL_PATH)
    console.log(`📑 [Excel] Saved lead: ${lead.businessName}`)
  } catch (err: any) {
    console.warn(`[Excel Sync] Warning:`, err.message)
  }
}

async function saveLead(leadData: any) {
  // 1. Save to MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      await LeadModel.create(leadData)
    } catch (err: any) {
      if (err.code !== 11000) console.error('[DB Save Error]', err.message)
    }
  }

  // 2. Sync to Google Sheets (API + Webhook)
  await appendLeadToGoogleSheet(leadData)

  // 3. Sync to local Excel
  await appendLeadToExcel(leadData)
}

// ─── Agent Cycle (one scrape pass) ────────────────────────────────────────────

async function runAgentCycle(niche?: string, city?: string): Promise<{ total: number; leads: any[] }> {
  const NICHES = [
    'Plumbing Services', 'Roofing Contractors', 'HVAC & Air Conditioning Repair',
    'Electrician Services', 'Landscaping & Lawn Care Services',
    'House Cleaning & Maid Services', 'Auto Repair & Detailing Shops',
    'Pet Grooming Services', 'Local Bakery & Catering Services',
    'Cosmetic & Skin Care Clinics', 'Boutique Gyms & Fitness Centers',
    'Interior Designers & Decorators',
  ]
  const CITIES = [
    'Austin, TX', 'Miami, FL', 'Denver, CO', 'Chicago, IL',
    'Seattle, WA', 'Phoenix, AZ', 'Dallas, TX', 'San Diego, CA',
  ]

  const targetNiche = niche || NICHES[Math.floor(Math.random() * NICHES.length)]
  const targetCity  = city  || CITIES[Math.floor(Math.random() * CITIES.length)]

  console.log(`\n🔎 [Agent Cycle] Scraping "${targetNiche}" in "${targetCity}"...`)
  const rawLeads = await scrapeGoogleMapsLeads(targetNiche, targetCity, 8)

  const saved: any[] = []
  for (const raw of rawLeads) {
    const hasWebsite = !!(raw.websiteUrl && raw.websiteUrl !== 'No Site')
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const id = `LEAD-${Date.now().toString(36).toUpperCase()}-${suffix}`

    const lead = {
      id,
      businessName:  raw.businessName,
      strategy:      hasWebsite ? 'Option 2 (Modern Site Redesign)' : 'Option 1 (New Website Build)',
      niche:         targetNiche,
      city:          targetCity,
      state:         extractState(targetCity),
      contactEmail:  raw.contactEmail || 'N/A',
      phone:         raw.phone || 'N/A',
      whatsappLink:  raw.phone ? `https://wa.me/${raw.phone.replace(/\D/g, '')}` : 'N/A',
      websiteUrl:    raw.websiteUrl || 'No Site',
      websiteStatus: hasWebsite ? 'Outdated Site / Redesign Needed' : 'Missing Website',
      auditNotes:    `Scraped via auto-agent. Business: ${raw.businessName}.`,
      status:        'Pending',
      dateFound:     new Date().toISOString().split('T')[0],
      dateContacted: '',
      emailSubject:  hasWebsite
        ? `Modern Website Redesign for ${raw.businessName}`
        : `New Website & Google Visibility for ${raw.businessName}`,
    }

    try {
      await saveLead(lead)
      saved.push(lead)
    } catch (err: any) {
      console.error('[Save Error]', err.message)
    }
  }

  console.log(`✅ [Agent Cycle] ${saved.length} leads saved across MongoDB, Sheets & Excel.`)
  return { total: saved.length, leads: saved }
}

function startAutoRun() {
  if (autoRunInterval) return
  autoRunInterval = setInterval(async () => {
    if (!autoRunEnabled) return
    try { await runAgentCycle() } catch (err: any) { console.error('[Auto-Run Error]', err.message) }
  }, INTERVAL_MS)
  console.log(`[Auto-Run] Scheduler started — interval: ${process.env.EMAIL_INTERVAL_MINUTES || 3} min`)
}

function stopAutoRun() {
  if (autoRunInterval) {
    clearInterval(autoRunInterval)
    autoRunInterval = null
  }
  console.log('[Auto-Run] Scheduler stopped.')
}

// ─── API Routes ────────────────────────────────────────────────────────────────

// GET all leads
app.get('/api/leads', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, total: 0, leads: [], dbConnected: false })
    }
    const leads = await LeadModel.find().sort({ createdAt: -1 }).lean()
    res.json({ success: true, total: leads.length, leads, dbConnected: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET stats
app.get('/api/stats', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        stats: { total: 0, withEmail: 0, missingWebsite: 0, hasWebsite: 0, contacted: 0, byNiche: {}, byCity: {}, byState: {} },
        dbConnected: false,
      })
    }
    const leads = await LeadModel.find().lean()
    const withEmail      = leads.filter(l => l.contactEmail && l.contactEmail !== 'N/A').length
    const missingWebsite = leads.filter(l => l.strategy?.includes('Option 1')).length
    const hasWebsite     = leads.filter(l => l.strategy?.includes('Option 2')).length
    const contacted      = leads.filter(l => l.status === 'Emailed').length

    const byNiche: Record<string, number> = {}
    const byCity:  Record<string, number> = {}
    const byState: Record<string, number> = {}
    for (const l of leads) {
      if (l.niche)  byNiche[l.niche]  = (byNiche[l.niche]  || 0) + 1
      if (l.city)   byCity[l.city]    = (byCity[l.city]    || 0) + 1
      if (l.state)  byState[l.state]  = (byState[l.state]  || 0) + 1
    }

    res.json({ success: true, stats: { total: leads.length, withEmail, missingWebsite, hasWebsite, contacted, byNiche, byCity, byState }, dbConnected: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST create lead manually
app.post('/api/leads', async (req, res) => {
  try {
    const body = req.body
    const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
    const lead = {
      id:            `LEAD-MANUAL-${Date.now().toString(36).toUpperCase()}-${suffix}`,
      businessName:  body.businessName  || '',
      strategy:      body.strategy      || 'Option 1 (New Website Build)',
      niche:         body.niche         || '',
      city:          body.city          || '',
      state:         extractState(body.city || ''),
      contactEmail:  body.contactEmail  || '',
      phone:         body.phone         || '',
      whatsappLink:  body.phone ? `https://wa.me/${body.phone.replace(/\D/g, '')}` : '',
      websiteUrl:    body.websiteUrl    || '',
      websiteStatus: body.websiteUrl ? 'Outdated Site / Redesign Needed' : 'Missing Website',
      auditNotes:    body.auditNotes    || `Manually added lead.`,
      status:        'Pending',
      dateFound:     new Date().toISOString().split('T')[0],
      dateContacted: '',
      emailSubject:  body.emailSubject  || `Website Services for ${body.businessName}`,
    }
    await saveLead(lead)
    res.json({ success: true, lead })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PATCH update lead status
app.patch('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const lead = await LeadModel.findOneAndUpdate(
      { id },
      { status, dateContacted: new Date().toISOString() },
      { new: true }
    )
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' })
    res.json({ success: true, lead })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE lead
app.delete('/api/leads/:id', async (req, res) => {
  try {
    const { id } = req.params
    const query = mongoose.isValidObjectId(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id }
    const result = await LeadModel.findOneAndDelete(query)
    if (!result) return res.status(404).json({ success: false, error: 'Lead not found' })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/leads/batch-delete — delete multiple leads
app.post('/api/leads/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array is required' })
    }
    const result = await LeadModel.deleteMany({ id: { $in: ids } })
    res.json({ success: true, deletedCount: result.deletedCount })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/scrape — trigger scrape from dashboard
app.post('/api/scrape', async (req, res) => {
  const { niche, city, maxLeads = 8 } = req.body
  if (!niche || !city) {
    return res.status(400).json({ success: false, error: 'niche and city are required' })
  }
  try {
    console.log(`\n🔎 [Dashboard Scrape] "${niche}" in "${city}" (max ${maxLeads})`)
    const rawLeads = await scrapeGoogleMapsLeads(niche, city, Number(maxLeads))
    const saved: any[] = []

    for (const raw of rawLeads) {
      const hasWebsite = !!(raw.websiteUrl && raw.websiteUrl !== 'No Site')
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
      const id = `LEAD-${Date.now().toString(36).toUpperCase()}-${suffix}`

      const lead = {
        id,
        businessName:  raw.businessName,
        strategy:      hasWebsite ? 'Option 2 (Modern Site Redesign)' : 'Option 1 (New Website Build)',
        niche,
        city,
        state:         extractState(city),
        contactEmail:  raw.contactEmail || 'N/A',
        phone:         raw.phone || 'N/A',
        whatsappLink:  raw.phone ? `https://wa.me/${raw.phone.replace(/\D/g, '')}` : 'N/A',
        websiteUrl:    raw.websiteUrl || 'No Site',
        websiteStatus: hasWebsite ? 'Outdated Site / Redesign Needed' : 'Missing Website',
        auditNotes:    `Real business listing (${raw.businessName}) scraped via Dashboard.`,
        status:        'Pending',
        dateFound:     new Date().toISOString().split('T')[0],
        dateContacted: '',
        emailSubject:  hasWebsite
          ? `Modern Website Redesign for ${raw.businessName}`
          : `New Website & Google Visibility for ${raw.businessName}`,
      }

      try {
        await saveLead(lead)
        saved.push(lead)
      } catch (e: any) {
        console.error('[Save Error]', e.message)
      }
    }

    console.log(`✅ [Dashboard Scrape] ${saved.length} leads saved across MongoDB, Sheets & Excel.`)
    res.json({ success: true, total: saved.length, leads: saved })
  } catch (err: any) {
    console.error('[Dashboard Scrape Error]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── Auto-Run Control Routes ───────────────────────────────────────────────────

// GET auto-run status
app.get('/api/agent/status', (_req, res) => {
  res.json({
    success: true,
    autoRun: autoRunEnabled,
    intervalMinutes: parseInt(process.env.EMAIL_INTERVAL_MINUTES || '3', 10),
    dbConnected: mongoose.connection.readyState === 1,
  })
})

// POST toggle auto-run on/off
app.post('/api/agent/auto-run', (req, res) => {
  const { enabled } = req.body
  autoRunEnabled = !!enabled
  if (autoRunEnabled) {
    startAutoRun()
    console.log('[Auto-Run] ENABLED by dashboard.')
  } else {
    stopAutoRun()
    console.log('[Auto-Run] DISABLED by dashboard.')
  }
  res.json({ success: true, autoRun: autoRunEnabled })
})

// POST run one agent cycle immediately (manual trigger)
app.post('/api/agent/run-now', async (_req, res) => {
  console.log('[Manual Run] Triggered from dashboard.')
  try {
    const result = await runAgentCycle()
    res.json({ success: true, ...result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET system health
app.get('/api/system/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    dbConnected: mongoose.connection.readyState === 1,
    autoRun: autoRunEnabled,
  })
})

// GET /api/sheets/test — test and verify Google Sheets connection
app.get('/api/sheets/test', async (_req, res) => {
  const clientInfo = await getGoogleSheetsClient()
  if (!clientInfo) {
    return res.status(400).json({
      success: false,
      error: 'Google Sheets credentials not found. Check GOOGLE_SHEET_ID and service account key in .env',
    })
  }

  try {
    const { sheets, sheetId, clientEmail } = clientInfo
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const title = meta.data.properties?.title || 'Untitled Spreadsheet'
    const tabName = meta.data.sheets?.[0]?.properties?.title || 'Sheet1'

    const testRow = [
      `TEST-${Date.now().toString(36).toUpperCase()}`,
      'LeadPulse Test Business',
      'Option 1 (New Website Build)',
      'Plumbing Services',
      'Austin, TX',
      'test@leadpulse.agency',
      '+1234567890',
      'https://wa.me/1234567890',
      'No Site',
      'Missing Website',
      'Verification test row to confirm Google Sheets sync is live.',
      'Test Row',
      new Date().toISOString().split('T')[0],
      new Date().toISOString(),
      'Google Sheets Sync Live Test',
    ]

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${tabName}'!A:O`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [testRow] },
    })

    res.json({
      success: true,
      message: `Successfully connected and appended test row to "${tabName}" in "${title}"!`,
      spreadsheetTitle: title,
      sheetTab: tabName,
      serviceAccount: clientEmail,
      updatedRange: appendRes.data.updates?.updatedRange,
    })
  } catch (err: any) {
    const isPermissionError = err.message?.includes('permission') || err.message?.includes('403') || err.message?.includes('404')
    res.status(500).json({
      success: false,
      error: err.message,
      isPermissionError,
      actionRequired: isPermissionError
        ? `Open your Google Sheet (ID: ${clientInfo.sheetId}) in your browser, click 'Share' in the top right, and add "${clientInfo.clientEmail}" with 'Editor' permissions.`
        : undefined,
    })
  }
})

// Serve dashboard SPA
app.get('/*path', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  // Start server immediately so port 4200 is always reachable right away
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n🚀 Webnexa Lead Dashboard running at http://localhost:${PORT}`)
    console.log(`🤖 Auto-Run: ${autoRunEnabled ? 'ENABLED' : 'DISABLED (toggle from dashboard)'}`)
    console.log(`📊 Google Sheet Sync: ${process.env.GOOGLE_SHEET_ID ? 'ENABLED (ID: ' + process.env.GOOGLE_SHEET_ID.slice(0, 10) + '...)' : 'Disabled'}`)
    console.log(`📑 Local Excel Sync: ENABLED (${path.basename(EXCEL_PATH)})\n`)
  })

  // Connect to MongoDB asynchronously
  if (MONGO_URI) {
    connectDB().then((connected) => {
      if (connected) {
        console.log('📦 MongoDB: Connected')
      } else {
        console.log('📦 MongoDB: Disconnected (backend running with DB features paused)')
      }
    })
  } else {
    console.log('📦 MongoDB: Not configured (add DATABASE_URL in .env)')
  }
}

bootstrap()
