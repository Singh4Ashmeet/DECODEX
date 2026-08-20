# Decodex — Frontend Specification Document

**Version:** 1.0  
**Date:** 2026-07-19  
**Team:** TeraBytes  
**Status:** Draft — Awaiting UI/UX Review  

---

## 1. Overview

The Decodex frontend is a **React Single Page Application (SPA)** built with Vite. It handles microphone capture, real-time feedback during reading sessions, result visualization, and dashboards for three distinct user roles: Student, Teacher, and Parent.

---

## 2. Technology Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | React | 18.x | Component-based, strong ecosystem, team familiarity |
| **Build Tool** | Vite | 5.x | Fast HMR, native ESM, optimal DX |
| **Routing** | React Router | 6.x | Standard SPA routing with nested layouts |
| **State Management** | React Context + useReducer | Built-in | Sufficient for MVP; avoids Redux boilerplate |
| **HTTP Client** | Fetch API (native) | Built-in | No additional dependency; interceptors via wrapper |
| **Charts** | Recharts | 2.x | React-native charting, lightweight |
| **Styling** | Vanilla CSS with CSS Custom Properties | — | Maximum control, design-system-driven, no framework lock-in |
| **Audio** | MediaRecorder API | Web Standard | Browser-native mic capture |
| **Icons** | Lucide React | Latest | Clean, consistent icon set |
| **Fonts** | Google Fonts (Inter, Outfit) | — | Modern, highly legible typography |

---

## 3. Design System

### 3.1 Color Palette

```css
:root {
  /* Primary — Deep Indigo (trust, intelligence) */
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;
  --color-primary-800: #3730a3;
  --color-primary-900: #312e81;

  /* Accent — Warm Amber (encouragement, energy) */
  --color-accent-400: #fbbf24;
  --color-accent-500: #f59e0b;
  --color-accent-600: #d97706;

  /* Semantic */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-uncertain: #a78bfa;   /* Purple tint for uncertain classifications */

  /* Error Category Colors (consistent across all views) */
  --color-rev: #f87171;         /* Reversals — red */
  --color-sub: #fb923c;         /* Substitutions — orange */
  --color-omi: #facc15;         /* Omissions — yellow */
  --color-ins: #4ade80;         /* Insertions — green */
  --color-bld: #60a5fa;         /* Blend breakdowns — blue */
  --color-pac: #c084fc;         /* Pacing anomalies — purple */

  /* Surfaces (Dark Mode Default) */
  --surface-bg: #0f0f1a;
  --surface-card: #1a1a2e;
  --surface-card-hover: #25253f;
  --surface-elevated: #2a2a4a;
  --surface-glass: rgba(255, 255, 255, 0.05);

  /* Text */
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-on-primary: #ffffff;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 30px rgba(99, 102, 241, 0.15);

  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Outfit', var(--font-sans);
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;
}
```

### 3.2 Typography Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-display` | 36px | 700 | 1.1 | Page headings, hero text |
| `--text-h1` | 28px | 700 | 1.2 | Section headings |
| `--text-h2` | 22px | 600 | 1.3 | Card titles, sub-section headings |
| `--text-h3` | 18px | 600 | 1.4 | Widget titles |
| `--text-body` | 16px | 400 | 1.6 | Body copy, passage text |
| `--text-body-sm` | 14px | 400 | 1.5 | Secondary text, labels |
| `--text-caption` | 12px | 500 | 1.4 | Captions, timestamps, badges |
| `--text-passage` | 20px | 400 | 2.0 | Reading passage display (extra line height for readability) |

### 3.3 Component Library

#### Buttons

| Variant | Visual | Usage |
|---------|--------|-------|
| **Primary** | Solid indigo fill, white text, subtle glow on hover | Main CTAs (Start Reading, Submit) |
| **Secondary** | Ghost with indigo border, indigo text | Secondary actions (View Details, Export) |
| **Danger** | Solid red fill | Destructive actions (Delete, Cancel Session) |
| **Icon Button** | Circle, transparent bg, hover fill | Toolbar actions, close buttons |
| **Mic Button** | Large circle (64px), pulsing animation when recording | Start/stop recording |

