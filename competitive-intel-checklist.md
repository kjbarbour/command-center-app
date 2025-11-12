# 🎯 Competitive Intelligence Dashboard - Complete Task Checklist

**Project Goal**: Build comprehensive competitive analysis dashboard for 626 growth opportunities

**Total Estimated Time**: 67 hours (2-3 weeks)

**Project Start Date**: _________

**Target Completion**: _________

---

## 📊 OVERALL PROGRESS TRACKER

- [ ] Phase 1: Data Foundation (0/3) - 7 hours
- [ ] Phase 2: API Endpoints (0/4) - 12 hours  
- [ ] Phase 3: Frontend Dashboard (0/6) - 21 hours
- [ ] Phase 4: Advanced Features (0/5) - 17 hours
- [ ] Phase 5: Polish & Testing (0/4) - 10 hours

**Total Progress**: 0/22 tasks (0%)

---

## 🔴 PHASE 1: DATA FOUNDATION (Week 1)

**Phase Goal**: Understand and prepare competitor data for analysis

### ✅ Task 1.1: Analyze Current Competitor Data
**Priority**: 🔴 HIGH | **Time**: 2 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Open Prisma Studio and browse IndustryProject table
- [ ] Run query to count projects with competitor data populated
- [ ] Examine 10 sample competitor JSON strings
- [ ] List all unique competitor names found (export to spreadsheet)
- [ ] Identify data quality issues (nulls, malformed JSON, duplicates)
- [ ] Document competitor name variations (Tesla vs Tesla Energy)
- [ ] Calculate: What % of 7,434 projects have competitor data?

**Completion Criteria**: 
- Data quality report document created
- Know exact count of projects with competitor data
- List of common competitor name variations

**Test Commands**:
```sql
-- Run in Prisma Studio or via query tool
SELECT COUNT(*) as total_projects,
       COUNT(competitors) as with_competitors,
       COUNT(CASE WHEN stemInvolved = false THEN 1 END) as opportunities
FROM "IndustryProject"
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 1.2: Create Competitor Normalization Function
**Priority**: 🔴 HIGH | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create new file: `lib/competitor-utils.ts`
- [ ] Write `parseCompetitors(jsonString: string): string[]` function
- [ ] Write `normalizeCompetitorName(name: string): string` function
- [ ] Create company name mapping dictionary (Tesla Energy → Tesla)
- [ ] Add error handling for malformed JSON
- [ ] Write 5 unit tests for edge cases
- [ ] Test with real data from database

**Completion Criteria**:
- File created with exported functions
- Handles all edge cases gracefully
- Returns consistent normalized names

**Code Structure**:
```typescript
// lib/competitor-utils.ts
export function parseCompetitors(jsonString: string): string[] { ... }
export function normalizeCompetitorName(name: string): string { ... }
export const COMPETITOR_NAME_MAP: Record<string, string> = { ... }
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 1.3: Add Database Indexes
**Priority**: 🟡 MEDIUM | **Time**: 2 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Update `prisma/schema.prisma`
- [ ] Add index: `@@index([competitors])`
- [ ] Add index: `@@index([stemInvolved, matchedCustomerId])`
- [ ] Add index: `@@index([state, status])`
- [ ] Run: `npx dotenv -e .env -- prisma db push`
- [ ] Run: `npx dotenv -e .env -- prisma generate`
- [ ] Test query performance before/after indexes

**Completion Criteria**:
- Indexes applied to production database
- Query speed improved (test with EXPLAIN ANALYZE)

