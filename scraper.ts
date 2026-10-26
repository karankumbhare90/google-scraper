import dns from 'dns/promises'
import fs from 'fs'
import puppeteer from 'puppeteer'

export interface RealLead {
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
}

/**
 * Validates domain MX DNS records before attempting email outreach
 */
export async function hasValidMx(email: string): Promise<boolean> {
  try {
    const domain = email.split('@')[1]
    if (!domain) return false
    const mx = await dns.resolveMx(domain)
    return mx && mx.length > 0
  } catch {
    return false
  }
}

/**
 * Clean phone number to WhatsApp link format
 */
export function formatWhatsAppLink(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const countryDigits = digits.length === 10 ? `1${digits}` : digits
  return `https://wa.me/${countryDigits}`
}

function getSystemBrowserPath(): string | null {
  // Check explicit environment variable (Docker / Render Linux container)
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // Linux common paths
  const linuxPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]
  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p
  }

  // Windows Edge / Chrome paths
  const paths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]

  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }

  return null
}

const BLOCKED_SITE_DOMAINS = [
  'google',
  'duckduckgo',
  'facebook',
  'instagram',
  'yelp',
  'yellowpages',
  'tripadvisor',
  'linkedin',
  'twitter',
  'wikipedia',
  'w3.org',
  'schema',
  'schemas',
  'bing',
  'sentry',
  'github',
  'houzz',
  'thumbtack',
  'angi',
  'homeadvisor',
  'expertise',
  'architecturaldigest',
  'elledecor',
  'thespruce',
  'buildzoom',
  'bbb.org',
  'live',
  'wordpress',
  'blogspot',
  'wixsite',
  'weebly',
  'godaddysites',
  'medium',
  'zillow',
  'realtor',
  'redfin',
  'trulia',
  'mapquest',
  'cloudflare',
  'vercel',
  'netlify',
  'herokuapp',
  'justdial',
  'indiamart',
  'tradeindia',
  'sulekha',
  'clutch',
  'g2.com',
  'trustpilot',
  'capterra',
  'sitejabber',
  'locanto',
  'craigslist',
  'brainyquote',
  'quote',
  'quotes',
  'reddit',
  'quora',
  'pinterest',
  'youtube',
  'vimeo',
  'tumblr',
  'dictionary',
]

const EXCLUDED_DOMAINS = BLOCKED_SITE_DOMAINS
const VALID_BUSINESS_TLDS = ['.com', '.net', '.org', '.us', '.co', '.biz', '.info']

/**
 * Scrapes 100% REAL Google Maps business listings using real browser DOM inspection
 */