#### Cards

| Variant | Visual | Usage |
|---------|--------|-------|
| **Base Card** | `surface-card` bg, subtle border, `radius-lg`, `shadow-sm` | Container for all content blocks |
| **Glass Card** | Semi-transparent with backdrop blur | Overlay content, featured items |
| **Stat Card** | Card with large number, label, and trend indicator | Dashboard KPI tiles |
| **Passage Card** | Card with title, difficulty badge, word count | Passage selection grid |

#### Badges & Tags

| Variant | Usage |
|---------|-------|
| **Error Category Badge** | Colored pill matching category color (REV=red, BLD=blue, etc.) |
| **Difficulty Badge** | Easy (green), Medium (amber), Hard (red) |
| **Confidence Badge** | "Uncertain" badge in purple for flagged classifications |
| **Status Badge** | Processing (amber pulse), Complete (green), Error (red) |

---

## 4. Page Structure & Routing

### 4.1 Route Map

```
/                           → Landing / Login
/auth/login                 → Login page
/auth/register              → Registration page
/auth/consent               → Parental consent flow

/student                    → Student Dashboard (home)
/student/read               → Passage selection
/student/read/:passageId    → Reading session (mic capture)
/student/results/:sessionId → Session results (alignment + drills)
/student/progress           → Progress over time
/student/drills             → Active drill queue

/teacher                    → Teacher Dashboard (home)
/teacher/students           → Student list
/teacher/students/:id       → Individual student profile
/teacher/students/:id/sessions → Student session history
/teacher/class              → Class-level analytics
/teacher/passages           → Passage management
/teacher/reports            → Export reports

/parent                     → Parent Dashboard (home)
/parent/children/:id        → Child's profile view
/parent/children/:id/report → Weekly report view
```

### 4.2 Layout Structure

```
┌────────────────────────────────────────────────────────┐
│  Top Navigation Bar                                     │
│  [Logo]  [Dashboard]  [Read]  [Progress]  [Avatar ▾]   │
├──────┬─────────────────────────────────────────────────┤
│      │                                                  │
│ Side │          Main Content Area                       │
│ Nav  │                                                  │
│(opt) │          (varies by route)                       │
│      │                                                  │
│      │                                                  │
├──────┴─────────────────────────────────────────────────┤
│  Footer (minimal — links, version, disclaimer)          │
└────────────────────────────────────────────────────────┘
```

- **Student views**: No sidebar. Clean, focused layout. Top nav only.
- **Teacher views**: Collapsible sidebar with student list + navigation.
- **Parent views**: No sidebar. Simple top nav.

---

## 5. Page Specifications

### 5.1 Landing / Login Page

**Route:** `/` and `/auth/login`

**Layout:**
- Split layout: left side = hero illustration/animation, right side = login form
- Animated gradient background (`primary-600` → `primary-900`)
- Glassmorphism login card

**Elements:**
| Element | Description |
|---------|-------------|
| Logo + tagline | "Decodex — Find the gap. Close the gap." |
| Login form | Email + password fields, "Remember me" checkbox |
| Social login | Google OAuth button (Phase 2) |
| Role selector | Toggle: "I'm a Student" / "I'm a Teacher" / "I'm a Parent" |
| Register link | "Don't have an account? Sign up" |
| Footer disclaimer | "Decodex is an educational screening tool, not a clinical diagnosis." |

**Animations:**
- Logo entrance: fade-in + scale from 0.8 → 1.0 (400ms ease-out)
- Form fields: staggered slide-up entrance (100ms delay per field)
- Background: slow-moving gradient animation (15s loop)

### 5.2 Passage Selection Page (Student)

**Route:** `/student/read`