**Commands**:
```bash
npx dotenv -e .env -- prisma db push
npx dotenv -e .env -- prisma generate
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

## 🟢 PHASE 2: API ENDPOINTS (Week 1-2)

**Phase Goal**: Build REST APIs to serve competitive intelligence data

### ✅ Task 2.1: Create Competitors Overview API
**Priority**: 🔴 HIGH | **Time**: 4 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `pages/api/competitive-intelligence/competitors.ts`
- [ ] Set up TypeScript types for response
- [ ] Query all projects and extract competitors
- [ ] Aggregate: total projects per competitor
- [ ] Calculate: projects where competitor appears but STEM doesn't (losses)
- [ ] Calculate: projects where both appear (head-to-head)
- [ ] Calculate: win rate percentage
- [ ] Sum total MW per competitor
- [ ] Add optional query params: ?state=CA&sector=Solar
- [ ] Return top 20 by default, sorted by project count
- [ ] Test with curl

**API Endpoint**: `GET /api/competitive-intelligence/competitors`

**Response Structure**:
```json
{
  "competitors": [
    {
      "name": "Tesla",
      "totalProjects": 143,
      "projectsWhereStemLost": 98,
      "projectsWhereStemWon": 12,
      "winRate": 10.8,
      "totalMW": 1250.5,
      "topStates": ["CA", "TX"],
      "topSectors": ["Storage"]
    }
  ]
}
```

**Test Command**:
```bash
curl "http://localhost:3000/api/competitive-intelligence/competitors"
curl "http://localhost:3000/api/competitive-intelligence/competitors?state=CA"
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 2.2: Create Regional Analysis API
**Priority**: 🔴 HIGH | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `pages/api/competitive-intelligence/regional.ts`
- [ ] Query projects grouped by state
- [ ] Count: total projects per state
- [ ] Count: STEM projects per state
- [ ] Calculate: STEM market share percentage per state
- [ ] Identify: top competitor per state
- [ ] Count: unique competitors per state
- [ ] Sum: total opportunity MW per state (where STEM not involved)
- [ ] Sort states by opportunity size
- [ ] Test with curl

**API Endpoint**: `GET /api/competitive-intelligence/regional`

**Response Structure**:
```json
{
  "states": [
    {
      "state": "CA",
      "totalProjects": 245,
      "stemProjects": 15,
      "stemMarketShare": 6.1,
      "topCompetitor": "Tesla",
      "competitorCount": 8,
      "opportunityMW": 2100.5
    }
  ]
}
```

**Test Command**:
```bash
curl "http://localhost:3000/api/competitive-intelligence/regional"
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 2.3: Create Head-to-Head Comparison API
**Priority**: 🟡 MEDIUM | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `pages/api/competitive-intelligence/head-to-head.ts`
- [ ] Accept query params: `competitor1` and `competitor2`
- [ ] Find projects where both competitors appear
- [ ] Find projects where only competitor1 appears
- [ ] Find projects where only competitor2 appears
- [ ] Calculate win/loss record
- [ ] Break down by sector
- [ ] Break down by state
- [ ] Break down by MW size ranges
- [ ] Return comparison stats

**API Endpoint**: `GET /api/competitive-intelligence/head-to-head?competitor1=STEM&competitor2=Tesla`

**Test Command**:
```bash
curl "http://localhost:3000/api/competitive-intelligence/head-to-head?competitor1=STEM&competitor2=Tesla"
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 2.4: Create Project List API
**Priority**: 🟡 MEDIUM | **Time**: 2 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `pages/api/competitive-intelligence/projects.ts`
- [ ] Query projects with filters: competitor, customer, state, sector
- [ ] Parse and include competitors array in response
- [ ] Add pagination: ?limit=50&offset=0
- [ ] Sort by MW capacity (descending)
- [ ] Include matched customer data
- [ ] Test with various filters

**API Endpoint**: `GET /api/competitive-intelligence/projects?competitor=Tesla&limit=50`

**Test Command**:
```bash
curl "http://localhost:3000/api/competitive-intelligence/projects?competitor=Tesla"
```

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

## 🎨 PHASE 3: FRONTEND DASHBOARD (Week 2-3)

**Phase Goal**: Build interactive UI for competitive intelligence

### ✅ Task 3.1: Create Dashboard Page Layout
**Priority**: 🔴 HIGH | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `pages/competitive-intelligence.tsx`
- [ ] Add page to navigation menu (update layout/header)
- [ ] Design 3-column responsive grid layout
- [ ] Add page title and description
- [ ] Create loading state skeleton
- [ ] Create error boundary component
- [ ] Test responsive design (mobile, tablet, desktop)

**File**: `pages/competitive-intelligence.tsx`

