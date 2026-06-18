'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Play } from 'lucide-react'

interface NewsItem {
  id: string
  title: string
  snippet: string
  url: string
  countries: string[]
  tags: string[]
  date: string
  topicId: string
}

const TOPIC_DEFS = [
  { id: 'carbon-credits',    label: ['CARBON CREDIT', 'MARKETS'],       shortLabel: 'CARBON CREDITS',    color: '#0d9488', key: 'carbon credit markets' },
  { id: 'emissions-trading', label: ['EMISSIONS', 'TRADING SYSTEMS'],   shortLabel: 'EMISSIONS TRADING', color: '#0ea5e9', key: 'emissions trading systems' },
  { id: 'offset-projects',   label: ['CARBON OFFSET', 'PROJECTS'],      shortLabel: 'OFFSET PROJECTS',   color: '#8b5cf6', key: 'carbon offset projects' },
  { id: 'net-zero',          label: ['NET-ZERO', 'COMMITMENTS'],        shortLabel: 'NET-ZERO',          color: '#10b981', key: 'net-zero commitments' },
  { id: 'carbon-pricing',    label: ['CARBON PRICING', 'POLICIES'],     shortLabel: 'CARBON PRICING',    color: '#f59e0b', key: 'carbon pricing policies' },
] as const

const SVG_W = 900
const SVG_H = 480
const CX = 450
const CY = 240
const TOPIC_R_LAYOUT = 130
const ARTICLE_R_LAYOUT = 72
const TOPIC_NODE_R = 13
const ARTICLE_NODE_R = 5

function getTopicPos(idx: number) {
  const angle = (idx / TOPIC_DEFS.length) * 2 * Math.PI - Math.PI / 2
  return { x: CX + TOPIC_R_LAYOUT * Math.cos(angle), y: CY + TOPIC_R_LAYOUT * Math.sin(angle) }
}

function getArticlePos(topicPos: { x: number; y: number }, artIdx: number, total: number) {
  const angleOut = Math.atan2(topicPos.y - CY, topicPos.x - CX)
  const spread = total > 1 ? Math.PI * 0.55 : 0
  const angle = total > 1
    ? (angleOut - spread / 2) + (artIdx / (total - 1)) * spread
    : angleOut
  return {
    x: topicPos.x + ARTICLE_R_LAYOUT * Math.cos(angle),
    y: topicPos.y + ARTICLE_R_LAYOUT * Math.sin(angle),
  }
}

function truncateLabel(title: string, max = 20) {
  const u = title.toUpperCase()
  return u.length <= max ? u : u.slice(0, max - 1) + '…'
}

