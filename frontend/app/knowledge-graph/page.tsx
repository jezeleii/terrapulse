'use client'

import { useState, useEffect, useRef } from 'react'
import * as d3 from 'd3'

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'standard' | 'project_type' | 'mechanism' | 'concept' | 'actor' | 'article'

interface GNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: NodeType
  description?: string
  url?: string
  date?: string
}

interface GLink extends d3.SimulationLinkDatum<GNode> {
  rel?: string
}

// ─── Visual config per node type ──────────────────────────────────────────────

const TYPE_CFG: Record<NodeType, {
  color: string
  symbol: d3.SymbolType
  area: number
  collideR: number
  layer: string
}> = {
  standard:     { color: '#0d9488', symbol: d3.symbolStar,     area: 220, collideR: 18, layer: 'REGISTRIES & STANDARDS' },
  project_type: { color: '#8b5cf6', symbol: d3.symbolCircle,   area: 150, collideR: 14, layer: 'PROJECT TYPES' },
  mechanism:    { color: '#0ea5e9', symbol: d3.symbolDiamond,  area: 150, collideR: 14, layer: 'MARKET MECHANISMS' },
  concept:      { color: '#f59e0b', symbol: d3.symbolSquare,   area: 110, collideR: 12, layer: 'CORE CONCEPTS' },
  actor:        { color: '#10b981', symbol: d3.symbolTriangle, area: 130, collideR: 13, layer: 'MARKET ACTORS' },
  article:      { color: '#f87171', symbol: d3.symbolCircle,   area: 55,  collideR: 9,  layer: 'NEWS SIGNALS' },
}

// ─── Static VCM knowledge graph ───────────────────────────────────────────────