**Route**: http://localhost:3000/competitive-intelligence

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 3.2: Build Competitor Rankings Component
**Priority**: 🔴 HIGH | **Time**: 4 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `components/CompetitorRankings.tsx`
- [ ] Fetch data from `/api/competitive-intelligence/competitors`
- [ ] Create table with columns: Rank, Name, Total Projects, vs STEM, Win Rate, Total MW
- [ ] Add sort functionality (click column headers)
- [ ] Add search box to filter competitors by name
- [ ] Color-code win rates (red < 20%, yellow 20-50%, green > 50%)
- [ ] Make competitor names clickable (link to detail modal)
- [ ] Add "Export to CSV" button
- [ ] Style with Tailwind CSS matching existing design
- [ ] Test with real data

**Component**: `<CompetitorRankings />`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 3.3: Build Regional Heat Map Component
**Priority**: 🔴 HIGH | **Time**: 5 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Research: Choose map library (react-simple-maps recommended)
- [ ] Install: `npm install react-simple-maps`
- [ ] Create file: `components/RegionalHeatMap.tsx`
- [ ] Fetch data from `/api/competitive-intelligence/regional`
- [ ] Import US map topology JSON
- [ ] Color states by STEM market share (red = 0-10%, yellow = 10-30%, green = 30%+)
- [ ] Add hover tooltip showing state stats
- [ ] Add legend explaining color scale
- [ ] Make states clickable to filter dashboard
- [ ] Test with different data ranges

**Component**: `<RegionalHeatMap />`

**Dependencies**: `npm install react-simple-maps`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 3.4: Build Win Rate Trend Chart
**Priority**: 🟡 MEDIUM | **Time**: 4 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Install: `npm install recharts`
- [ ] Create file: `components/WinRateTrends.tsx`
- [ ] Fetch project data and group by month
- [ ] Calculate monthly STEM win rate vs top 5 competitors
- [ ] Create line chart with Recharts
- [ ] Add date range selector (last 3 months, 6 months, 1 year, all time)
- [ ] Add legend for each competitor line
- [ ] Add hover tooltips showing exact percentages
- [ ] Style chart to match dashboard theme

**Component**: `<WinRateTrends />`

**Dependencies**: `npm install recharts`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 3.5: Build Competitor Detail Modal
**Priority**: 🟡 MEDIUM | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `components/CompetitorDetailModal.tsx`
- [ ] Create modal overlay with backdrop
- [ ] Fetch head-to-head API when competitor selected
- [ ] Display detailed stats: total projects, sector breakdown, state breakdown
- [ ] Show mini-chart of their activity over time
- [ ] List recent projects (last 10) where they appear
- [ ] Add "View All Projects" button
- [ ] Add close button (X) and ESC key handler
- [ ] Click outside modal to close

**Component**: `<CompetitorDetailModal competitor="Tesla" onClose={() => {}} />`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 3.6: Build Executive Summary Cards
**Priority**: 🔴 HIGH | **Time**: 2 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `components/ExecutiveSummary.tsx`
- [ ] Calculate 4 key metrics from API data:
  - Total competitors tracked
  - Overall STEM win rate
  - Biggest threat (competitor with most wins)
  - Biggest opportunity state (most projects where STEM not involved)
- [ ] Create 4 card components with icons
- [ ] Add small sparkline charts showing trends
- [ ] Make cards clickable to filter dashboard
- [ ] Responsive design for mobile

**Component**: `<ExecutiveSummary />`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

## 🚀 PHASE 4: ADVANCED FEATURES (Week 3-4)

**Phase Goal**: Add filtering, export, and deep-dive capabilities

### ✅ Task 4.1: Add Dashboard Filtering
**Priority**: 🔴 HIGH | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `components/DashboardFilters.tsx`
- [ ] Add filter controls:
  - Date range picker (from/to dates)
  - State multi-select dropdown
  - Sector checkboxes (Solar, Storage, Both)
  - Customer search/select
- [ ] Add "Apply Filters" button
- [ ] Add "Reset Filters" button
- [ ] Store filter state in React context or URL params
- [ ] Pass filters to all API calls
- [ ] Update all dashboard components when filters change