**Layout:**
- Header: "Choose a Passage" with grade-level filter dropdown
- Grid of passage cards (3 columns on desktop, 2 on tablet, 1 on mobile)
- Each card shows: title, difficulty badge, word count, category tag

**Interactions:**
- Hover: card lifts (`translateY(-4px)`) with shadow increase
- Click: navigate to reading session
- Filter: instant client-side filtering by grade level and difficulty

**Data Requirements:**
```typescript
interface Passage {
  id: string;
  title: string;
  content: string;
  gradeLevel: number;
  wordCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}
```

### 5.3 Reading Session Page (Student) — Core Experience

**Route:** `/student/read/:passageId`

**This is the most critical page in the application.**

**Layout — Three States:**

#### State 1: Pre-Recording
```
┌─────────────────────────────────────────────────┐
│                                                   │
│   📖 Passage Title                                │
│   Difficulty: Medium  |  Words: 120               │
│                                                   │
│   ┌─────────────────────────────────────────┐     │
│   │                                         │     │
│   │   The fox jumped over the lazy dog.     │     │
│   │   She ran quickly through the forest    │     │
│   │   and found a hidden path...            │     │
│   │                                         │     │
│   │   (full passage displayed, large text,  │     │
│   │    high line-height for readability)    │     │
│   │                                         │     │
│   └─────────────────────────────────────────┘     │
│                                                   │
│              🎙️ [ Start Reading ]                  │
│         (large primary button, mic icon)          │
│                                                   │
│   ℹ️ Read the passage aloud at your normal pace.  │
│      We'll listen and help you practice.          │
│                                                   │
└─────────────────────────────────────────────────┘
```

#### State 2: Recording Active
```
┌─────────────────────────────────────────────────┐
│                                                   │
│   📖 Passage Title                   ⏱️ 0:42      │
│                                                   │
│   ┌─────────────────────────────────────────┐     │
│   │                                         │     │
│   │   The fox jumped over the lazy dog.     │     │
│   │   She ran quickly through the forest    │     │
│   │   and found a hidden path...            │     │
│   │                                         │     │
│   └─────────────────────────────────────────┘     │
│                                                   │
│        🔴 Recording...  [ ⏹ Stop Reading ]         │
│        (pulsing red dot, waveform visualizer)     │
│                                                   │
│   Live transcript preview (Web Speech API):       │
│   "The fox jumped over the lazy dog she ran..."   │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Recording UI Details:**
- Pulsing red dot (CSS animation, `scale(1) → scale(1.3)`, 1s loop)
- Audio waveform visualizer using `AnalyserNode` (Web Audio API)
- Timer counting up from 0:00
- Live transcript preview (via Web Speech API, separate from Whisper — used only for feedback, not classification)
- "Stop Reading" button replaces "Start Reading"

#### State 3: Processing
```
┌─────────────────────────────────────────────────┐
│                                                   │
│        🔄 Analyzing your reading...               │
│                                                   │
│        Step 1: Transcribing audio... ✅            │
│        Step 2: Aligning with passage... ✅         │
│        Step 3: Finding patterns... ⏳              │
│        Step 4: Generating practice... ⬜           │
│                                                   │
│        (progress steps with animated spinner)     │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Processing UI Details:**
- Stepped progress indicator showing pipeline stages
- Each step transitions from ⬜ → ⏳ (spinning) → ✅ (check)
- Skeleton content previews where results will appear
- Estimated time remaining (based on audio length)
- Smooth transition to results when complete

### 5.4 Session Results Page (Student)

**Route:** `/student/results/:sessionId`

**Layout — Three Sections:**

