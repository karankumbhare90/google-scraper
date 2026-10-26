# Webnexa Autonomous Lead Generation & Cold Outreach Agent

An autonomous, dual-strategy lead generation agent built with TypeScript, Node.js, Puppeteer, Nodemailer, ExcelJS, Google Sheets API, and Google Gemini AI. 

The agent automatically scrapes small, local service business listings directly from **Google Maps**, inspects their digital presence, crawls site footers and `/contact` pages for email addresses, generates 1-click WhatsApp outreach links, and logs verified single-row entries directly into **Google Sheets** and a local **Excel database**.

---

## 🌟 Key Features

- 📍 **100% Real Google Maps Scraping**: Uses Puppeteer headless Chrome browser automation to parse actual Google Maps listings (business names, locations, phone numbers, and official website URLs).
- 🛠️ **Small Service Business Targeting**: Scopes searches specifically to local service niches (Plumbers, Roofers, Electricians, HVAC, Landscapers, House Cleaners, Auto Repair, Pet Groomers, Bakeries, Clinics, Gyms, Interior Designers). Excludes law firms and corporate aggregator listings.
- 🎯 **Dual Outreach Strategies**:
  - **Option 1 (Missing Website)**: Identifies businesses without websites on Google Maps and generates a proposal for a brand-new custom website build & local Google SEO setup.
  - **Option 2 (Has Website)**: Deep-crawls site footers and subpages (`/contact`, `/contact-us`, `/about`, `/get-in-touch`) for contact emails, validates recipient MX DNS records, and pitches a high-speed Next.js / Tailwind CSS redesign.
- 💬 **1-Click WhatsApp Links**: Automatically formats contact phone numbers into instant 1-click WhatsApp messaging links (`https://wa.me/1...`).
- 📊 **Direct Google Sheets API Sync**: Uses Google Service Account JWT authentication to insert single clean rows into Google Sheets (`1YhJd1789ey_YylxKIABzWcyKK7DY0njqhdlQ0_6vFac`), avoiding duplicate rows.
- 💾 **Local Excel Database Persistence**: Keeps a local history of all discovered leads in `leads_database.xlsx`.
- 🤖 **AI Personalized Email Pitches**: Integrates with Google Gemini AI (`gemini-1.5-flash`) to generate custom, high-converting cold email copy tailored to the business's niche, location, and strategy.
- ⏸️ **Safe Dev Mode Toggle**: Email dispatch code can be toggled via `ENABLE_EMAIL_DISPATCH="false"` in `.env` to safely log leads during development.

---

## 📁 Project Structure

```text
mail-agent/
├── index.ts                # Main agent execution loop & Google Sheets / Excel sync
├── scraper.ts              # Puppeteer Google Maps browser scraper & contact email crawler
├── test_puppeteer_maps.ts  # Browser automation test script for Google Maps DOM parsing
├── leads_database.xlsx     # Local Excel lead database (auto-created)
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── .env                    # Environment variables & Google Service Account credentials
└── README.md               # Project documentation
```

---

## 📋 Google Sheets & Excel Data Schema (15 Columns)

Every lead is logged with 15 aligned columns:

| Column # | Field Name | Description |
| :---: | :--- | :--- |
| **1** | `Lead ID` | Unique identifier (e.g. `LEAD-MUNJ4VMF`) |
| **2** | `Business Name` | Verified business title extracted from Google Maps |
| **3** | `Strategy` | `Option 1 (New Website Build)` or `Option 2 (Modern Site Redesign)` |
| **4** | `Niche` | Business service category (e.g. `Plumbing Services`) |
| **5** | `City` | Target location (e.g. `San Diego, CA`) |
| **6** | `Contact Email` | Scraped recipient email address (or `N/A`) |
| **7** | `Phone` | Formatted contact phone number |
| **8** | `WhatsApp Link` | Direct WhatsApp link (`https://wa.me/1...`) |
| **9** | `Website URL` | Official website URL (or `No Site`) |
| **10** | `Website Status` | `Missing Website` or `Outdated Site / Redesign Needed` |
| **11** | `Audit Notes` | Detailed findings on where email/site details were discovered |
| **12** | `Outreach Status` | `Logged (Dev Mode)`, `Phone / WhatsApp Logged`, or `Emailed` |
| **13** | `Date Discovered` | Date lead was found (`YYYY-MM-DD`) |
| **14** | `Date Contacted` | ISO timestamp of outreach/logging |
| **15** | `Email Subject` | Personalised cold email subject line |

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher installed
- **Google Cloud Service Account**: Shared editor access to your Google Sheet ID

### 2. Environment Setup (`.env`)

Create a `.env` file in the `mail-agent` directory:

```env
# Agent Configuration
EMAIL_INTERVAL_MINUTES="5"
ENABLE_EMAIL_DISPATCH="false"
EXCEL_FILE_PATH="./leads_database.xlsx"

# Google Sheets API Credentials
GOOGLE_SHEET_ID="1YhJd1789ey_YylxKIABzWcyKK7DY0njqhdlQ0_6vFac"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Google Gemini AI Key (Optional)
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."

# SMTP Email Configuration (For Live Dispatch)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_NAME="Webnexa Digital"
```

---

## ⚙️ Running the Agent

### Start the Autonomous Service
Run the main execution loop:

```bash
cd mail-agent
npm start
```

Or run directly via `tsx`:

```bash
node node_modules/tsx/dist/cli.mjs index.ts
```

---

## 🔄 Workflow Cycle

```
[Agent Cycle Triggered]
        │
        ├── 1. Pick target Niche & City (e.g. Plumbing in San Diego)
        │
        ├── 2. Launch Puppeteer Headless Chrome Browser
        │       └── Navigate to Google Maps search page
        │
        ├── 3. Parse Google Maps Business DOM Elements
        │       ├── Extract Name, Address, Phone & Website URL
        │       └── Generate 1-Click WhatsApp Link (https://wa.me/...)
        │
        ├── 4. Dual Strategy Evaluation
        │       ├── Option 1 (No Site): Pitch new custom website build
        │       └── Option 2 (Has Site): Crawl website & footer for email address
        │                                Verify recipient domain MX DNS records
        │
        ├── 5. Generate Personalised Cold Email (Gemini AI)
        │
        ├── 6. Save Single Row Entry to Local Excel (`leads_database.xlsx`)
        │
        └── 7. Sync Direct to Google Sheets (`google.sheets` v4 JWT Auth)
```

---

## 🛡️ License

MIT License. Designed for Webnexa Digital Lead Generation.