export default function KnowledgeGraphPage() {
  const [articles, setArticles] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>(TOPIC_DEFS[0].id)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [activeTopics, setActiveTopics] = useState<Record<string, boolean>>(
    Object.fromEntries(TOPIC_DEFS.map(t => [t.id, true]))
  )
  const [timeRange, setTimeRange] = useState<'24H' | '7D' | '30D' | '12MO'>('30D')
  const [pulse, setPulse] = useState(false)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1200)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all(
      TOPIC_DEFS.map(async (topic) => {
        try {
          const res = await fetch(`/api/news?topic=${encodeURIComponent(topic.key)}`)
          const news = await res.json() as { title: string; snippet: string; url: string; countries: string[]; tags: string[]; date: string }[]
          return news.slice(0, 5).map((item, idx) => ({
            id: `${topic.id}-${idx}`,
            title: item.title,
            snippet: item.snippet,
            url: item.url,
            countries: item.countries,
            tags: item.tags,
            date: item.date,
            topicId: topic.id,
          }))
        } catch {
          return []
        }
      })
    ).then(results => {
      setArticles(results.flat())
    }).finally(() => setLoading(false))
  }, [])

  const focusId = hoveredId ?? selectedId
  const topicPositions = TOPIC_DEFS.map((_, i) => getTopicPos(i))

  const articlesByTopic = useMemo(() => {
    const map: Record<string, NewsItem[]> = {}
    for (const t of TOPIC_DEFS) map[t.id] = []
    for (const a of articles) map[a.topicId]?.push(a)
    return map
  }, [articles])

  const getConnected = useCallback((id: string): Set<string> => {
    const s = new Set<string>()
    if (TOPIC_DEFS.find(t => t.id === id)) {
      articlesByTopic[id]?.forEach(a => s.add(a.id))
    } else {
      const art = articles.find(a => a.id === id)
      if (art) s.add(art.topicId)
    }
    return s
  }, [articles, articlesByTopic])

  const connected = focusId ? getConnected(focusId) : new Set<string>()

  const handleSelect = (id: string) => {
    setSelectedId(id)
    if (cardRefs.current[id]) {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const selectedTopic = TOPIC_DEFS.find(t => t.id === selectedId)
  const selectedArticle = articles.find(a => a.id === selectedId)
  const selectedTopicDef = selectedTopic ?? TOPIC_DEFS.find(t => t.id === selectedArticle?.topicId)

  return (
    <div style={{ background: '#070d0c', color: '#d1f5ef', fontFamily: "'Courier New', monospace", minHeight: 'calc(100vh - 44px)' }}>
      <style>{`
        @keyframes obsidian-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes dash { to { stroke-dashoffset: -40; } }
        .edge-flow { stroke-dasharray: 6 4; animation: dash 3s linear infinite; }
        .kg-loading { animation: obsidian-pulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* ─── GRAPH SECTION ─── */}
      <div style={{ display: 'flex', height: '520px', borderBottom: '1px solid #0e3830' }}>

        {/* SVG canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '10px', color: '#3d6b63', letterSpacing: '0.2em' }} className="kg-loading">
                INDEXING SIGNALS...
              </span>
            </div>
          )}

          <svg width="100%" height="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="kg-node-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="kg-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="kg-hub-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id="kg-bg" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#0d2b28" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#070d0c" stopOpacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx={CX} cy={CY} rx="360" ry="240" fill="url(#kg-bg)" />

            {/* Decorative pentagon ring between topics */}
            {TOPIC_DEFS.map((topic, i) => {
              if (!activeTopics[topic.id]) return null
              const next = TOPIC_DEFS[(i + 1) % TOPIC_DEFS.length]
              if (!activeTopics[next.id]) return null
              const p1 = topicPositions[i]
              const p2 = topicPositions[(i + 1) % TOPIC_DEFS.length]
              return (
                <line key={`ring-${i}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="#1a3a35" strokeWidth="0.7" strokeOpacity="0.4"
                />
              )
            })}

            {/* Edges: topic → articles */}
            {TOPIC_DEFS.map((topic, ti) => {
              if (!activeTopics[topic.id]) return null
              const tp = topicPositions[ti]
              const topicArts = articlesByTopic[topic.id] ?? []
              const isFocusTopic = focusId === topic.id
              const isFocusNeighbor = !!(selectedArticle?.topicId === topic.id && focusId !== topic.id)

              return topicArts.map((art, ai) => {
                const ap = getArticlePos(tp, ai, topicArts.length)
                const isActive = isFocusTopic || focusId === art.id || isFocusNeighbor
                return (
                  <line key={`e-${art.id}`}
                    x1={tp.x} y1={tp.y} x2={ap.x} y2={ap.y}
                    stroke={isActive ? topic.color : '#1a3a35'}
                    strokeWidth={isActive ? 1.4 : 0.6}
                    strokeOpacity={isActive ? 0.8 : 0.2}
                    filter={isActive ? 'url(#kg-edge-glow)' : undefined}
                    className={isActive ? 'edge-flow' : undefined}
                  />
                )
              })
            })}

            {/* Article nodes */}
            {TOPIC_DEFS.map((topic, ti) => {
              if (!activeTopics[topic.id]) return null
              const tp = topicPositions[ti]
              const topicArts = articlesByTopic[topic.id] ?? []

              return topicArts.map((art, ai) => {
                const pos = getArticlePos(tp, ai, topicArts.length)
                const isSel = selectedId === art.id
                const isHov = hoveredId === art.id
                const isFoc = isSel || isHov
                const isNeighbor = connected.has(art.id)
                const isDimmed = !!focusId && !isFoc && !isNeighbor

                return (
                  <g key={art.id}
                    transform={`translate(${pos.x},${pos.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSelect(art.id)}
                    onMouseEnter={() => setHoveredId(art.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {isSel && (
                      <circle r={ARTICLE_NODE_R + 7} fill="none"
                        stroke={topic.color} strokeWidth="1"
                        strokeOpacity={pulse ? 0.55 : 0.12}
                        style={{ transition: 'stroke-opacity 1.2s ease' }}
                      />
                    )}
                    <circle r={ARTICLE_NODE_R}
                      fill={topic.color}
                      fillOpacity={isDimmed ? 0.07 : isFoc ? 0.45 : 0.18}
                      stroke={topic.color}
                      strokeWidth={isFoc ? 1.6 : 0.8}
                      strokeOpacity={isDimmed ? 0.12 : isFoc ? 1 : 0.5}
                      filter={isFoc ? 'url(#kg-node-glow)' : undefined}
                      style={{ transition: 'fill-opacity 0.3s, stroke-opacity 0.3s' }}
                    />
                    <circle r={1.8} fill={topic.color} fillOpacity={isFoc ? 1 : 0.55} />
                    <text
                      y={ARTICLE_NODE_R + 10}
                      textAnchor="middle"
                      fill={topic.color} fontSize="6.5"
                      fontFamily="'Courier New', monospace"
                      letterSpacing="0.05em"
                      fillOpacity={isDimmed ? 0.18 : isFoc ? 1 : 0.52}
                      style={{ transition: 'fill-opacity 0.3s', pointerEvents: 'none' }}
                    >
                      {truncateLabel(art.title, 20)}
                    </text>
                  </g>
                )
              })
            })}

            {/* Topic (hub) nodes — rendered on top */}
            {TOPIC_DEFS.map((topic, ti) => {
              if (!activeTopics[topic.id]) return null
              const pos = topicPositions[ti]
              const isSel = selectedId === topic.id
              const isHov = hoveredId === topic.id
              const isFoc = isSel || isHov
              const isNeighbor = connected.has(topic.id)
              const isDimmed = !!focusId && !isFoc && !isNeighbor

              return (
                <g key={topic.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelect(topic.id)}
                  onMouseEnter={() => setHoveredId(topic.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {isSel && (
                    <circle r={TOPIC_NODE_R + 10} fill="none"
                      stroke={topic.color} strokeWidth="1"
                      strokeOpacity={pulse ? 0.5 : 0.12}
                      style={{ transition: 'stroke-opacity 1.2s ease' }}
                    />
                  )}
                  {(isFoc || isSel) && (
                    <circle r={TOPIC_NODE_R + 6} fill={topic.color} fillOpacity="0.07"
                      filter="url(#kg-hub-glow)"
                    />
                  )}
                  <circle r={TOPIC_NODE_R}
                    fill={topic.color}
                    fillOpacity={isDimmed ? 0.08 : isFoc ? 0.38 : 0.2}
                    stroke={topic.color}
                    strokeWidth={isFoc ? 2 : 1.2}
                    strokeOpacity={isDimmed ? 0.12 : isFoc ? 1 : 0.65}
                    filter={isFoc ? 'url(#kg-hub-glow)' : undefined}
                    style={{ transition: 'fill-opacity 0.3s, stroke-opacity 0.3s' }}
                  />
                  <circle r={4} fill={topic.color} fillOpacity={isFoc ? 1 : 0.7} />
                  {topic.label.map((line, li) => (
                    <text key={li}
                      y={TOPIC_NODE_R + 14 + li * 9}
                      textAnchor="middle"
                      fill={topic.color} fontSize="8"
                      fontFamily="'Courier New', monospace"
                      letterSpacing="0.08em" fontWeight="700"
                      fillOpacity={isDimmed ? 0.18 : isFoc ? 1 : 0.72}
                      style={{ transition: 'fill-opacity 0.3s', pointerEvents: 'none' }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div style={{ width: '238px', background: '#060c0b', borderLeft: '1px solid #0e3830', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Topic layer toggles */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #0e3830' }}>
            <div style={{ fontSize: '8.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
              TOPIC LAYERS
              <span style={{ fontSize: '7px', color: loading ? '#f59e0b' : '#10b981' }}>
                {loading ? '● LOADING' : '● LIVE'}
              </span>
            </div>
            {TOPIC_DEFS.map(topic => (
              <div key={topic.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '11px' }}>
                <span style={{ fontSize: '9.5px', color: activeTopics[topic.id] ? topic.color : '#2d4a46', transition: 'color 0.2s' }}>
                  {topic.shortLabel}
                </span>
                <div
                  onClick={() => setActiveTopics(prev => ({ ...prev, [topic.id]: !prev[topic.id] }))}
                  style={{
                    width: '30px', height: '15px', borderRadius: '8px',
                    background: activeTopics[topic.id] ? topic.color + '40' : '#111f1d',
                    border: `1px solid ${activeTopics[topic.id] ? topic.color : '#1e3530'}`,
                    cursor: 'pointer', position: 'relative', flexShrink: 0,
                    transition: 'background 0.25s',
                  }}
                >
                  <div style={{
                    width: '11px', height: '11px', borderRadius: '50%',
                    background: activeTopics[topic.id] ? topic.color : '#2d4a46',
                    position: 'absolute', top: '1px',
                    left: activeTopics[topic.id] ? '16px' : '1px',
                    transition: 'left 0.25s, background 0.25s',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ padding: '14px 16px', flex: 1 }}>
            <div style={{ fontSize: '8.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '14px' }}>
              SIGNAL STATS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {[
                { label: 'TOTAL SIGNALS', value: articles.length },
                { label: 'ACTIVE TOPICS', value: `${Object.values(activeTopics).filter(Boolean).length} / ${TOPIC_DEFS.length}` },
                { label: 'NODES VISIBLE', value: TOPIC_DEFS.filter(t => activeTopics[t.id]).length + articles.filter(a => activeTopics[a.topicId]).length },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '9px', color: '#3d6b63' }}>{row.label}</span>
                  <span style={{ fontSize: '9px', color: '#7ef6e0' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Node analysis bar */}
      <div style={{ background: '#050b0a', borderBottom: '1px solid #0e3830', padding: '10px 18px' }}>
        {selectedTopic ? (
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '7.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '3px' }}>
                TOPIC NODE: {selectedTopic.shortLabel}
              </div>
              <div style={{ fontSize: '10px', color: '#6b9e96' }}>
                {articlesByTopic[selectedTopic.id]?.length ?? 0} article nodes indexed
              </div>
            </div>
            <div>
              <div style={{ fontSize: '7.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '3px' }}>SIGNALS</div>
              <div style={{ fontSize: '18px', color: selectedTopic.color, fontWeight: 700, lineHeight: 1 }}>
                {(articlesByTopic[selectedTopic.id]?.length ?? 0) * 20}%
              </div>
              <div style={{ width: '110px', height: '3px', background: '#111f1d', borderRadius: '2px', marginTop: '5px' }}>
                <div style={{ width: `${(articlesByTopic[selectedTopic.id]?.length ?? 0) * 20}%`, height: '100%', background: `linear-gradient(90deg, ${selectedTopic.color}80, ${selectedTopic.color})`, borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        ) : selectedArticle && selectedTopicDef ? (
          <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '7.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '3px' }}>
                ARTICLE NODE: {truncateLabel(selectedArticle.title, 55)}
              </div>
              <div style={{ fontSize: '10px', color: '#6b9e96' }}>
                Topic: {selectedTopicDef.shortLabel}
                {selectedArticle.countries.length > 0 && ` | ${selectedArticle.countries.slice(0, 3).join(', ')}`}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: '7.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '6px' }}>TAGS</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {selectedArticle.tags.slice(0, 3).map(tag => (
                  <div key={tag} style={{ padding: '3px 8px', background: '#090f0e', border: `1px solid ${selectedTopicDef.color}30`, borderRadius: '2px' }}>
                    <div style={{ fontSize: '8.5px', color: selectedTopicDef.color, fontWeight: 700 }}>{tag.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '9px', color: '#3d6b63' }}>SELECT A NODE TO INSPECT</div>
        )}
      </div>

      {/* Timeline bar */}
      <div style={{ background: '#050b0a', borderBottom: '1px solid #0e3830', height: '42px', display: 'flex', alignItems: 'center', padding: '0 18px', gap: '10px' }}>
        <Play size={13} style={{ color: '#3d6b63', cursor: 'pointer', flexShrink: 0 }} />
        <span style={{ fontSize: '9.5px', color: '#3d6b63', flexShrink: 0 }}>T-04:21:00</span>
        <div style={{ flex: 1, height: '2px', background: '#111f1d', borderRadius: '1px', position: 'relative', cursor: 'pointer' }}>
          <div style={{ width: '65%', height: '100%', background: '#0d9488', borderRadius: '1px' }} />
          <div style={{ position: 'absolute', top: '50%', left: '65%', transform: 'translate(-50%, -50%)', width: '9px', height: '9px', borderRadius: '50%', background: '#7ef6e0', boxShadow: '0 0 6px #7ef6e0' }} />
        </div>
        <div style={{ display: 'flex', gap: '3px' }}>
          {(['24H', '7D', '30D', '12MO'] as const).map(r => (
            <button key={r} onClick={() => setTimeRange(r)}
              style={{
                padding: '2px 8px', fontSize: '8.5px', cursor: 'pointer',
                background: timeRange === r ? 'rgba(13,148,136,0.2)' : 'transparent',
                border: `1px solid ${timeRange === r ? '#0d9488' : '#1a3530'}`,
                color: timeRange === r ? '#7ef6e0' : '#3d6b63',
                borderRadius: '2px', letterSpacing: '0.05em',
                fontFamily: "'Courier New', monospace",
                transition: 'all 0.2s',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ─── NEWS CARDS ─── */}
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
          <div style={{ fontSize: '8.5px', color: '#3d6b63', letterSpacing: '0.14em' }}>
            SIGNAL REPORTS — {articles.length} ITEMS
          </div>
          <div style={{ fontSize: '8px', color: '#3d6b63' }}>GROUPED BY TOPIC</div>
        </div>

        {loading && (
          <div style={{ border: '1px solid rgba(126,246,224,0.12)', background: '#0c0c0c', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', color: 'rgba(126,246,224,0.5)', letterSpacing: '0.2em' }} className="kg-loading">
              ANALYZING CARBON MARKET SIGNALS...
            </span>
          </div>
        )}

        {!loading && TOPIC_DEFS.map(topic => {
          const topicArts = articlesByTopic[topic.id] ?? []
          if (!activeTopics[topic.id] || topicArts.length === 0) return null

          return (
            <div key={topic.id} style={{ marginBottom: '28px' }}>
              {/* Topic section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '10px', paddingBottom: '8px',
                borderBottom: `1px solid ${topic.color}22`,
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: topic.color, flexShrink: 0, boxShadow: `0 0 6px ${topic.color}80` }} />
                <span style={{ fontSize: '9px', color: topic.color, letterSpacing: '0.14em', fontWeight: 700 }}>
                  {topic.shortLabel}
                </span>
                <span style={{ fontSize: '8px', color: '#3d6b63' }}>{topicArts.length} SIGNALS</span>
              </div>

              {/* Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '8px' }}>
                {topicArts.map(article => {
                  const isSel = selectedId === article.id
                  return (
                    <div
                      key={article.id}
                      ref={el => { cardRefs.current[article.id] = el }}
                      onClick={() => handleSelect(article.id)}
                      style={{
                        border: `1px solid ${isSel ? topic.color + '70' : 'rgba(126,246,224,0.1)'}`,
                        background: isSel ? topic.color + '07' : '#0c0c0c',
                        padding: '14px',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                    >
                      <div style={{ fontSize: '7.5px', color: '#3d6b63', letterSpacing: '0.14em', marginBottom: '5px' }}>
                        {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}
                        {article.countries.length > 0 && ` · ${article.countries.slice(0, 2).join(', ').toUpperCase()}`}
                      </div>
                      <div style={{ fontSize: '11px', color: '#d1f5ef', fontWeight: 700, lineHeight: 1.35, marginBottom: '8px' }}>
                        {article.title}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(209,245,239,0.48)', lineHeight: 1.55, marginBottom: '10px' }}>
                        {article.snippet}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {article.tags.slice(0, 3).map(tag => (
                            <span key={tag} style={{
                              fontSize: '7.5px', padding: '2px 6px',
                              border: `1px solid ${topic.color}28`,
                              color: topic.color + '65',
                              letterSpacing: '0.1em',
                            }}>
                              {tag.toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <a href={article.url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: '8.5px', color: topic.color + '80', textDecoration: 'none', letterSpacing: '0.08em', flexShrink: 0, marginLeft: '8px' }}
                        >
                          READ →
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