#### Section 1: Alignment View
```
┌─────────────────────────────────────────────────────────┐
│  📊 Your Reading Results                                 │
│                                                          │
│  Words read: 120  |  Time: 1:42  |  WPM: 70  |  Errors: 7│
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │                                                   │   │
│  │  The [fox] jumped over the [lazy] dog.            │   │
│  │  She ran [quickly] through the forest             │   │
│  │  and found a [hidden] path near the               │   │
│  │  [stream] that led to the village.                │   │
│  │                                                   │   │
│  │  Legend: 🟢 Correct  🔴 Error  🟣 Uncertain       │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Hover over a highlighted word to see details:           │
│  ┌──────────────────────────┐                            │
│  │ Source: "quickly"        │                            │
│  │ You said: "quikly"      │                            │
│  │ Type: Blend Breakdown 🔵│                            │
│  │ Confidence: High ✅     │                            │
│  └──────────────────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

**Alignment View Details:**
- Source passage displayed with inline highlights:
  - 🟢 Green underline = correctly read
  - 🔴 Red highlight = classified error
  - 🟣 Purple highlight + dashed border = uncertain (low ASR confidence)
- Hover/tap on any highlighted word → tooltip showing source word, spoken word, error category, and confidence
- Color-coding matches the error category colors from the design system

#### Section 2: Error Profile Summary
```
┌─────────────────────────────────────────────────────────┐
│  📋 Error Profile                                        │
│                                                          │
│  ┌──────────────────┐  ┌────────────────────────────┐   │
│  │                   │  │                            │   │
│  │   [Donut Chart]   │  │  Reversals        ██░░ 2  │   │
│  │                   │  │  Substitutions     █░░░ 1  │   │
│  │  7 total errors   │  │  Omissions         ██░░ 2  │   │
│  │  2 uncertain      │  │  Blend Breakdowns  ███░ 3  │   │
│  │                   │  │  Pacing            █░░░ 1  │   │
│  │                   │  │  Uncertain         ██░░ 2  │   │
│  └──────────────────┘  └────────────────────────────┘   │
│                                                          │
│  ⚠️ 2 items flagged as uncertain (low recording quality) │
│     These are not counted in your error profile.         │
└─────────────────────────────────────────────────────────┘
```

#### Section 3: Generated Drills
```
┌─────────────────────────────────────────────────────────┐
│  🎯 Practice These                                       │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Drill 1: Blend Ladder 🔵                         │   │
│  │  Your strongest area to improve                   │   │
│  │                                                   │   │
│  │  Read each step out loud:                         │   │
│  │  s → st → str → stre → strea → stream            │   │
│  │                                                   │   │
│  │  [ Start Drill ]            [ Mark Complete ✓ ]   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Drill 2: Letter Pairs 🔴                         │   │
│  │  Practice telling b and d apart                   │   │
│  │                                                   │   │
│  │  Circle the 'b': b d b p d b q b d               │   │
│  │                                                   │   │
│  │  [ Start Drill ]            [ Mark Complete ✓ ]   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  [ Read Another Passage → ]                              │
└─────────────────────────────────────────────────────────┘
```

### 5.5 Student Progress Page

**Route:** `/student/progress`

**Elements:**
| Element | Description |
|---------|-------------|
| **Streak counter** | "🔥 5-day streak!" with flame animation |
| **Error rate trend line** | Line chart: error rate (%) over sessions (last 10 sessions) |
| **Category breakdown over time** | Stacked area chart showing how each error category evolves |
| **Total sessions** | Stat card with session count |
| **Best WPM** | Stat card with best words-per-minute achieved |
| **Improvement highlight** | "Your blend breakdowns dropped 40% in 2 weeks!" |

### 5.6 Teacher Dashboard

**Route:** `/teacher`

**Layout:**
```
┌──────┬──────────────────────────────────────────────────┐
│      │  👋 Welcome, Ms. Sharma                          │
│      │                                                   │
│ Side │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│ bar  │  │Students│ │Sessions│ │ Avg    │ │ Alerts │    │
│      │  │  24    │ │  156   │ │ Error  │ │   3    │    │
│ List │  │        │ │this wk │ │  12%   │ │        │    │
│ of   │  └────────┘ └────────┘ └────────┘ └────────┘    │
│ stu- │                                                   │
│ dents│  📊 Class Error Distribution                      │
│      │  ┌──────────────────────────────────────────┐    │
│ [Stu-│  │  [Stacked bar chart — all students'      │    │
│  dent│  │   error category breakdown]              │    │
│  1]  │  └──────────────────────────────────────────┘    │
│ [Stu-│                                                   │
│  dent│  ⚠️ Attention Needed                              │
│  2]  │  • Rahul: reversal rate spiked 30% this week     │
│ [Stu-│  • Priya: no sessions in 5 days                  │
│  dent│                                                   │
│  3]  │  📋 Recent Sessions                               │
│  ... │  [Session list with student name, date, stats]   │
└──────┴──────────────────────────────────────────────────┘
```

### 5.7 Teacher → Individual Student View

**Route:** `/teacher/students/:id`

**Elements:**
| Element | Description |
|---------|-------------|
| **Student header** | Name, grade, total sessions, last active |
| **Current error profile** | Donut chart + category bars (same as student results view) |
| **Trend chart** | Error rate over time, filterable by category |
| **Session history** | Table: date, passage, WPM, error count, link to session detail |
| **Classification feedback** | On each error in session detail, teacher can click "Wrong classification" → select correct category from dropdown → submitted as correction data for prompt tuning |
| **Drill completion rate** | What % of assigned drills the student completed |
| **Export button** | Download PDF report for this student |
| **Notes field** | Teacher can add private notes per student |

### 5.8 Parent Dashboard

**Route:** `/parent`

**Layout:** Simple, non-technical view optimized for parents who may not be tech-savvy.

**Elements:**
| Element | Description |
|---------|-------------|
| **Child card** | Child's name, grade, avatar, last session date |
| **Weekly summary** | "This week: 4 sessions, reading speed improved 8%, blend breakdowns reduced" |
| **Simple progress chart** | Single line: overall error rate over time (no category breakdown — keep it simple) |
| **Recent drills** | What drills were assigned and whether they were completed |
| **Recommendations** | 2–3 plain-language suggestions: "Practice reading words with 'str' sounds together" |

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|---------------|
| **Mobile** | < 640px | Single column, bottom navigation, full-width cards, mic button pinned to bottom |
| **Tablet** | 640px – 1024px | 2-column grid, collapsible sidebar, touch-optimized drill interactions |
| **Desktop** | > 1024px | 3-column grid, persistent sidebar (teacher), hover interactions enabled |

### 6.1 Critical Mobile Adaptations

- **Reading session page**: Passage text scales to `--text-body` (16px) on mobile (from 20px on desktop) with maintained high line-height
- **Mic button**: Fixed to bottom of viewport on mobile, always accessible
- **Results page**: Alignment view scrolls horizontally on mobile if needed; drills stack vertically
- **Dashboard charts**: Horizontal scroll for charts that don't fit; simplified axis labels

---

## 7. Animations & Micro-Interactions

### 7.1 Global Animations

| Animation | Trigger | CSS |
|-----------|---------|-----|
| **Page transition** | Route change | `opacity 0→1, translateY(8px)→0` over 300ms |
| **Card entrance** | Page load / scroll into view | Staggered `opacity 0→1, translateY(16px)→0`, 50ms delay between cards |
| **Button hover** | Hover | `translateY(-1px)`, shadow increase, 150ms ease |
| **Button active** | Click | `scale(0.97)`, 100ms ease |
| **Skeleton shimmer** | Loading state | Linear gradient sweep from left to right, 1.5s loop |

### 7.2 Reading Session Animations

| Animation | Trigger | Detail |
|-----------|---------|--------|
| **Mic pulse** | Recording active | `scale(1) → scale(1.15)` on the outer ring, 1s ease-in-out infinite |
| **Recording dot** | Recording active | Red dot `opacity 0.5 → 1`, 0.8s infinite |
| **Waveform** | Recording active | Canvas-based audio visualizer using `AnalyserNode.getByteTimeDomainData()` |
| **Word highlight sweep** | Results loaded | Words highlight sequentially with 50ms delay, mimicking a reading cursor |
| **Drill card entrance** | Results loaded | Cards slide up from bottom with staggered timing |
| **Progress step transition** | Pipeline stage complete | Check icon pops in with `scale(0) → scale(1.2) → scale(1)` spring effect |

### 7.3 Dashboard Animations

| Animation | Trigger | Detail |
|-----------|---------|--------|
| **Chart draw** | Data loaded | Lines/bars animate from 0 to final value over 800ms |
| **Stat counter** | Page load | Numbers count up from 0 to final value over 600ms |
| **Trend arrow** | Data loaded | Bounce-in animation for improvement/decline indicators |
| **Alert badge** | New alert | Gentle pulse animation on first appearance |

---

## 8. Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| **WCAG 2.1 AA compliance** | All color contrasts ≥ 4.5:1 for text, ≥ 3:1 for large text |
| **Keyboard navigation** | All interactive elements focusable and operable via keyboard |
| **Screen reader support** | Semantic HTML, ARIA labels on all interactive elements, live regions for dynamic content |
| **Focus indicators** | Visible focus ring (2px solid `primary-400`, 2px offset) on all focusable elements |
| **Motion reduction** | `prefers-reduced-motion` media query disables all non-essential animations |
| **Font scaling** | All text uses `rem` units; respects browser font size settings |
| **Error messages** | All form errors announced via `aria-live="polite"` regions |
| **Reading passage** | OpenDyslexic font toggle available (user preference, stored in localStorage) |
| **Color-blind safety** | Error categories use both color AND icon/pattern to convey meaning |

---

## 9. State Management

### 9.1 Global State (React Context)

> [!IMPORTANT]
> **Auth tokens are stored in httpOnly cookies** (set by the server), NOT in localStorage or sessionStorage. This eliminates XSS-based token theft. The client never has direct access to the JWT — it is sent automatically with every request via `credentials: 'include'`.

```typescript
interface AppState {
  // Auth — token is in httpOnly cookie, NOT in JS-accessible state
  user: User | null;
  isAuthenticated: boolean;

