// ─── Scrape Job Modal with Searchable & Suggestionable Inputs ────────────────
import { useState, useMemo } from 'react'
import { X, Loader2, Search, Zap, MapPin, Briefcase } from 'lucide-react'
import { triggerScrape } from '../services/api'
import type { Lead } from '../types'
import { AutocompleteInput, type SuggestionItem } from './AutocompleteInput'

const PRESETS = [
  { flag: '🇺🇸', label: 'New York • Plumber', niche: 'Plumbing Services', city: 'New York, NY, USA' },
  { flag: '🇺🇸', label: 'Austin • HVAC', niche: 'HVAC & Air Conditioning Repair', city: 'Austin, TX, USA' },
  { flag: '🇺🇸', label: 'Miami • Auto Repair', niche: 'Auto Repair & Detailing Shops', city: 'Miami, FL, USA' },
  { flag: '🇺🇸', label: 'Chicago • Cleaning', niche: 'House Cleaning & Maid Services', city: 'Chicago, IL, USA' },
  { flag: '🇬🇧', label: 'London • Bakery', niche: 'Local Bakery & Catering Services', city: 'London, UK' },
  { flag: '🇦🇪', label: 'Dubai • Interior', niche: 'Interior Designers & Decorators', city: 'Dubai, UAE' },
  { flag: '🇮🇳', label: 'Ahmedabad • Dental', niche: 'Dental Clinics & Orthodontics', city: 'Ahmedabad, Gujarat, India' },
  { flag: '🇮🇳', label: 'Jaipur • Jewelry', niche: 'Jewelry & Gemstone Stores', city: 'Jaipur, Rajasthan, India' },
]

const DEFAULT_NICHES: SuggestionItem[] = [
  { value: 'Plumbing Services', label: 'Plumbing Services', category: 'Home Services' },
  { value: 'HVAC & Air Conditioning Repair', label: 'HVAC & Air Conditioning Repair', category: 'Home Services' },
  { value: 'Roofing Contractors', label: 'Roofing Contractors', category: 'Construction' },
  { value: 'Electrician Services', label: 'Electrician Services', category: 'Home Services' },
  { value: 'Landscaping & Lawn Care Services', label: 'Landscaping & Lawn Care', category: 'Outdoor' },
  { value: 'House Cleaning & Maid Services', label: 'House Cleaning & Maid Services', category: 'Cleaning' },
  { value: 'Auto Repair & Detailing Shops', label: 'Auto Repair & Detailing Shops', category: 'Automotive' },
  { value: 'Dental Clinics & Orthodontics', label: 'Dental Clinics & Orthodontics', category: 'Healthcare' },
  { value: 'Pet Grooming & Veterinary Clinics', label: 'Pet Grooming & Veterinary', category: 'Pet Care' },
  { value: 'Local Bakery & Catering Services', label: 'Local Bakery & Catering', category: 'Food & Dining' },
  { value: 'Boutique Gyms & Fitness Centers', label: 'Boutique Gyms & Fitness', category: 'Fitness & Health' },
  { value: 'Interior Designers & Decorators', label: 'Interior Designers & Decorators', category: 'Architecture & Design' },
  { value: 'Cosmetic & Skin Care Clinics', label: 'Cosmetic & Skin Care Clinics', category: 'Beauty & Wellness' },
  { value: 'Solar Panel Installation', label: 'Solar Panel Installation', category: 'Renewable Energy' },
  { value: 'Pest Control Services', label: 'Pest Control Services', category: 'Home Services' },
  { value: 'Painting & Drywall Contractors', label: 'Painting & Drywall Contractors', category: 'Construction' },
  { value: 'Real Estate Agencies', label: 'Real Estate Agencies & Realtors', category: 'Property' },
  { value: 'Locksmith & Security Services', label: 'Locksmith & Security Services', category: 'Security' },
  { value: 'Flooring & Tile Installation', label: 'Flooring & Tile Installation', category: 'Home Renovation' },
  { value: 'Handyman & Remodeling Contractors', label: 'Handyman & Remodeling', category: 'Home Services' },
  { value: 'Chiropractors & Physical Therapy', label: 'Chiropractors & Physical Therapy', category: 'Healthcare' },
  { value: 'Coffee Shops & Specialty Roasters', label: 'Coffee Shops & Specialty Roasters', category: 'Food & Dining' },
]

