import fs from 'fs'
import path from 'path'
import dns from 'dns/promises'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import ExcelJS from 'exceljs'
import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { scrapeGoogleMapsLeads, RealLead } from './scraper.js'

dotenv.config()

// Interfaces
interface Lead {
  id: string
  businessName: string
  niche: string
  city: string
  contactEmail: string | null
  phone: string | null
  whatsappLink: string | null
  websiteUrl: string | null
  websiteStatus: 'Missing Website' | 'Outdated Site / Redesign Needed'
  strategy: 'Option 1 (New Website Build)' | 'Option 2 (Modern Site Redesign)'
  auditNotes: string
  status: 'Pending' | 'Emailed' | 'Phone / WhatsApp Logged' | 'Failed'
  dateFound: string
  dateContacted: string | null
  emailSubject: string
}

const NICHES = [
  'Plumbing Services',
  'Roofing Contractors',
  'HVAC & Air Conditioning Repair',
  'Electrician Services',
  'Landscaping & Lawn Care Services',
  'House Cleaning & Maid Services',
  'Auto Repair & Detailing Shops',
  'Pet Grooming Services',
  'Local Bakery & Catering Services',
  'Cosmetic & Skin Care Clinics',
  'Boutique Gyms & Fitness Centers',
  'Interior Designers & Decorators',
]

const TARGET_CITIES = [
  'Austin, TX',
  'Miami, FL',
  'Denver, CO',
  'Chicago, IL',
  'Seattle, WA',
  'Phoenix, AZ',
  'Dallas, TX',
  'San Diego, CA',
  'Atlanta, GA',
  'Boston, MA',
]

const EXCEL_PATH = process.env.EXCEL_FILE_PATH || './leads_database.xlsx'
const INTERVAL_MS = parseInt(process.env.EMAIL_INTERVAL_MINUTES || '5', 10) * 60 * 1000

// Initialize Gemini AI Client
const genAIKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
const genAI = genAIKey && genAIKey.startsWith('AIzaSy') ? new GoogleGenerativeAI(genAIKey) : null

// Initialize Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Ensures local Excel lead database file exists with correct headers
 */
async function initExcelDatabase(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  if (fs.existsSync(EXCEL_PATH)) {
    await workbook.xlsx.readFile(EXCEL_PATH)
    return workbook
  }

  const worksheet = workbook.addWorksheet('Business Leads')
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Business Name', key: 'businessName', width: 28 },
    { header: 'Strategy', key: 'strategy', width: 26 },
    { header: 'Niche', key: 'niche', width: 20 },
    { header: 'City', key: 'city', width: 16 },
    { header: 'Contact Email', key: 'contactEmail', width: 28 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'WhatsApp Link', key: 'whatsappLink', width: 32 },
    { header: 'Website URL', key: 'websiteUrl', width: 32 },
    { header: 'Website Status', key: 'websiteStatus', width: 25 },
    { header: 'Audit Notes', key: 'auditNotes', width: 35 },
    { header: 'Outreach Status', key: 'status', width: 20 },
    { header: 'Date Discovered', key: 'dateFound', width: 16 },
    { header: 'Date Contacted', key: 'dateContacted', width: 16 },
    { header: 'Email Subject', key: 'emailSubject', width: 35 },
  ]

  // Style Header Row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0C1E33' },
  }

  await workbook.xlsx.writeFile(EXCEL_PATH)
  return workbook
}

/**
 * Save new lead to Excel database
 */
async function saveLeadToExcel(lead: Lead) {
  const workbook = await initExcelDatabase()
  const worksheet = workbook.getWorksheet('Business Leads')
  if (worksheet) {
    worksheet.addRow({ ...lead })
    await workbook.xlsx.writeFile(EXCEL_PATH)
  }
}

/**
 * Update outreach status for lead in Excel
 */
async function updateLeadStatusInExcel(
  leadId: string,
  status: 'Emailed' | 'Phone / WhatsApp Logged' | 'Failed',
  contactedDate: string,
) {
  const workbook = await initExcelDatabase()
  const worksheet = workbook.getWorksheet('Business Leads')
  if (worksheet) {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && row.getCell('id').value === leadId) {
        row.getCell('status').value = status
        row.getCell('dateContacted').value = contactedDate
      }
    })
    await workbook.xlsx.writeFile(EXCEL_PATH)
  }
}

/**
 * Sync lead record to Google Sheets (via Service Account API)
 */