  // Session
  activeSession: {
    sessionId: string | null;
    passageId: string | null;
    status: 'idle' | 'recording' | 'processing' | 'complete' | 'error';
    audioBlob: Blob | null;
    transcript: string | null;
    alignmentResult: AlignmentResult | null;
    classification: ClassificationResult | null;
    drills: Drill[] | null;
    processingStep: number; // 0-5 for progress indicator
  };

  // SSE connection for real-time processing updates
  sseConnection: EventSource | null;

  // Preferences
  preferences: {
    theme: 'dark' | 'light';
    fontFamily: 'inter' | 'opendyslexic';
    reducedMotion: boolean;
  };
}
```

### 9.2 Local Component State

| Component | Local State |
|-----------|-------------|
| **AudioRecorder** | `isRecording`, `duration`, `audioLevel` (from AnalyserNode) |
| **PassageSelector** | `filterGrade`, `filterDifficulty`, `searchQuery` |
| **AlignmentView** | `hoveredWordIndex`, `selectedCategory` |
| **DrillCard** | `isExpanded`, `isCompleted` |
| **Dashboard charts** | `timeRange`, `selectedStudent` |

### 9.3 Data Fetching Pattern

```typescript
// Custom hook pattern for API calls
// credentials: 'include' sends the httpOnly JWT cookie automatically
function useApiQuery<T>(url: string, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, {
      ...options,
      credentials: 'include',  // sends httpOnly cookie
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
      .then(res => {
        if (res.status === 401) throw new Error('AUTH_EXPIRED');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [url]);

  return { data, loading, error, refetch: () => setLoading(true) };
}
```

### 9.4 SSE Connection for Processing Status

```typescript
// Real-time processing updates via Server-Sent Events (replaces polling)
function useSessionSSE(sessionId: string | null, onStep: (step: number) => void) {
  useEffect(() => {
    if (!sessionId) return;
    const sse = new EventSource(`/api/v1/sessions/${sessionId}/status/stream`, {
      withCredentials: true,
    });
    sse.onmessage = (event) => {
      const { step, status } = JSON.parse(event.data);
      onStep(step);
      if (status === 'complete' || status === 'error') sse.close();
    };
    sse.onerror = () => sse.close();
    return () => sse.close();
  }, [sessionId]);
}
```

---

## 10. Audio Recording Implementation

### 10.1 MediaRecorder Setup

```typescript
interface AudioRecorderConfig {
  mimeType: 'audio/webm;codecs=opus' | 'audio/wav';
  audioBitsPerSecond: 128000;
  sampleRate: 16000;
  channelCount: 1; // Mono
}

// Permission request flow
async function requestMicPermission(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('PERMISSION_DENIED');
    } else if (err.name === 'NotFoundError') {
      throw new Error('NO_MICROPHONE');
    }
    throw err;
  }
}
```

### 10.2 Waveform Visualizer

```typescript
// Audio visualizer using Web Audio API AnalyserNode
function setupVisualizer(stream: MediaStream, canvas: HTMLCanvasElement) {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    // Render waveform to canvas...
  }
  draw();
}
```

---

## 11. Error States & Empty States

### 11.1 Error States

| Error | UI Treatment |
|-------|-------------|
| **Mic permission denied** | Full-page illustration + step-by-step browser permission guide |
| **No microphone found** | Card with troubleshooting steps |
| **Recording too short** | Inline banner: "Please read at least a few sentences for analysis" |
| **STT failed** | Retry button + "Try in a quieter environment" suggestion |
| **LLM timeout** | "Analysis is taking longer than expected. We'll email you when it's ready." |
| **Network offline** | Banner at top: "You're offline. Recordings will be analyzed when you reconnect." |
| **API rate limit** | "Too many requests. Please wait a moment." + countdown timer |

### 11.2 Empty States

| View | Empty State |
|------|-------------|
| **Student dashboard (no sessions)** | Illustration + "Start your first reading session!" CTA |
| **Progress page (no data)** | "Complete a few sessions to see your progress here." |
| **Teacher dashboard (no students)** | "Invite students to your class" + invite link generator |
| **Parent dashboard (no child linked)** | "Link your child's account" + code entry |
| **Drill queue (all complete)** | Celebration animation + "Great job! Read another passage to get new drills." |

---

## 12. Performance Targets

| Metric | Target |
|--------|--------|
| **First Contentful Paint (FCP)** | < 1.2s |
| **Largest Contentful Paint (LCP)** | < 2.0s |
| **Cumulative Layout Shift (CLS)** | < 0.05 |
| **First Input Delay (FID)** | < 50ms |
| **Total bundle size (gzipped)** | < 200KB (initial load) |
| **Chart render time** | < 300ms |
| **Route transition** | < 200ms |

### 12.1 Performance Strategies

- **Code splitting**: Route-based lazy loading via `React.lazy()` + `Suspense`
- **Asset optimization**: Vite's built-in tree-shaking and chunk splitting
- **Font loading**: `font-display: swap` + preload critical fonts
- **Image optimization**: WebP format, lazy loading for non-critical images
- **Memoization**: `React.memo` for expensive chart components
- **Virtual scrolling**: For teacher's student list (if > 50 students)

---

## 13. Browser Support Matrix

| Browser | Minimum Version | MediaRecorder Support | Notes |
|---------|----------------|----------------------|-------|
| Chrome | 80+ | ✅ | Primary target |
| Firefox | 78+ | ✅ | Full support |
| Edge | 80+ | ✅ | Chromium-based |
| Safari | 14.1+ | ✅ (limited codecs) | May need wav fallback |
| Mobile Chrome | 80+ | ✅ | Android primary |
| Mobile Safari | 14.5+ | ⚠️ | MediaRecorder support varies; test thoroughly |

---

*End of Frontend Specification — Version 1.0*