const STATIC_NODES: GNode[] = [
  // Registries / Standards
  { id: 'verra-vcs',         label: 'Verra VCS',              type: 'standard',     description: 'Largest voluntary carbon standard. Issues Verified Carbon Units (VCUs). Governs REDD+, Blue Carbon, IFM, and agricultural projects globally.' },
  { id: 'gold-standard',     label: 'Gold Standard',           type: 'standard',     description: 'High-integrity standard emphasising sustainable development co-benefits alongside GHG reductions. Strong in cookstoves and renewables.' },
  { id: 'acr',               label: 'ACR',                     type: 'standard',     description: 'American Carbon Registry. First private voluntary offset program in the U.S. Recognised under California AB32.' },
  { id: 'car',               label: 'CAR',                     type: 'standard',     description: 'Climate Action Reserve. North America–focused with rigorous protocols for agriculture, waste, and forestry.' },
  { id: 'plan-vivo',         label: 'Plan Vivo',               type: 'standard',     description: 'Community-based standard for smallholder land use and agroforestry in the Global South. Emphasises livelihoods.' },
  { id: 'corsia',            label: 'CORSIA',                  type: 'standard',     description: 'ICAO Carbon Offsetting Scheme for International Aviation. Compliance-linked demand driver for approved offsets.' },

  // Project types
  { id: 'redd-plus',         label: 'REDD+',                   type: 'project_type', description: 'Reducing Emissions from Deforestation and Degradation. UN-backed framework for tropical forest protection. Largest project category by volume.' },
  { id: 'blue-carbon',       label: 'Blue Carbon',             type: 'project_type', description: 'Mangroves, seagrasses, and salt marshes sequestering carbon in coastal marine environments. High biodiversity co-benefits.' },
  { id: 'ifm',               label: 'Improved Forest Mgmt',    type: 'project_type', description: 'Changes to forest management practices increasing carbon stocks vs. baseline. Common in North America under ACR and Verra.' },
  { id: 'renewable-energy',  label: 'Renewable Energy',        type: 'project_type', description: 'Wind, solar, and hydro projects displacing fossil fuel grid electricity. Dominant by volume historically, declining under additionality scrutiny.' },
  { id: 'methane-capture',   label: 'Methane Capture',         type: 'project_type', description: 'Landfill gas, coal mine methane, and livestock destruction projects. High GWP impact per tonne CO₂e.' },
  { id: 'clean-cookstoves',  label: 'Clean Cookstoves',        type: 'project_type', description: 'Efficient stove distribution replacing biomass burning. Strong health, gender equity, and SDG co-benefits.' },
  { id: 'soil-carbon',       label: 'Soil Carbon',             type: 'project_type', description: 'Regenerative agricultural practices sequestering carbon in soils. Permanence and measurement remain key integrity challenges.' },
  { id: 'biochar',           label: 'Biochar',                 type: 'project_type', description: 'Pyrolysis-derived stable carbon material. High permanence makes it attractive for CDR buyers; fast-growing premium market.' },

  // Market mechanisms
  { id: 'voluntary-market',  label: 'Voluntary Market (VCM)',  type: 'mechanism',    description: 'Corporate and individual offsetting beyond compliance obligations. Driven by net-zero pledges and ESG commitments. ~$2B/yr at peak.' },
  { id: 'compliance-market', label: 'Compliance Markets',      type: 'mechanism',    description: 'Mandatory cap-and-trade: EU ETS (~€800B/yr), California, RGGI, UK ETS. Largest carbon market by value by far.' },
  { id: 'article-6-2',       label: 'Article 6.2',             type: 'mechanism',    description: 'Bilateral ITMO trading between sovereign countries under Paris Agreement. Enables carbon accounting transfers between NDCs.' },
  { id: 'article-6-4',       label: 'Article 6.4',             type: 'mechanism',    description: 'UN-supervised crediting mechanism; successor to CDM under Paris Agreement. Establishes global centralised carbon market.' },
  { id: 'cdm',               label: 'CDM (legacy)',             type: 'mechanism',    description: 'Clean Development Mechanism under Kyoto Protocol. ~300M legacy CERs transitioning to Article 6.4 via UNFCCC transition process.' },

  // Core concepts
  { id: 'additionality',     label: 'Additionality',           type: 'concept',      description: 'Emissions reductions must be additional to what would have occurred without carbon finance — the foundational integrity test for all projects.' },
  { id: 'permanence',        label: 'Permanence',              type: 'concept',      description: 'Sequestered carbon must remain stored long-term. Buffer pools, insurance mechanisms, and permanence periods address reversal risk.' },
  { id: 'co-benefits',       label: 'Co-benefits (SDGs)',      type: 'concept',      description: 'Biodiversity, livelihoods, water, and health benefits beyond carbon that increasingly drive premium pricing and buyer preference.' },
  { id: 'leakage',           label: 'Leakage',                 type: 'concept',      description: 'Displacement of emissions outside project boundary (e.g., deforestation moves elsewhere). Must be quantified and deducted from issued credits.' },
  { id: 'mrv',               label: 'MRV',                     type: 'concept',      description: 'Monitoring, Reporting & Verification — the technical and audit backbone underpinning carbon credit integrity and investor trust.' },
  { id: 'baseline',          label: 'Baseline Setting',        type: 'concept',      description: 'Counterfactual emissions scenario defining what would happen without the project. Conservative baselines improve credibility and resist gaming.' },

  // Market actors
  { id: 'project-developer', label: 'Project Developers',      type: 'actor',        description: 'Originate, implement, and manage carbon projects. Handle registration, monitoring, and credit issuance through registries.' },
  { id: 'vvb',               label: 'Verifiers (VVBs)',        type: 'actor',        description: 'Third-party Validation & Verification Bodies accredited by standards to independently audit project claims and credit issuance.' },
  { id: 'corporate-buyer',   label: 'Corporate Buyers',        type: 'actor',        description: 'Companies purchasing credits to support net-zero and science-based targets. Primary demand driver for high-quality project types.' },
  { id: 'broker',            label: 'Carbon Brokers',          type: 'actor',        description: 'Market intermediaries connecting developers and buyers. Provide liquidity, deal structuring, and price discovery services.' },
  { id: 'government',        label: 'Governments / NDCs',      type: 'actor',        description: 'Set national policy frameworks and NDCs. Operate compliance markets and engage in Article 6 bilateral ITMO transactions.' },
]