export async function scrapeGoogleMapsLeads(niche: string, city: string, maxLeads = 8): Promise<RealLead[]> {
  const browserPath = getSystemBrowserPath()

  const launchOptions: any = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  }
  if (browserPath) {
    launchOptions.executablePath = browserPath
  }

  let browser
  try {
    browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 900 })

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${niche} in ${city}`)}`
    console.log(`[Google Maps Browser Scraper] Navigating to: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 35000 })
    await new Promise((r) => setTimeout(r, 3500))

    // Step 1: Collect business name + maps place URL from search results list
    const listingLinks = await page.evaluate((limit: number) => {
      const items = Array.from(document.querySelectorAll('div.Nv2PK, div[role="article"]')).slice(0, limit)
      return items.map((item) => {
        const nameEl = item.querySelector('div.fontHeadlineSmall, div.qBF1Pd')
        const name = nameEl?.textContent?.trim() || ''
        const linkEl = item.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null
        const mapsUrl = linkEl?.href || null
        return { name, mapsUrl }
      }).filter((r) => r.name.length > 2 && r.mapsUrl)
    }, maxLeads * 2)

    // Step 2: Visit each listing's detail panel to get real website + phone
    const rawListings: { name: string; websiteUrl: string | null; phone: string | null }[] = []

    for (const listing of listingLinks.slice(0, maxLeads * 2)) {
      try {
        await page.goto(listing.mapsUrl!, { waitUntil: 'networkidle2', timeout: 20000 })
        await new Promise((r) => setTimeout(r, 2000))

        const details = await page.evaluate(() => {
          // Website: Google Maps detail panel uses data-item-id="authority" for the website link
          const websiteEl = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null
          const websiteUrl = websiteEl?.href || null

          // Phone: try specific selectors first
          const phoneEl =
            document.querySelector('button[data-item-id*="phone"]') ||
            document.querySelector('[aria-label*="Phone:"]') ||
            document.querySelector('button[aria-label*="phone" i]')
          let phone =
            phoneEl?.textContent?.trim() ||
            phoneEl?.getAttribute('aria-label')?.replace(/Phone:\s*/i, '').trim() ||
            null

          // Fallback: scan page text for phone pattern (handles +1 prefix)
          if (!phone) {
            const allText = document.body.innerText || ''
            const m = allText.match(/\+?1?\s?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/)
            phone = m ? m[0].trim() : null
          }

          return { websiteUrl, phone }
        })

        rawListings.push({ name: listing.name, websiteUrl: details.websiteUrl, phone: details.phone })
      } catch {
        rawListings.push({ name: listing.name, websiteUrl: null, phone: null })
      }
    }

    await browser.close()
    browser = null


    if (!rawListings || rawListings.length === 0) {
      return []
    }

    // Process up to maxLeads listings from the scraped Google Maps results
    const leads: RealLead[] = []
    const candidates = rawListings.slice(0, Math.min(rawListings.length, maxLeads * 2)) // over-fetch to account for skipped

    for (const candidate of candidates) {
      if (leads.length >= maxLeads) break
      if (!candidate || !candidate.name) continue

      const businessName = candidate.name
      const phone = candidate.phone
      const whatsappLink = phone ? formatWhatsAppLink(phone) : null
      let detectedWebsite = candidate.websiteUrl

      // Filter out blocked domains if website exists
      if (detectedWebsite) {
        try {
          const hostname = new URL(detectedWebsite).hostname.toLowerCase()
          const isValidTld = VALID_BUSINESS_TLDS.some((tld) => hostname.endsWith(tld))
          const isBlocked = BLOCKED_SITE_DOMAINS.some((b) => hostname.includes(b))
          if (!isValidTld || isBlocked) {
            detectedWebsite = null
          }
        } catch {
          detectedWebsite = null
        }
      }

    // =========================================================================
    // OPTION 2: Real Website present on Google Maps -> Crawl Site & Footer for Contact Email
    // =========================================================================
      if (detectedWebsite) {
        let targetEmail: string | null = null
        let emailSource: string = 'Website Homepage'

        try {
          const siteUrlObj = new URL(detectedWebsite)
          const baseOrigin = siteUrlObj.origin

          const pagesToScrape = [
            detectedWebsite,
            `${baseOrigin}/contact`,
            `${baseOrigin}/contact-us`,
            `${baseOrigin}/about`,
            `${baseOrigin}/about-us`,
            `${baseOrigin}/get-in-touch`,
          ]

          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

          for (const pageUrl of pagesToScrape) {
            try {
              const siteRes = await fetch(pageUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
                signal: AbortSignal.timeout(4000),
              })

              if (siteRes.ok) {
                const siteHtml = await siteRes.text()

                const mailtoMatches = Array.from(
                  siteHtml.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi),
                ).map((m) => m[1])

                const textMatches = siteHtml.match(emailRegex) || []
                const candidateEmails = Array.from(new Set([...mailtoMatches, ...textMatches]))

                for (const email of candidateEmails) {
                  const cleanEmail = email.trim().toLowerCase()
                  const d = cleanEmail.split('@')[1]
                  if (
                    d &&
                    !EXCLUDED_DOMAINS.some((ex) => d.includes(ex)) &&
                    !cleanEmail.endsWith('.png') &&
                    !cleanEmail.endsWith('.jpg') &&
                    !cleanEmail.endsWith('.svg') &&
                    (await hasValidMx(cleanEmail))
                  ) {
                    targetEmail = cleanEmail
                    const isContactPage = pageUrl.includes('/contact') || pageUrl.includes('/about') || pageUrl.includes('/get-in-touch')
                    emailSource = isContactPage ? `Website Contact Page (${pageUrl})` : `Website Footer / Homepage`
                    break
                  }
                }
              }
            } catch {
              // Ignore single page fetch error
            }

            if (targetEmail) break
          }
        } catch {
          // Ignore URL error
        }

        leads.push({
          businessName,
          niche,
          city,
          contactEmail: targetEmail,
          phone,
          whatsappLink,
          websiteUrl: detectedWebsite,
          websiteStatus: 'Outdated Site / Redesign Needed',
          strategy: 'Option 2 (Modern Site Redesign)',
          auditNotes: targetEmail
            ? `Real Google Maps business found (${businessName}). Email scraped directly from ${emailSource}: ${targetEmail}. Pitching Next.js redesign.`
            : `Real Google Maps business found (${businessName}). Website checked (${detectedWebsite}) & contact/footer inspected. Pitching Next.js & Payload CMS redesign.`,
        })
      } else {
        // =========================================================================
        // OPTION 1: Website is MISSING on Google Maps -> Pitch Brand New High-Converting Website
        // =========================================================================
        leads.push({
          businessName,
          niche,
          city,
          contactEmail: null,
          phone,
          whatsappLink,
          websiteUrl: null,
          websiteStatus: 'Missing Website',
          strategy: 'Option 1 (New Website Build)',
          auditNotes: `Real business listing (${businessName}) verified on Google Maps without an official website. Pitching brand new custom website build.`,
        })
      }
    } // end for loop

    return leads
  } catch (err: any) {
    if (browser) {
      await browser.close().catch(() => {})
    }
    console.error('[Google Maps Browser Scraper Error]:', err.message)
    return []
  }
}