const DEFAULT_CITIES: SuggestionItem[] = [
  // United States
  { value: 'Austin, TX, USA', label: '🇺🇸 Austin, TX, USA', category: 'United States' },
  { value: 'New York, NY, USA', label: '🇺🇸 New York, NY, USA', category: 'United States' },
  { value: 'Miami, FL, USA', label: '🇺🇸 Miami, FL, USA', category: 'United States' },
  { value: 'Los Angeles, CA, USA', label: '🇺🇸 Los Angeles, CA, USA', category: 'United States' },
  { value: 'Chicago, IL, USA', label: '🇺🇸 Chicago, IL, USA', category: 'United States' },
  { value: 'Houston, TX, USA', label: '🇺🇸 Houston, TX, USA', category: 'United States' },
  { value: 'Phoenix, AZ, USA', label: '🇺🇸 Phoenix, AZ, USA', category: 'United States' },
  { value: 'Dallas, TX, USA', label: '🇺🇸 Dallas, TX, USA', category: 'United States' },
  { value: 'San Diego, CA, USA', label: '🇺🇸 San Diego, CA, USA', category: 'United States' },
  { value: 'Seattle, WA, USA', label: '🇺🇸 Seattle, WA, USA', category: 'United States' },
  { value: 'Denver, CO, USA', label: '🇺🇸 Denver, CO, USA', category: 'United States' },
  { value: 'Atlanta, GA, USA', label: '🇺🇸 Atlanta, GA, USA', category: 'United States' },
  { value: 'Orlando, FL, USA', label: '🇺🇸 Orlando, FL, USA', category: 'United States' },
  { value: 'Boston, MA, USA', label: '🇺🇸 Boston, MA, USA', category: 'United States' },
  { value: 'Las Vegas, NV, USA', label: '🇺🇸 Las Vegas, NV, USA', category: 'United States' },
  // United Kingdom & Europe
  { value: 'London, UK', label: '🇬🇧 London, UK', category: 'United Kingdom' },
  { value: 'Manchester, UK', label: '🇬🇧 Manchester, UK', category: 'United Kingdom' },
  { value: 'Birmingham, UK', label: '🇬🇧 Birmingham, UK', category: 'United Kingdom' },
  // Canada & Australia
  { value: 'Toronto, ON, Canada', label: '🇨🇦 Toronto, ON, Canada', category: 'Canada' },
  { value: 'Vancouver, BC, Canada', label: '🇨🇦 Vancouver, BC, Canada', category: 'Canada' },
  { value: 'Sydney, NSW, Australia', label: '🇦🇺 Sydney, NSW, Australia', category: 'Australia' },
  { value: 'Melbourne, VIC, Australia', label: '🇦🇺 Melbourne, VIC, Australia', category: 'Australia' },
  // Middle East & Asia
  { value: 'Dubai, UAE', label: '🇦🇪 Dubai, UAE', category: 'United Arab Emirates' },
  { value: 'Singapore', label: '🇸🇬 Singapore', category: 'Singapore' },
  // India
  { value: 'Ahmedabad, Gujarat, India', label: '🇮🇳 Ahmedabad, Gujarat, India', category: 'India' },
  { value: 'Mumbai, Maharashtra, India', label: '🇮🇳 Mumbai, Maharashtra, India', category: 'India' },
  { value: 'Delhi NCR, India', label: '🇮🇳 Delhi NCR, India', category: 'India' },
  { value: 'Bangalore, Karnataka, India', label: '🇮🇳 Bangalore, Karnataka, India', category: 'India' },
  { value: 'Pune, Maharashtra, India', label: '🇮🇳 Pune, Maharashtra, India', category: 'India' },
  { value: 'Hyderabad, Telangana, India', label: '🇮🇳 Hyderabad, Telangana, India', category: 'India' },
  { value: 'Jaipur, Rajasthan, India', label: '🇮🇳 Jaipur, Rajasthan, India', category: 'India' },
  { value: 'Chennai, Tamil Nadu, India', label: '🇮🇳 Chennai, Tamil Nadu, India', category: 'India' },
  { value: 'Surat, Gujarat, India', label: '🇮🇳 Surat, Gujarat, India', category: 'India' },
]

interface CreateJobModalProps {
  onClose: () => void
  onSuccess: (leads: Lead[]) => void
  onToast: (msg: string, type: 'success' | 'error') => void
  existingNiches?: string[]
  existingCities?: string[]
}