const STATIC_LINKS: { source: string; target: string; rel?: string }[] = [
  // Standards → project types they certify
  { source: 'verra-vcs',         target: 'redd-plus',           rel: 'certifies' },
  { source: 'verra-vcs',         target: 'blue-carbon',         rel: 'certifies' },
  { source: 'verra-vcs',         target: 'ifm',                 rel: 'certifies' },
  { source: 'verra-vcs',         target: 'soil-carbon',         rel: 'certifies' },
  { source: 'verra-vcs',         target: 'biochar',             rel: 'certifies' },
  { source: 'gold-standard',     target: 'renewable-energy',    rel: 'certifies' },
  { source: 'gold-standard',     target: 'clean-cookstoves',    rel: 'certifies' },
  { source: 'acr',               target: 'methane-capture',     rel: 'certifies' },
  { source: 'acr',               target: 'ifm',                 rel: 'certifies' },
  { source: 'car',               target: 'methane-capture',     rel: 'certifies' },
  { source: 'car',               target: 'soil-carbon',         rel: 'certifies' },
  { source: 'plan-vivo',         target: 'ifm',                 rel: 'certifies' },
  { source: 'plan-vivo',         target: 'soil-carbon',         rel: 'certifies' },
  { source: 'corsia',            target: 'voluntary-market',    rel: 'accesses' },

  // Project types → integrity concepts they depend on
  { source: 'redd-plus',         target: 'additionality' },
  { source: 'redd-plus',         target: 'permanence' },
  { source: 'redd-plus',         target: 'leakage' },
  { source: 'redd-plus',         target: 'mrv' },
  { source: 'redd-plus',         target: 'baseline' },
  { source: 'blue-carbon',       target: 'permanence' },
  { source: 'blue-carbon',       target: 'co-benefits' },
  { source: 'blue-carbon',       target: 'mrv' },
  { source: 'ifm',               target: 'additionality' },
  { source: 'ifm',               target: 'baseline' },
  { source: 'renewable-energy',  target: 'additionality' },
  { source: 'renewable-energy',  target: 'baseline' },
  { source: 'methane-capture',   target: 'mrv' },
  { source: 'methane-capture',   target: 'baseline' },
  { source: 'clean-cookstoves',  target: 'co-benefits' },
  { source: 'clean-cookstoves',  target: 'additionality' },
  { source: 'soil-carbon',       target: 'permanence' },
  { source: 'soil-carbon',       target: 'mrv' },
  { source: 'biochar',           target: 'permanence' },

  // Mechanism relationships
  { source: 'cdm',               target: 'article-6-4',         rel: 'evolved into' },
  { source: 'article-6-4',       target: 'voluntary-market',    rel: 'supplements' },
  { source: 'article-6-2',       target: 'compliance-market',   rel: 'links' },
  { source: 'government',        target: 'article-6-2',         rel: 'governs' },
  { source: 'government',        target: 'article-6-4',         rel: 'governs' },
  { source: 'government',        target: 'compliance-market',   rel: 'operates' },

  // Actor relationships
  { source: 'project-developer', target: 'vvb',                 rel: 'verified by' },
  { source: 'vvb',               target: 'verra-vcs',           rel: 'accredited by' },
  { source: 'vvb',               target: 'gold-standard',       rel: 'accredited by' },
  { source: 'corporate-buyer',   target: 'voluntary-market',    rel: 'buys from' },
  { source: 'broker',            target: 'voluntary-market',    rel: 'facilitates' },
  { source: 'project-developer', target: 'voluntary-market',    rel: 'sells into' },
  { source: 'project-developer', target: 'compliance-market',   rel: 'sells into' },
]

