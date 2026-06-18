# Technical Plan: VCM Analysis Integration into Terrapulse

## Context

**Current State:**
- **Terrapulse**: Next.js 15 app with 3 pages (root/map, /news, /carbon-news) for carbon markets news and visualization
- **vcm_analysis**: Separate Vite+React SPA with FastAPI backend and Supabase for detailed VCM (Voluntary Carbon Market) project analytics, benchmarking, and timelines

**Goal:** Consolidate into a single cohesive website combining carbon market news + detailed project analysis, while maintaining both projects' unique strengths.

**Key Constraint:** 
- Terrapulse uses Next.js App Router; vcm_analysis uses React Router
- vcm_analysis has sophisticated analytics components (D3 sunburst, Recharts timeline, benchmarking) worth preserving
- Both use different UI libraries (shadcn/ui vs Radix UI)

---

## Recommended Approach: Full Unification - Components + Backend + UI Library

We'll **extract vcm_analysis components and backend into Terrapulse, standardize on shadcn/ui, and create a single unified Next.js application**. This creates a truly cohesive platform for carbon market intelligence.

### Why This Approach

✅ **Complete consolidation** - Single codebase, single deployment, single dependency tree  
✅ **Unified design system** - One UI library (shadcn/ui) for consistent component behavior and styling  
✅ **Cohesive UX** - Unified navigation, shared header, consistent theming, single theme toggle  
✅ **Full code reuse** - Analytics components, data transformation, filtering logic all integrated  
✅ **Simpler operations** - One build process, one env config, shared databases (news + vcm data)  
✅ **Future-proof** - Can later serve both features from same backend, add cross-feature analytics  

---

## Architecture Overview

### New Site Structure

```
/                          → Map + news feed (current Terrapulse home)
/news                      → News articles by country (current)
/carbon-news               → AI-powered news (current)
/analytics                 → VCM project overview & stats (new)
/analytics/projects        → Project table + benchmarking dashboard (new)
/analytics/explorer        → Interactive project explorer (optional future)
```

### Data Layer Integration

**Unified Backend:**
- Keep vcm_analysis FastAPI backend + Supabase for VCM project data
- Keep Terrapulse Prisma + PostgreSQL for news articles
- Terrapulse makes API calls to vcm_analysis backend at `/api/vcm/*` routes

**API Gateway Pattern:**
- Create Terrapulse `app/api/vcm/route.ts` (Next.js API route) that proxies to vcm_analysis FastAPI
- Benefits: Single origin for frontend, easier CORS, can cache/transform responses

### Navigation & Layout

**Update Header component:**
- Add navigation menu: Home | News | Carbon News | Analytics
- Consolidate search bar (currently only searches news)
- Keep theme toggle and current styling

