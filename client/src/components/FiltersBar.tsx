// ─── Filters Bar with Search Suggestions ────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Download, Filter, X, Building, MapPin, Tag, Trash2 } from 'lucide-react'

interface SuggestionMatch {
  text: string
  type: 'business' | 'city' | 'niche'
}

interface FiltersBarProps {
  search: string
  onSearch: (v: string) => void
  statusFilter: string
  onStatus: (v: string) => void
  strategyFilter: string
  onStrategy: (v: string) => void
  total: number
  onExport: () => void
  selectedCount?: number
  onDeleteSelected?: () => void
  isDeletingSelected?: boolean
  suggestions?: {
    businesses?: string[]
    cities?: string[]
    niches?: string[]
  }
}

const STATUSES = [
  'All',
  'Pending',
  'Emailed',
  'Phone / WhatsApp Logged',
  'Logged (Dev Mode)',
  'Failed',
]
const STRATEGIES = ['All', 'Option 1 (New Website Build)', 'Option 2 (Modern Site Redesign)']

export function FiltersBar({
  search,
  onSearch,
  statusFilter,
  onStatus,
  strategyFilter,
  onStrategy,
  total,
  onExport,
  selectedCount = 0,
  onDeleteSelected,
  isDeletingSelected = false,
  suggestions = {},
}: FiltersBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Build searchable suggestion pool
  const matches: SuggestionMatch[] = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || q.length < 1) return []

    const pool: SuggestionMatch[] = []

    suggestions.businesses?.forEach((b) => {
      if (
        b.toLowerCase().includes(q) &&
        !pool.some((p) => p.text.toLowerCase() === b.toLowerCase())
      ) {
        pool.push({ text: b, type: 'business' })
      }
    })

    suggestions.cities?.forEach((c) => {
      if (
        c.toLowerCase().includes(q) &&
        !pool.some((p) => p.text.toLowerCase() === c.toLowerCase())
      ) {
        pool.push({ text: c, type: 'city' })
      }
    })

    suggestions.niches?.forEach((n) => {
      if (
        n.toLowerCase().includes(q) &&
        !pool.some((p) => p.text.toLowerCase() === n.toLowerCase())
      ) {
        pool.push({ text: n, type: 'niche' })
      }
    })

    return pool.slice(0, 8)
  }, [search, suggestions])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="filters-container">
      {/* Search Input with Autocomplete Suggestions */}
      <div ref={containerRef} className="filters-search">
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          className="input"
          style={{ paddingLeft: 32, paddingRight: search ? 30 : 12 }}
          placeholder="Search business, city, niche…"
          value={search}
          onChange={(e) => {
            onSearch(e.target.value)
            setShowDropdown(true)
          }}
          onFocus={() => setShowDropdown(true)}
          id="leads-search"
          autoComplete="off"
        />

        {search && (
          <button
            type="button"
            onClick={() => {
              onSearch('')
              setShowDropdown(false)
            }}
            style={{
              position: 'absolute',
              right: 9,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
            }}
            title="Clear search"
          >
            <X size={13} />
          </button>
        )}

        {/* Suggestion Dropdown */}
        {showDropdown && matches.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 9999,
              padding: 4,
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {matches.map((item, i) => (
              <div
                key={`${item.type}-${item.text}-${i}`}
                onMouseDown={() => {
                  onSearch(item.text)
                  setShowDropdown(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {item.type === 'business' && <Building size={12} color="var(--accent)" />}
                  {item.type === 'city' && <MapPin size={12} color="var(--yellow)" />}
                  {item.type === 'niche' && <Tag size={12} color="var(--green)" />}
                  <span
                    style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                  >
                    {item.text}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'capitalize',
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status filter */}
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <Filter
          size={12}
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <select
          className="select"
          style={{ paddingLeft: 28, width: '100%' }}
          value={statusFilter}
          onChange={(e) => onStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Strategy filter */}
      <div className="filters-select">
        <select
          className="select"
          style={{ width: '100%' }}
          value={strategyFilter}
          onChange={(e) => onStrategy(e.target.value)}
        >
          {STRATEGIES.map((s) => (
            <option key={s}>{s === 'All' ? 'All Strategies' : s}</option>
          ))}
        </select>
      </div>

      {/* Spacer + count & Export */}
      <div className="filters-meta">
        <div>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{total}</span> leads
          {selectedCount !== undefined && selectedCount > 0 && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
              ({selectedCount} selected)
            </span>
          )}
        </div>

        {selectedCount !== undefined && selectedCount > 0 && onDeleteSelected && (
          <button
            className="btn btn-danger btn-sm"
            onClick={onDeleteSelected}
            disabled={isDeletingSelected}
            title={`Delete ${selectedCount} selected leads`}
          >
            <Trash2 size={13} />
            <span>{isDeletingSelected ? 'Deleting…' : `Delete (${selectedCount})`}</span>
          </button>
        )}

        <button
          className="btn btn-ghost btn-sm"
          onClick={onExport}
          title="Export filtered leads as CSV"
        >
          <Download size={13} />
          <span>Export CSV</span>
        </button>
      </div>
    </div>
  )
}