async function syncToGoogleSheets(lead: Lead) {
  const safePhone = lead.phone ? `'${lead.phone}` : ''

  // Direct Service Account API Sync (Guarantees single row entry to Sheet ID 1YhJd1789ey_YylxKIABzWcyKK7DY0njqhdlQ0_6vFac)
  const sheetId = process.env.GOOGLE_SHEET_ID
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!sheetId || !clientEmail || !privateKey) {
    return
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Check if Header Row exists in Sheet1
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:O1',
    })

    if (!getRes.data.values || getRes.data.values.length === 0) {
      // Create Header Row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Sheet1!A1:O1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [
              'Lead ID',
              'Business Name',
              'Strategy',
              'Niche',
              'City',
              'Contact Email',
              'Phone',
              'WhatsApp Link',
              'Website URL',
              'Website Status',
              'Audit Notes',
              'Outreach Status',
              'Date Discovered',
              'Date Contacted',
              'Email Subject',
            ],
          ],
        },
      })
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:O',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            lead.id,
            lead.businessName,
            lead.strategy,
            lead.niche,
            lead.city,
            lead.contactEmail || 'N/A',
            safePhone || 'N/A',
            lead.whatsappLink || 'N/A',
            lead.websiteUrl || 'No Site',
            lead.websiteStatus,
            lead.auditNotes,
            lead.status,
            lead.dateFound,
            lead.dateContacted || '',
            lead.emailSubject,
          ],
        ],
      },
    })
    console.log(`[Google Sheets Direct API] Synced lead: ${lead.businessName}`)
  } catch (err: any) {
    console.error(`[Google Sheets API Error]:`, err.message || err)
  }
}

/**
 * AI Lead Discovery Engine: Discovers ONLY 100% REAL Google Maps businesses (No synthetic data)
 */
async function discoverLeadsBatch(): Promise<{ mapsLead: RealLead; timestamp: string }[]> {
  let attempts = 0
  const maxAttempts = 50

  while (attempts < maxAttempts) {
    attempts++
    const randomNiche = NICHES[Math.floor(Math.random() * NICHES.length)]
    const randomCity = TARGET_CITIES[Math.floor(Math.random() * TARGET_CITIES.length)]

    console.log(
      `🔎 [Google Maps Scraper] Querying real business listings for "${randomNiche}" in "${randomCity}" (Attempt ${attempts}/${maxAttempts})...`,
    )

    const mapsLeads = await scrapeGoogleMapsLeads(randomNiche, randomCity, 8)
    if (mapsLeads && mapsLeads.length > 0) {
      return mapsLeads.map((mapsLead) => ({
        mapsLead,
        timestamp:
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      }))
    }

    await new Promise((resolve) => setTimeout(resolve, 1200))
  }

  await new Promise((resolve) => setTimeout(resolve, 2000))
  return discoverLeadsBatch()
}

/**
 * AI Personalized Email Generator (Tailored for Option 1 vs. Option 2)
 */