**Shared Layout:**
- Use existing `app/layout.tsx` Tailwind + shadcn/ui foundation
- Components can use existing color palette (primary: #7ef6e0, background: #111111, etc.)

---

## Implementation Phases

### Phase 1: Prepare Dependencies & Aliases (Week 1)

**Goal:** Set up project structure without breaking existing pages, add analytics dependencies

**Changes:**
1. **Update `package.json`** - Add vcm_analysis dependencies to terrapulse:
   ```json
   "recharts": "^2.12.7",        // Analytics charts
   "d3": "^7.9.0",                // Sunburst visualization
   "remove @radix-ui/react-select OR downgrade shadcn version if conflict"
   ```
   - Keep existing shadcn/ui
   - Remove/minimize Radix UI direct usage (vcm components will be rewritten)
   - Optional: Add `tailwindcss-animate` if not already present

2. **Add UI component aliases** in `tsconfig.json`:
   ```json
   "paths": {
     "@/components/*": ["./app/components/*"],
     "@/lib/*": ["./lib/*"],
     "@/ui/*": ["./app/components/ui/*"],
     "@/hooks/*": ["./app/hooks/*"],
   }
   ```

3. **Create shared constants** at `lib/vcm-constants.ts`:
   - Registry name mappings (VCS → Verra, GOLD → Gold Standard)
   - Region normalization (continent mapping)
   - Uptake band definitions (Low <10%, Medium 10-50%, High >50%)
   - API base URL and endpoints

4. **Update `next.config.ts`** to allow dynamic imports:
   ```typescript
   experimental: { optimizePackageImports: ['recharts', 'd3'] }
   ```

5. **Create `app/hooks/` directory** for custom React hooks (useVcmProjects, useFilters, etc.)

### Phase 2: Extract & Adapt vcm_analysis Components - Migrate to shadcn/ui (Weeks 2-4)

**Goal:** Move React components to Terrapulse, adapt from React Router to Next.js, rewrite UI layer to shadcn/ui

**Files to Create/Adapt:**

1. **Extract core analytics components** from `vcm_analysis/frontend/src/components/` → `app/components/analytics/`:
   
   For each component, migrate Radix UI dependencies to shadcn/ui equivalents:
   - ✅ `AnalyticsDashboard.tsx` - Main dashboard (adapt hooks for Next.js, no UI lib changes needed - mostly chart logic)
   - ✅ `ProjectTable.tsx` - Sortable, paginated table (rewrite Radix UI `table` to shadcn/ui `table`)
   - ✅ `ProjectBenchmarkPanel.tsx` - Benchmark overlay (rewrite Radix UI components to shadcn/ui)
   - ✅ `ProjectFilters.tsx` - Filter controls (rewrite Radix UI `select` to shadcn/ui `select`, update form inputs)
   - ✅ `GlobalProjectMap.tsx` - Mapbox visualization (no UI lib changes - pure D3/Mapbox)
   - ✅ `StatsCard.tsx` - KPI cards (use shadcn/ui Card component)
   - ✅ `LoadingState.tsx` - Loading skeleton (use shadcn/ui Skeleton)
   - 🗑️ IssuanceTimeline, RegistryDistribution - Consolidate into AnalyticsDashboard

   **Migration pattern example:**
   ```typescript
   // Before (Radix UI)
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@radix-ui/react-select';
   
   // After (shadcn/ui)
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
   ```

2. **Create/Update UI components** in `app/components/ui/`:
   - Verify shadcn/ui versions exist: `card.tsx`, `button.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `badge.tsx`, `table.tsx`, `separator.tsx`, `spinner.tsx`
   - Install missing shadcn/ui components: `npx shadcn-ui@latest add <component>` if needed
   - Remove any Radix UI direct imports
   - Ensure consistent theming (use existing Tailwind dark mode)

3. **Create new files for data/logic layer:**
   - `app/hooks/useVcmProjects.ts` - Custom hook for fetching projects with pagination/filtering
   - `app/hooks/useVcmFilters.ts` - Custom hook for filter state management (localStorage persistence)
   - `app/components/analytics/types.ts` - Shared TypeScript interfaces (ApiProject, ApiProjectSummary, FilterOptions, etc.)
   - `app/components/analytics/utils.ts` - Data transformation utilities:
     - `normalizeRegistry()` - Maps VCS → Verra, GOLD → Gold Standard, etc.
     - `normalizeRegion()` - Maps country codes to continents
     - `parseProjectType()`, `parseMethodology()` - Handle delimited strings
     - `aggregateByRegistry()`, `aggregateByType()` - Compute breakdowns
     - `calculateUptakeBand()` - Low/Medium/High classification
     - `computePeerMetrics()` - Percentile calculations for benchmarking

4. **Remove React Router dependencies:**
   - Copy HomePage → initial content for `app/analytics/page.tsx` (serves as marketing/overview)
   - Replace BrowserRouter, Routes, Route with Next.js file-based routing
   - Adapt any router-based state to use `useSearchParams()` and `useRouter()` from next/navigation
   - All filter state should be URL-based (survives refresh)

### Phase 3: Create Analytics Routes (Weeks 3-4)

**Goal:** Build Next.js pages that use extracted components

**New Pages:**

1. **`app/analytics/page.tsx`** - Analytics Landing Page
   - Hero section explaining VCM analysis
   - Key stats: total projects, total issued, total retired
   - Links to /analytics/projects
   - Tech stack / data sources
   - (Can largely reuse HomePage content)

2. **`app/analytics/projects/page.tsx`** - Project Explorer Dashboard
   - Layout: Filters sidebar (left) | Main content (right)
   - Main content tabs:
     - **Dashboard Tab**: AnalyticsDashboard (timeline, sunburst, map, scope chart)
     - **Table Tab**: ProjectTable (sortable, filterable, paginated)
     - **Benchmark Tab**: ProjectBenchmarkPanel (when project selected)
   - State management: `useSearchParams()` for filters (survives refresh)
   - Integration: Calls `/api/vcm/projects`, `/api/vcm/dashboard/*` endpoints

### Phase 4: Migrate & Integrate FastAPI Backend (Week 4-5)

**Goal:** Bring vcm_analysis backend into Terrapulse, either as Next.js API routes or sidecar process

**Two Options (Choose One):**

#### Option A: Pure Next.js (Recommended for simplicity)
- Convert FastAPI endpoints to Next.js API routes (app/api/vcm/*)
- Query Supabase PostgreSQL directly from API routes using `@supabase/supabase-js`
- Pros: Single Node.js process, simpler deployment
- Cons: Duplicate some FastAPI logic in TypeScript

#### Option B: Keep FastAPI as Sidecar
- Keep FastAPI backend running separately (can be same machine or separate)
- Create Next.js proxy routes (app/api/vcm/[...path]/route.ts) that forward to FastAPI
- Pros: Minimal changes to backend, can deploy separately
- Cons: Two processes to manage

**Recommendation:** Start with **Option B** (simpler transition), later migrate to **Option A** if desired.

**Files to Create (Option B - Proxy Approach):**

1. **`app/api/vcm/[...path]/route.ts`** - Catch-all proxy
   ```typescript
   const VCM_API = process.env.VCM_API_URL || 'http://localhost:8000';
   
   export async function GET(req, { params: { path } }) {
     const query = new URLSearchParams(req.nextUrl.searchParams);
     return fetch(`${VCM_API}/${path.join('/')}?${query}`, {
       headers: req.headers,
     });
   }
   
   export async function POST(req, { params: { path } }) {
     return fetch(`${VCM_API}/${path.join('/')}`, {
       method: 'POST',
       body: await req.text(),
       headers: req.headers,
     });
   }
   ```

2. **Environment setup:**
   - Add `VCM_API_URL` to `.env.local` (defaults to `http://localhost:8000` for dev)
   - For production, set to remote backend URL
   - Copy `vcm_analysis/` directory into terrapulse root (or keep as separate git submodule)
   - Add npm scripts to start both services (or use Docker Compose later)

3. **Optional: `docker-compose.yml`** (for local dev)
   ```yaml
   version: '3'
   services:
     vcm-backend:
       build: ./vcm_analysis/backend
       ports:
         - "8000:8000"
       environment:
         - SUPABASE_DB_URL=${SUPABASE_DB_URL}
     web:
       build: .
       ports:
         - "3000:3000"
       environment:
         - VCM_API_URL=http://vcm-backend:8000
   ```

**Alternative (Option A - Pure Next.js):**

If you later want to migrate fully to Next.js:

1. **Create `app/lib/supabase-client.ts`**
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   ```

2. **Rewrite API endpoints as Next.js routes:**
   - `app/api/vcm/projects/route.ts` - Query `vcm_projects` table
   - `app/api/vcm/dashboard/timeline/route.ts` - Query `vcm_project_yearly` table
   - Copy data transformation logic from FastAPI to TypeScript utilities

**For Now: Go with Option B** (keep backend separate, use proxy routes)

### Phase 5: Styling & Theme Harmony (Week 5)

**Goal:** Ensure consistent look across terrapulse + analytics

**Tasks:**
1. **Audit component styling** - Both apps use Tailwind; check color/spacing conflicts
2. **Extend Tailwind config** - Add any missing utilities (D3 animations, chart colors)
3. **UI library merge** - Decide: keep shadcn/ui + Radix UI side-by-side, or standardize on one
   - **Recommendation:** Keep both (already works), but prefer shadcn/ui for new components
4. **Dark mode** - vcm_analysis has ThemeToggle; terrapulse uses CSS variables
   - Unify under Tailwind dark mode (`dark:` classes)
5. **Color harmony** - Ensure chart colors (registry colors in sunburst) match site palette

### Phase 6: Update Navigation & Layout (Week 5-6)

**Goal:** Create unified experience

**Changes:**

1. **Update `app/layout.tsx`:**
   - Add navigation menu (Home | News | Carbon News | Analytics)
   - Keep existing NewsProvider
   - Optionally add VCM data provider (if using Context for shared state)

2. **Update `app/components/Header.tsx`:**
   - Add navigation links
   - Keep search bar for news
   - Keep theme toggle (can be shared)

3. **Create `app/components/Navigation.tsx`** - Reusable nav component

### Phase 7: Testing & Deployment (Week 6+)

**Goal:** Ensure data flows correctly, components render, no breaking changes

**Manual Testing:**
1. ✅ Map page loads, news feed works (existing functionality)
2. ✅ News page displays articles (existing)
3. ✅ Carbon News page shows AI analysis (existing)
4. ✅ Analytics page loads with filters
5. ✅ Project table paginates, sorts, searches
6. ✅ Dashboard charts render correctly
7. ✅ Benchmark panel shows correct peer comparisons
8. ✅ Theme toggle affects analytics components
9. ✅ Responsive design on mobile (analytics is complex, test well)

**Deployment:**
- `next build` compiles everything together
- Set `VCM_API_URL` env var to point to vcm_analysis backend (can be same machine or remote)
- Deploy as single Next.js application

---

## Critical Files & Dependencies

### Files to Create
- `app/analytics/page.tsx` - Analytics landing
- `app/analytics/projects/page.tsx` - Projects dashboard
- `app/api/vcm/[...path]/route.ts` - API proxy
- `app/components/analytics/useVcmProjects.ts` - Custom hook
- `app/components/analytics/types.ts` - Type definitions
- `app/components/analytics/utils.ts` - Helpers
- `app/components/Navigation.tsx` - Unified nav
- `lib/vcm-constants.ts` - Shared constants

### Files to Adapt (Copy from vcm_analysis)
- `AnalyticsDashboard.tsx` → `app/components/analytics/AnalyticsDashboard.tsx`
- `ProjectTable.tsx` → `app/components/analytics/ProjectTable.tsx`
- `ProjectFilters.tsx` → `app/components/analytics/ProjectFilters.tsx`
- `GlobalProjectMap.tsx` → `app/components/analytics/GlobalProjectMap.tsx`
- `ProjectBenchmarkPanel.tsx` → `app/components/analytics/ProjectBenchmarkPanel.tsx`
- All UI components from `vcm_analysis/frontend/src/components/ui/` → `app/components/ui/`

### Files to Update
- `package.json` - Add missing dependencies (recharts, d3, etc.)
- `tsconfig.json` - Add path aliases
- `app/layout.tsx` - Add navigation context/provider
- `app/components/Header.tsx` - Add nav menu
- `tailwind.config.js` - Extend with analytics utilities if needed
- `next.config.ts` - Ensure dynamic imports work

### Existing Dependencies (Reuse)
- Mapbox GL (already in terrapulse, higher version in vcm_analysis)
- React 19 (both use same version)
- Tailwind CSS (both use v4)
- TypeScript (both use ~v5.8)

---

## Data Flow Diagram

```
User Browser
    ↓
Terrapulse (Next.js)
├─ /                  → Map + News (existing)
├─ /news              → News articles (existing)
├─ /carbon-news       → AI News (existing)
├─ /analytics         → VCM overview (new)
└─ /analytics/projects → Dashboard (new)
    ↓
app/api/vcm/* (Next.js API routes)
    ↓
vcm_analysis FastAPI Backend (external or local)
    ↓
Supabase PostgreSQL (vcm_projects, vcm_project_yearly, vcm_project_metrics)

(Separate flows for news data via Prisma)
```

---

## Considerations & Trade-offs

### ✅ Advantages
- Single deployed application
- Unified UI/UX, shared navigation
- Easier to add features that bridge news + analytics
- No cross-origin issues
- Simpler environment configuration

### ⚠️ Trade-offs
- React Router → Next.js migration (but vcm_analysis has simple routing)
- Shadcn/ui + Radix UI side-by-side (not ideal, but manageable)
- vcm_analysis backend stays separate (but can be future improvement)
- Dependency bloat (adding D3, Recharts to terrapulse bundle) — mitigate with dynamic imports

### 🚫 What We're NOT Doing
- **iFrame embed** - Creates poor UX, separate origin issues
- **Full rewrite** - Wastes existing vcm_analysis component work
- **Monorepo** - Keeps single deployable unit

---

## Success Criteria

✅ **Single Next.js app** - All content (news + analytics) at root domain  
✅ **Unified UI library** - Only shadcn/ui used throughout (no Radix UI direct imports)  
✅ **News pages work** - Map, news, carbon-news pages unchanged and functional  
✅ **Analytics accessible** - `/analytics` and `/analytics/projects` with full dashboard  
✅ **Data integrity** - All project data, timelines, benchmarks rendering correctly  
✅ **Unified UX** - Single navigation menu, shared header, consistent theming  
✅ **API communication** - Proxy routes successfully forward to vcm_analysis backend  
✅ **Type safety** - No console errors or TypeScript mismatches  
✅ **Responsive design** - Works on mobile (analytics dashboard is complex - verify)  
✅ **Performance** - Build size reasonable, lazy-load D3/Recharts where possible  
✅ **State persistence** - Filters survive page refresh (URL-based state)  

---

## Estimated Effort

With full unification (components + shadcn/ui migration + backend):

- **Phase 1** (Dependencies): 1 day
- **Phase 2** (Component extraction + shadcn/ui migration): 4-5 days
  - 2-3 days extracting components
  - 2-3 days rewriting Radix UI → shadcn/ui
- **Phase 3** (Routes): 2-3 days
- **Phase 4** (Backend integration): 2-3 days
  - 1 day setting up API routes/proxy
  - 1-2 days testing data flow, environment setup
- **Phase 5** (Styling & theme harmony): 2-3 days
- **Phase 6** (Nav/Layout updates): 1-2 days
- **Phase 7** (Testing & QA): 2-3 days

**Total: ~3-4 weeks** (can parallelize phases 1-2 and 3-4)

**Critical path:** Component extraction → shadcn/ui migration (blocking everything else)

---

## Next Steps

1. Confirm approach with user (or iterate on alternatives)
2. Create branch: `feat/integrate-vcm-analytics`
3. Start Phase 1: dependency setup
4. Incrementally build out phases with testing at each step