export function CreateJobModal({
  onClose,
  onSuccess,
  onToast,
  existingNiches = [],
  existingCities = [],
}: CreateJobModalProps) {
  const [niche, setNiche] = useState('')
  const [city, setCity] = useState('')
  const [maxLeads, setMaxLeads] = useState(8)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(0)

  // Merge presets with existing data
  const allNiches: SuggestionItem[] = useMemo(() => {
    const custom = existingNiches
      .filter((n) => !DEFAULT_NICHES.some((d) => d.value.toLowerCase() === n.toLowerCase()))
      .map((n) => ({ value: n, label: n, category: 'From your Leads' }))
    return [...custom, ...DEFAULT_NICHES]
  }, [existingNiches])

  const allCities: SuggestionItem[] = useMemo(() => {
    const custom = existingCities
      .filter((c) => !DEFAULT_CITIES.some((d) => d.value.toLowerCase() === c.toLowerCase()))
      .map((c) => ({ value: c, label: `📍 ${c}`, category: 'From your Leads' }))
    return [...custom, ...DEFAULT_CITIES]
  }, [existingCities])

  function applyPreset(p: typeof PRESETS[0]) {
    setNiche(p.niche)
    setCity(p.city)
  }

  async function handleScrape() {
    if (!niche.trim() || !city.trim()) {
      onToast('Please fill in both Niche and City.', 'error')
      return
    }
    setLoading(true)
    setProgress(10)
    setPhase('Initializing scraper...')

    const phases = [
      [20, 'Launching headless browser...'],
      [40, 'Searching Google Maps...'],
      [60, 'Extracting business listings...'],
      [75, 'Visiting business detail pages...'],
      [88, 'Crawling websites for emails...'],
      [95, 'Saving to database & sheets...'],
    ]

    let phaseIdx = 0
    const interval = setInterval(() => {
      if (phaseIdx < phases.length) {
        setProgress(phases[phaseIdx][0] as number)
        setPhase(phases[phaseIdx][1] as string)
        phaseIdx++
      }
    }, 3500)

    try {
      const result = await triggerScrape({ niche, city, maxLeads })
      clearInterval(interval)
      setProgress(100)
      setPhase('Complete!')
      onToast(`✅ ${result.total} leads discovered and saved!`, 'success')
      onSuccess(result.leads)
      setTimeout(onClose, 800)
    } catch (err: any) {
      clearInterval(interval)
      onToast(`❌ Scrape failed: ${err.message}`, 'error')
      setLoading(false)
      setPhase('')
      setProgress(0)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Search size={18} color="var(--accent)" />
            <span className="modal-title">New Search Job</span>
          </div>
          {!loading && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Presets */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Target Presets
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => applyPreset(p)}
                disabled={loading}
                style={{ fontSize: 11, padding: '3px 8px' }}
              >
                {p.flag} {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" style={{ margin: '14px 0' }} />

        {/* Searchable & Suggestionable Fields */}
        <div className="modal-grid-2">
          <AutocompleteInput
            label="Business Niche / Category"
            placeholder="Type or select niche..."
            value={niche}
            onChange={setNiche}
            suggestions={allNiches}
            icon={<Briefcase size={14} />}
            disabled={loading}
            id="job-niche-input"
          />

          <AutocompleteInput
            label="City / Location"
            placeholder="Type or select city..."
            value={city}
            onChange={setCity}
            suggestions={allCities}
            icon={<MapPin size={14} />}
            disabled={loading}
            id="job-city-input"
          />
        </div>

        {/* Max Leads Slider */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>Max Leads to Discover</span>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{maxLeads} leads</span>
          </label>
          <input
            type="range" min={2} max={20} value={maxLeads}
            onChange={(e) => setMaxLeads(Number(e.target.value))}
            disabled={loading}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', marginTop: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            <span>2 (Quick audit)</span>
            <span>20 (Deep exploration)</span>
          </div>
        </div>

        {/* Progress */}
        {loading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{phase}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              ⚠️ Headless Google Maps crawler in progress. Please keep this open…
            </div>
          </div>
        )}

        {/* Info box */}
        {!loading && (
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 18,
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <strong style={{ color: 'var(--accent)' }}>Discovery Engine: </strong>
            Real Google Maps listings will be audited, contact emails crawled, and automatically saved to MongoDB, Google Sheets & Excel.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-between">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleScrape} disabled={loading} id="start-scrape-btn">
            {loading ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
            {loading ? 'Scraping...' : 'Start Discovery'}
          </button>
        </div>
      </div>
    </div>
  )
}