// Which static nodes news articles connect to, by topic keyword
const TOPIC_ANCHORS: Record<string, string[]> = {
  'carbon credit markets':    ['voluntary-market', 'verra-vcs', 'corporate-buyer'],
  'emissions trading systems':['compliance-market', 'article-6-2', 'government'],
  'carbon offset projects':   ['redd-plus', 'blue-carbon', 'project-developer'],
  'net-zero commitments':     ['corporate-buyer', 'co-benefits', 'voluntary-market'],
  'carbon pricing policies':  ['compliance-market', 'article-6-4', 'government'],
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeGraphPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<d3.Simulation<GNode, undefined> | null>(null)

  const [selectedNode, setSelectedNode] = useState<GNode | null>(null)
  const [activeTypes, setActiveTypes] = useState<Record<NodeType, boolean>>({
    standard: true, project_type: true, mechanism: true,
    concept: true, actor: true, article: true,
  })
  const [articles, setArticles] = useState<GNode[]>([])
  const [articleLinks, setArticleLinks] = useState<{ source: string; target: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })

  // Fetch news articles
  useEffect(() => {
    Promise.all(
      Object.keys(TOPIC_ANCHORS).map(async (topic) => {
        try {
          const res = await fetch(`/api/news?topic=${encodeURIComponent(topic)}`)
          const news = await res.json() as { title: string; url: string; date: string }[]
          return { topic, items: (news ?? []).slice(0, 3) }
        } catch {
          return { topic, items: [] }
        }
      })
    ).then(results => {
      const nodes: GNode[] = []
      const links: { source: string; target: string }[] = []
      results.forEach(({ topic, items }) => {
        items.forEach((item, i) => {
          const id = `art-${topic.replace(/\s+/g, '-')}-${i}`
          const label = item.title.length > 26 ? item.title.slice(0, 25) + '…' : item.title
          nodes.push({ id, label, type: 'article', url: item.url, date: item.date, description: item.title })
          TOPIC_ANCHORS[topic].slice(0, 1).forEach(anchor => links.push({ source: id, target: anchor }))
        })
      })
      setArticles(nodes)
      setArticleLinks(links)
    }).finally(() => setLoading(false))
  }, [])

  // Build / rebuild D3 force graph
  useEffect(() => {
    const svgEl = svgRef.current
    const wrapper = wrapperRef.current
    if (!svgEl || !wrapper) return

    const W = wrapper.clientWidth || 800
    const H = wrapper.clientHeight || 600

    // Compose visible sets
    const visibleNodes: GNode[] = [
      ...STATIC_NODES.filter(n => activeTypes[n.type]),
      ...(activeTypes.article ? articles : []),
    ]
    const nodeIds = new Set(visibleNodes.map(n => n.id))
    const visibleLinks: GLink[] = [
      ...STATIC_LINKS
        .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))
        .map(l => ({ source: l.source, target: l.target, rel: l.rel })),
      ...(activeTypes.article
        ? articleLinks
            .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))
            .map(l => ({ source: l.source, target: l.target }))
        : []),
    ]

    setStats({ nodes: visibleNodes.length, edges: visibleLinks.length })

    // Teardown previous simulation
    simRef.current?.stop()

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    // Root group (zoom target)
    const root = svg.append('g')

    // Zoom / pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, 6])
      .on('zoom', e => root.attr('transform', e.transform))
    svg.call(zoom).on('dblclick.zoom', null)
    svg.on('click', () => setSelectedNode(null))

    // Defs: glow filter
    const defs = svg.append('defs')
    const filt = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%')
    filt.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'blur')
    const fMerge = filt.append('feMerge')
    fMerge.append('feMergeNode').attr('in', 'blur')
    fMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Force simulation
    const sim = d3.forceSimulation<GNode>(visibleNodes)
      .force('link', d3.forceLink<GNode, GLink>(visibleLinks)
        .id(d => d.id)
        .distance(d => {
          const s = (d.source as GNode).type
          const t = (d.target as GNode).type
          if (s === 'article' || t === 'article') return 55
          if (s === 'standard' || t === 'standard') return 100
          return 80
        })
        .strength(0.35)
      )
      .force('charge', d3.forceManyBody<GNode>().strength(d => d.type === 'article' ? -80 : -280))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.08))
      .force('collision', d3.forceCollide<GNode>().radius(d => TYPE_CFG[d.type].collideR + 5).strength(0.8))
    simRef.current = sim

    // ── Edges ──
    const linkSel = root.append('g').attr('class', 'links')
      .selectAll<SVGLineElement, GLink>('line')
      .data(visibleLinks)
      .join('line')
      .attr('stroke', d => {
        const type = (d.source as GNode).type as NodeType
        return TYPE_CFG[type]?.color ?? '#1a3a35'
      })
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 0.22)

    // ── Nodes ──
    const nodeSel = root.append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, GNode>('g')
      .data(visibleNodes, d => d.id)
      .join('g')
      .style('cursor', 'pointer')

    // Symbol path
    nodeSel.append('path')
      .attr('d', d => d3.symbol(TYPE_CFG[d.type].symbol, TYPE_CFG[d.type].area)() ?? '')
      .attr('fill', d => TYPE_CFG[d.type].color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', d => TYPE_CFG[d.type].color)
      .attr('stroke-width', d => d.type === 'standard' ? 2 : 1.4)
      .attr('stroke-opacity', 0.75)

    // Label
    nodeSel.append('text')
      .text(d => d.label)
      .attr('y', d => TYPE_CFG[d.type].collideR + 11)
      .attr('text-anchor', 'middle')
      .attr('fill', d => TYPE_CFG[d.type].color)
      .attr('font-size', d => d.type === 'article' ? '6px' : '7.5px')
      .attr('font-family', "'Courier New', monospace")
      .attr('opacity', d => d.type === 'article' ? 0.55 : 0.82)
      .attr('pointer-events', 'none')

    // Invisible hit area
    nodeSel.append('circle')
      .attr('r', d => TYPE_CFG[d.type].collideR)
      .attr('fill', 'transparent')

    // ── Hover ──
    nodeSel
      .on('mouseenter', function(event, d) {
        event.stopPropagation()
        const connectedIds = new Set<string>([d.id])
        visibleLinks.forEach(l => {
          const s = (l.source as GNode).id
          const t = (l.target as GNode).id
          if (s === d.id || t === d.id) { connectedIds.add(s); connectedIds.add(t) }
        })
        linkSel
          .attr('stroke-opacity', l =>
            (l.source as GNode).id === d.id || (l.target as GNode).id === d.id ? 0.75 : 0.04
          )
          .attr('stroke-width', l =>
            (l.source as GNode).id === d.id || (l.target as GNode).id === d.id ? 1.8 : 0.6
          )
        nodeSel.each(function(n) {
          const self = n.id === d.id
          const neighbor = connectedIds.has(n.id)
          d3.select<SVGGElement, GNode>(this).select('path')
            .attr('fill-opacity', self ? 0.55 : neighbor ? 0.32 : 0.04)
            .attr('stroke-opacity', self ? 1 : neighbor ? 0.75 : 0.15)
          d3.select<SVGGElement, GNode>(this).select('text')
            .attr('opacity', self || neighbor ? 1 : 0.08)
        })
      })
      .on('mouseleave', function() {
        linkSel.attr('stroke-opacity', 0.22).attr('stroke-width', 0.8)
        nodeSel.each(function(n) {
          d3.select<SVGGElement, GNode>(this).select('path')
            .attr('fill-opacity', 0.15)
            .attr('stroke-opacity', 0.75)
          d3.select<SVGGElement, GNode>(this).select('text')
            .attr('opacity', n.type === 'article' ? 0.55 : 0.82)
        })
      })
      .on('click', function(event, d) {
        event.stopPropagation()
        setSelectedNode(d)
        // Glow selected node
        nodeSel.each(function(n) {
          d3.select<SVGGElement, GNode>(this).select('path')
            .attr('filter', n.id === d.id ? 'url(#glow)' : null)
        })
      })

    // ── Drag ──
    nodeSel.call(
      d3.drag<SVGGElement, GNode>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null; d.fy = null
        })
    )

    // ── Tick ──
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as GNode).x ?? 0)
        .attr('y1', d => (d.source as GNode).y ?? 0)
        .attr('x2', d => (d.target as GNode).x ?? 0)
        .attr('y2', d => (d.target as GNode).y ?? 0)
      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop() }
  }, [activeTypes, articles, articleLinks])

  const toggleType = (type: NodeType) =>
    setActiveTypes(prev => ({ ...prev, [type]: !prev[type] }))

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 44px)', background: '#050b0a',
      color: '#d1f5ef', fontFamily: "'Courier New', monospace", overflow: 'hidden',
    }}>
      <style>{`@keyframes kg-pulse { 0%,100%{opacity:1}50%{opacity:0.3} }`}</style>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Graph canvas ── */}
        <div ref={wrapperRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', zIndex: 10,
            }}>
              <span style={{ fontSize: '10px', color: '#3d6b63', letterSpacing: '0.2em', animation: 'kg-pulse 1.5s ease-in-out infinite' }}>
                BUILDING VCM KNOWLEDGE GRAPH...
              </span>
            </div>
          )}
          <svg ref={svgRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* ── Right panel ── */}
        <div style={{
          width: '244px', flexShrink: 0, borderLeft: '1px solid #0e3830',
          background: '#060c0b', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Layer toggles */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #0e3830' }}>
            <div style={{ fontSize: '8px', color: '#3d6b63', letterSpacing: '0.18em', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
              KNOWLEDGE LAYERS
              <span style={{ color: loading ? '#f59e0b' : '#10b981', fontSize: '7px' }}>
                {loading ? '● INDEXING' : '● LIVE'}
              </span>
            </div>
            {(Object.entries(TYPE_CFG) as [NodeType, typeof TYPE_CFG[NodeType]][]).map(([type, cfg]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {/* Mini shape indicator */}
                  <svg width="10" height="10" viewBox="-5 -5 10 10">
                    <path
                      d={d3.symbol(cfg.symbol, 40)() ?? ''}
                      fill={activeTypes[type] ? cfg.color + '40' : 'transparent'}
                      stroke={activeTypes[type] ? cfg.color : '#2d4a46'}
                      strokeWidth="1.2"
                    />
                  </svg>
                  <span style={{ fontSize: '9px', color: activeTypes[type] ? cfg.color : '#2d4a46', transition: 'color 0.2s' }}>
                    {cfg.layer}
                  </span>
                </div>
                <div
                  onClick={() => toggleType(type)}
                  style={{
                    width: '28px', height: '14px', borderRadius: '7px', flexShrink: 0,
                    background: activeTypes[type] ? cfg.color + '30' : '#111f1d',
                    border: `1px solid ${activeTypes[type] ? cfg.color : '#1e3530'}`,
                    cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: activeTypes[type] ? cfg.color : '#2d4a46',
                    position: 'absolute', top: '1px',
                    left: activeTypes[type] ? '15px' : '1px',
                    transition: 'all 0.2s',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #0e3830' }}>
            <div style={{ fontSize: '8px', color: '#3d6b63', letterSpacing: '0.18em', marginBottom: '12px' }}>GRAPH STATS</div>
            {[
              { label: 'NODES VISIBLE',  value: stats.nodes },
              { label: 'EDGES',          value: stats.edges },
              { label: 'ACTIVE LAYERS',  value: `${Object.values(activeTypes).filter(Boolean).length} / 6` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '9px', color: '#3d6b63' }}>{row.label}</span>
                <span style={{ fontSize: '9px', color: '#7ef6e0' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Controls legend */}
          <div style={{ padding: '14px 16px', flex: 1 }}>
            <div style={{ fontSize: '8px', color: '#3d6b63', letterSpacing: '0.18em', marginBottom: '10px' }}>CONTROLS</div>
            {[
              ['SCROLL',    'Zoom in / out'],
              ['DRAG BG',   'Pan canvas'],
              ['DRAG NODE', 'Reposition node'],
              ['CLICK',     'Inspect node'],
              ['HOVER',     'Highlight edges'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <span style={{ fontSize: '8px', color: '#7ef6e0', letterSpacing: '0.08em' }}>{k}</span>
                <span style={{ fontSize: '8px', color: '#3d6b63' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid #0e3830' }}>
            <div style={{ fontSize: '8px', color: '#3d6b63', letterSpacing: '0.18em', marginBottom: '10px' }}>NODE SHAPES</div>
            {([
              ['standard',     'Star',     'Registry / Standard'],
              ['project_type', 'Circle',   'Project Type'],
              ['mechanism',    'Diamond',  'Market Mechanism'],
              ['concept',      'Square',   'Core Concept'],
              ['actor',        'Triangle', 'Market Actor'],
              ['article',      'Dot',      'News Signal'],
            ] as [NodeType, string, string][]).map(([type, shape, desc]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px', opacity: activeTypes[type] ? 1 : 0.35 }}>
                <svg width="10" height="10" viewBox="-5 -5 10 10">
                  <path d={d3.symbol(TYPE_CFG[type].symbol, 36)() ?? ''} fill={TYPE_CFG[type].color + '35'} stroke={TYPE_CFG[type].color} strokeWidth="1" />
                </svg>
                <span style={{ fontSize: '8px', color: '#3d6b63' }}>
                  <span style={{ color: TYPE_CFG[type].color }}>{shape}</span> — {desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Node detail panel ── */}
      {selectedNode && (
        <div style={{
          borderTop: '1px solid #0e3830', background: '#060c0b',
          padding: '14px 22px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '7.5px', color: TYPE_CFG[selectedNode.type].color, letterSpacing: '0.18em', marginBottom: '4px' }}>
                {TYPE_CFG[selectedNode.type].layer}
                {selectedNode.date && ` — ${new Date(selectedNode.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}`}
              </div>
              <div style={{ fontSize: '13px', color: '#d1f5ef', fontWeight: 700, marginBottom: '6px' }}>
                {selectedNode.label}
              </div>
              {selectedNode.description && (
                <div style={{ fontSize: '10px', color: 'rgba(209,245,239,0.5)', lineHeight: 1.65, maxWidth: '640px' }}>
                  {selectedNode.description}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              {selectedNode.url && (
                <a href={selectedNode.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '8.5px', color: TYPE_CFG[selectedNode.type].color, textDecoration: 'none', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                  READ SIGNAL →
                </a>
              )}
              <button onClick={() => setSelectedNode(null)}
                style={{ fontSize: '9px', color: '#3d6b63', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'inherit' }}>
                ✕ CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