async function generateColdEmail(lead: Lead): Promise<{ subject: string; htmlBody: string }> {
  const isOption1 = lead.strategy === 'Option 1 (New Website Build)'

  const defaultSubject = isOption1
    ? `New Website & Google Visibility for ${lead.businessName}`
    : `Modern Website Redesign & Tech Stack Upgrade for ${lead.businessName}`

  const defaultBody = isOption1
    ? `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
  <p>Hi Team at <strong>${lead.businessName}</strong>,</p>

  <p>While researching local <strong>${lead.niche}</strong> businesses in <strong>${lead.city}</strong> on Google Maps, I noticed your business currently doesn't have an active website to capture online customer searches.</p>

  <p>At <strong>Webnexa Digital</strong>, we build high-converting, mobile-responsive custom websites tailored specifically for ${lead.niche} to help local businesses gain 3x more customer inquiries directly from Google.</p>

  <p><strong>What we can deliver for ${lead.businessName}:</strong></p>
  <ul>
    <li>⚡ Custom ultra-fast mobile website</li>
    <li>📍 Complete Google Maps & Local SEO setup</li>
    <li>💬 Direct WhatsApp & call lead capture buttons</li>
  </ul>

  <p>Would you be open to seeing a free 2-minute website prototype for ${lead.businessName}?</p>

  <p>Best regards,<br/>
  <strong>Karan Kumbhare</strong><br/>
  Webnexa Digital Solutions<br/>
  <a href="https://webnexacms.vercel.app">webnexacms.vercel.app</a>
  </p>
</div>`
    : `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
  <p>Hi Team at <strong>${lead.businessName}</strong>,</p>

  <p>I recently visited your website (<strong>${lead.websiteUrl}</strong>) while reviewing top <strong>${lead.niche}</strong> in <strong>${lead.city}</strong>.</p>

  <p>At <strong>Webnexa Digital</strong>, we specialize in upgrading existing business websites to modern tech stacks (Next.js, React, Payload CMS) with lightning-fast load times, sleek UI/UX design, and built-in SEO to double online conversions.</p>

  <p><strong>How we can upgrade ${lead.businessName}'s digital presence:</strong></p>
  <ul>
    <li>🚀 Modernize UI/UX design to feel premium & state-of-the-art</li>
    <li>⚡ Next-gen tech stack upgrade (Next.js + Tailwind CSS) for instant page loads</li>
    <li>📱 Seamless mobile experience & CMS editor control panel</li>
  </ul>

  <p>Would you be open to a quick comparison showing how a modernized site design would boost your lead conversions?</p>

  <p>Best regards,<br/>
  <strong>Karan Kumbhare</strong><br/>
  Webnexa Digital Solutions<br/>
  <a href="https://webnexacms.vercel.app">webnexacms.vercel.app</a>
  </p>
</div>`

  if (!genAI) {
    return { subject: defaultSubject, htmlBody: defaultBody }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const prompt = isOption1
      ? `You are an elite cold email copywriter for "Webnexa Digital".
Write a polite, compelling email pitching a NEW website build to "${lead.businessName}" (${lead.niche} in ${lead.city}).
Strategy: Option 1 - No website found on Google Maps. Offer custom fast website build & local Google SEO.
Return strictly valid JSON: {"subject": "Catchy Subject", "htmlBody": "Clean HTML string"}`
      : `You are an elite cold email copywriter for "Webnexa Digital".
Write a polite, compelling email pitching a WEBSITE REDESIGN & TECH STACK UPGRADE to "${lead.businessName}" (${lead.niche} in ${lead.city}).
Their current website is: ${lead.websiteUrl}.
Strategy: Option 2 - Existing site found. Offer modern Next.js/React redesign, high-speed loading, premium UI, and Payload CMS.
Return strictly valid JSON: {"subject": "Catchy Subject", "htmlBody": "Clean HTML string"}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        subject: parsed.subject || defaultSubject,
        htmlBody: parsed.htmlBody || defaultBody,
      }
    }
  } catch (err) {
    console.warn('[AI Email Pitch] Using structured template fallback:', err)
  }

  return { subject: defaultSubject, htmlBody: defaultBody }
}

/**
 * Validates if recipient email domain has active MX records
 */
async function hasValidMxRecord(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1]
    if (!domain) return false
    const mxRecords = await dns.resolveMx(domain)
    return mxRecords && mxRecords.length > 0
  } catch {
    return false
  }
}

/**
 * Dispatch Cold Email via SMTP (Commented out for future implementation)
 */
/*
async function sendColdEmail(
  lead: Lead,
  email: { subject: string; htmlBody: string },
): Promise<boolean> {
  if (!lead.contactEmail) return false

  const fromName = process.env.FROM_NAME || 'Webnexa Digital'
  const fromEmail = process.env.SMTP_USER || 'karankumbhare90@gmail.com'
  const recipientEmail = process.env.TARGET_TEST_EMAIL || lead.contactEmail

  const isValidMx = await hasValidMxRecord(recipientEmail)
  if (!isValidMx && !process.env.TARGET_TEST_EMAIL) {
    console.warn(`[Domain Check] ${recipientEmail} has no valid MX records. Skipping email send to avoid bounce.`)
    return false
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipientEmail,
      subject: email.subject,
      html: email.htmlBody,
    })

    console.log(
      `[Email Dispatched] To: ${recipientEmail} (${lead.businessName}) | Message ID: ${info.messageId}`,
    )
    return true
  } catch (error: any) {
    console.error(`[SMTP Error]: Failed to send to ${recipientEmail}:`, error.message || error)
    return false
  }
}
*/

/**
 * Agent Execution Cycle
 */
async function executeAgentCycle() {
  const currentTime = new Date().toLocaleTimeString()
  console.log(`\n===========================================================`)
  console.log(`🚀 [Google Maps Lead Agent Cycle Started at ${currentTime}]`)
  console.log(`===========================================================`)

  // Step 1: Discover batch of 5-8 real Google Maps Leads
  const leadBatch = await discoverLeadsBatch()
  console.log(`📦 [Batch Scraped]: ${leadBatch.length} real leads found this cycle\n`)

  for (const { mapsLead, timestamp } of leadBatch) {
    const lead: Lead = {
      id: `LEAD-${timestamp.toUpperCase()}`,
      businessName: mapsLead.businessName,
      niche: mapsLead.niche,
      city: mapsLead.city,
      contactEmail: mapsLead.contactEmail,
      phone: mapsLead.phone,
      whatsappLink: mapsLead.whatsappLink,
      websiteUrl: mapsLead.websiteUrl,
      websiteStatus: mapsLead.websiteStatus,
      strategy: mapsLead.strategy,
      auditNotes: mapsLead.auditNotes,
      status: 'Pending',
      dateFound: new Date().toISOString().split('T')[0],
      dateContacted: null,
      emailSubject:
        mapsLead.strategy === 'Option 1 (New Website Build)'
          ? `Building a modern online presence for ${mapsLead.businessName}`
          : `Website & Tech Stack Upgrade for ${mapsLead.businessName}`,
    }

    console.log(`📍 [Lead Discovered]: ${lead.businessName} (${lead.niche} in ${lead.city})`)
    console.log(`🎯 [Strategy]: ${lead.strategy}`)
    console.log(`   Email: ${lead.contactEmail || 'No Email Found'}`)
    console.log(`   Phone: ${lead.phone || 'N/A'} | WhatsApp: ${lead.whatsappLink || 'N/A'}`)
    console.log(`   Website: ${lead.websiteUrl || 'None (Missing)'}`)
    console.log(`   Notes: ${lead.auditNotes}`)

    // Save Lead to Local Excel Database
    await saveLeadToExcel(lead)
    console.log(`💾 [Excel Database]: Lead saved to ${EXCEL_PATH}`)

    // Pitch Generation & Lead Logging
    const emailPitch = await generateColdEmail(lead)
    lead.emailSubject = emailPitch.subject
    let finalStatus: 'Emailed' | 'Logged (Dev Mode)' | 'Phone / WhatsApp Logged' | 'Failed' =
      'Logged (Dev Mode)'

    if (lead.contactEmail) {
      console.log(
        `✉️  [Lead Email Discovered]: ${lead.contactEmail} | Subject: "${emailPitch.subject}" (Mail sending paused for future implementation)`,
      )
      finalStatus = 'Logged (Dev Mode)'
    } else if (lead.phone) {
      console.log(
        `📱 [WhatsApp / Phone Logged]: Saved 1-click WhatsApp link to Sheets: ${lead.whatsappLink}`,
      )
      finalStatus = 'Phone / WhatsApp Logged'
    }

    const contactedDate = new Date().toISOString()
    await updateLeadStatusInExcel(lead.id, finalStatus, contactedDate)
    lead.status = finalStatus as any
    lead.dateContacted = contactedDate

    await syncToGoogleSheets(lead)

    console.log(
      `✅ [Lead Complete]: ${lead.businessName} → ${lead.strategy} | Status: "${finalStatus}"`,
    )
    console.log(`---`)

    // Small delay between leads to avoid rate-limits
    await new Promise((resolve) => setTimeout(resolve, 800))
  }

  console.log(`\n🏁 [Cycle Complete]: ${leadBatch.length} leads processed this cycle.`)
  console.log(
    `⏰ [Next Execution]: Scheduled in ${process.env.EMAIL_INTERVAL_MINUTES || 5} minutes...\n`,
  )
}

/**
 * Start Autonomous Continuous Service
 */
async function startAgent() {
  console.log(`\n🤖 Webnexa Dual-Strategy Google Maps Cold Outreach Agent`)
  console.log(`------------------------------------------------------------------`)
  console.log(`- Strategy 1: Missing Website -> Brand New Website Pitch`)
  console.log(`- Strategy 2: Has Website -> Tech Stack & Modern Redesign Pitch`)
  console.log(`- Priority: Email Outreach -> Fallback Phone / WhatsApp Logging`)
  console.log(`- Interval: Every ${process.env.EMAIL_INTERVAL_MINUTES || 5} minutes`)
  console.log(`- Excel Lead DB: ${EXCEL_PATH}`)
  console.log(`------------------------------------------------------------------\n`)

  await initExcelDatabase()

  // Run immediate first cycle
  await executeAgentCycle()

  // Schedule 5-minute recurring loop
  setInterval(async () => {
    try {
      await executeAgentCycle()
    } catch (err) {
      console.error('[Agent Cycle Error]:', err)
    }
  }, INTERVAL_MS)
}

startAgent()