**Component**: `<DashboardFilters onFilterChange={handleFilters} />`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 4.2: Create Export Functionality
**Priority**: 🟡 MEDIUM | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Install: `npm install papaparse`
- [ ] Create file: `lib/export-utils.ts`
- [ ] Write function to convert competitor data to CSV
- [ ] Add "Export Report" button to dashboard
- [ ] Generate CSV with columns: Name, Projects, Win Rate, MW, States, Sectors
- [ ] Include current filter settings in export
- [ ] Add timestamp to filename: `competitive-report-YYYY-MM-DD.csv`
- [ ] Trigger browser download
- [ ] Test with large datasets

**Function**: `exportCompetitiveReport(data, filters)`

**Dependencies**: `npm install papaparse`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 4.3: Create Competitor Detail Page
**Priority**: ⚪ LOW | **Time**: 4 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `pages/competitive-intelligence/[competitor].tsx`
- [ ] Use Next.js dynamic routing for competitor name
- [ ] Fetch full profile for selected competitor
- [ ] Show header with competitor name and key stats
- [ ] Display timeline chart of their project activity
- [ ] List ALL projects they're involved in (paginated table)
- [ ] Show head-to-head comparison with STEM
- [ ] Add notes section (stored in database for team insights)
- [ ] Add breadcrumb navigation back to dashboard

**Route**: `/competitive-intelligence/Tesla`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 4.4: Add Customer Competitive View
**Priority**: 🟡 MEDIUM | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Update file: `pages/customers/[id].tsx`
- [ ] Fetch customer's industry projects
- [ ] Extract all competitors from customer's projects
- [ ] Aggregate: which competitors appear most on this customer's projects
- [ ] Calculate: STEM win rate with this specific customer
- [ ] Create new section: "Competitive Landscape"
- [ ] Display as horizontal bar chart or table
- [ ] Add to customer detail page below Growth Opportunities tab

**Component**: Add to existing customer page

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 4.5: Build Automated Insights
**Priority**: ⚪ LOW | **Time**: 4 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Create file: `lib/competitive-insights.ts`
- [ ] Write algorithm to detect patterns:
  - Competitor dominance by state (>50% of projects)
  - STEM win rate changes (>10% increase/decrease month-over-month)
  - New competitors (first appearance in last 30 days)
  - Sector dominance (competitor >70% in specific sector)
- [ ] Generate insight strings: "Tesla dominates CA storage market (78% share)"
- [ ] Display insights as alert cards at top of dashboard
- [ ] Make insights clickable to apply relevant filters
- [ ] Limit to top 5 most important insights

**Component**: `<AutomatedInsights />`

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

## ✨ PHASE 5: POLISH & TESTING (Week 4)

**Phase Goal**: Ensure quality, performance, and documentation

### ✅ Task 5.1: End-to-End Testing
**Priority**: 🔴 HIGH | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Test all API endpoints with curl (competitors, regional, head-to-head, projects)
- [ ] Test dashboard loads without errors
- [ ] Test all filters and combinations
- [ ] Test sorting on all sortable columns
- [ ] Test responsive design on: mobile (375px), tablet (768px), desktop (1440px)
- [ ] Test export functionality downloads correct CSV
- [ ] Test with real customer data (Nexamp ID 2173, Summit Ridge ID 3593)
- [ ] Test error states (API down, no data, malformed data)
- [ ] Document any bugs found

**Test Cases Checklist**:
- [ ] Load dashboard with no filters → shows all competitors
- [ ] Filter by state "CA" → updates all components
- [ ] Sort competitors by win rate → reorders table correctly
- [ ] Click competitor name → opens detail modal
- [ ] Export report → downloads CSV with correct data
- [ ] Resize browser → responsive layout works
- [ ] Navigate to customer page → shows competitive view

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 5.2: Performance Optimization
**Priority**: 🟡 MEDIUM | **Time**: 3 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Add API response caching (5-minute cache)
- [ ] Optimize Prisma queries (use select, include only needed fields)
- [ ] Run EXPLAIN ANALYZE on slow queries
- [ ] Add database indexes if missing
- [ ] Implement lazy loading for heavy components (map, charts)
- [ ] Add loading skeletons for better UX
- [ ] Test dashboard load time with 7,434 projects
- [ ] Target: Dashboard loads in < 2 seconds
- [ ] Use React.memo() for expensive components
- [ ] Profile with React DevTools

**Performance Targets**:
- Dashboard initial load: < 2 seconds
- Filter application: < 500ms
- Chart rendering: < 1 second
- Export generation: < 3 seconds

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 5.3: Documentation
**Priority**: 🟡 MEDIUM | **Time**: 2 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Update main project README with Competitive Intelligence section
- [ ] Document all API endpoints:
  - Endpoint URL
  - Query parameters
  - Response structure
  - Example curl command
- [ ] Add JSDoc comments to all utility functions
- [ ] Create user guide: "How to Use Competitive Intelligence Dashboard"
- [ ] Document how to refresh competitor data (re-import process)
- [ ] Add troubleshooting section (common issues + solutions)
- [ ] Screenshot dashboard for documentation

**Output**: Updated project README and user guide

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

### ✅ Task 5.4: UI Polish
**Priority**: ⚪ LOW | **Time**: 2 hours | **Status**: ⬜ Not Started

**Subtasks**:
- [ ] Ensure consistent color scheme across all charts and components
- [ ] Add smooth transitions and hover effects
- [ ] Improve mobile responsiveness (test on real devices)
- [ ] Add tooltips to explain metrics and buttons
- [ ] Review typography and spacing for consistency
- [ ] Add icons to section headers
- [ ] Ensure accessibility: keyboard navigation, ARIA labels
- [ ] Final design review with stakeholder

**Quality Checklist**:
- [ ] Colors match existing CRM design
- [ ] All buttons have hover states
- [ ] Loading states are smooth
- [ ] Error messages are user-friendly
- [ ] Mobile experience is good (not just functional)

**Notes**: _______________________________________________

**Completed**: _______ (Date/Time)

---

## 🎯 QUICK START GUIDE

### Your First Day (9 hours):
1. **Task 1.1** - Analyze competitor data (2 hours)
2. **Task 1.2** - Build utility functions (3 hours)
3. **Task 2.1** - Create competitors API (4 hours)

**End of Day 1**: You'll have your first API endpoint working!

### Your First Week (35-40 hours):
- Complete all of Phase 1 (7 hours)
- Complete all of Phase 2 (12 hours)
- Start Phase 3 - Dashboard layout and competitor rankings (10 hours)

**End of Week 1**: Backend complete, basic frontend started

---

## 📋 DAILY STANDUP TEMPLATE

**Date**: _________

**Today's Focus**: (Pick 1-2 tasks)
- [ ] Task: _________________
- [ ] Task: _________________

**Blockers**: _________________

**Questions**: _________________

**Tomorrow's Plan**: _________________

---

## 🏆 COMPLETION CRITERIA

**Project is DONE when**:
- [ ] All 22 tasks marked complete
- [ ] Dashboard accessible at `/competitive-intelligence`
- [ ] All APIs return correct data
- [ ] Filters work correctly
- [ ] Export generates valid CSV
- [ ] No console errors
- [ ] Documentation updated
- [ ] Tested with real customer data
- [ ] Performance targets met (<2s load time)
- [ ] Stakeholder sign-off

---

## 📝 NOTES & LEARNINGS

**Challenges Faced**:
_______________________________________________________

**Solutions Found**:
_______________________________________________________

**Things to Remember for Next Project**:
_______________________________________________________

---

## 🔗 USEFUL LINKS

- **Project Root**: ~/Documents/stem-crm-backend/
- **Dashboard URL**: http://localhost:3000/competitive-intelligence
- **Prisma Studio**: `npx dotenv -e .env -- prisma studio`
- **API Docs**: (Add link when created)

---

**Project Status**: 🔴 NOT STARTED

**Last Updated**: _________ (Date)

**Next Session**: Focus on Tasks 1.1, 1.2, 2.1 (First API endpoint)