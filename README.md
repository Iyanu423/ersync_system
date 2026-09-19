# ER-Sync (ersync_system)
> **Hospital Emergency Management & Coordination System**

## Overview
**ER-Sync** is a hybrid emergency medical coordination system that combines clinical AI triage text processing with a deterministic Decision Engine for real-time hospital matching, bed reservations, and auto-failover referral routing across regional healthcare networks.

This package contains everything needed to run the AI Governor system locally on any Windows machine without needing to connect to the original developer's laptop.

---

## 📁 Project Structure

```
AI-Governor-Hackathon/
├── README.md                                          # This file
├── TEAM_MODEL_ASSIGNMENTS.md                        # Team model assignments
├── backend/                                          # FastAPI Backend
│   ├── main.py                                      # Entry point & app initialization
│   ├── start_all.bat                                # One-click launcher script
│   ├── app/
│   │   ├── __init__.py                              # Package init
│   │   ├── main.py                                  # FastAPI application
│   │   ├── core/config.py                           # Settings & environment config
│   │   ├── api/                                     # REST API routes
│   │   │   ├── __init__.py
│   │   │   ├── routes/hospitals.py                # Hospital CRUD + status/capacity/specialists/facilities updates
│   │   │   ├── routes/simulation.py               # Simulation: update/stale/reset endpoints
│   │   │   ├── routes/demo.py                     # One-click demo scenario
│   │   │   ├── routes/governor.py                 # Governor matching engine
│   │   │   ├── routes/auth.py                     # Authentication dependencies
│   │   │   └── routes/referrals.py                # Referral routing system
│   │   ├── database/                                # SQLAlchemy session & models
│   │   ├── models/entities.py                     # Hospital, Bed, Specialty, Facility entities
│   │   ├── services/                              # Business logic services
│   │   ├── ai/                                     # Mock/OpenAI/Local LLM providers
│   │   ├── database/init_db.py                    # Database initialization & seeding
│   │   └── ...
│   ├── .venv/                                       # Python virtual environment (python 3.11)
│   ├── ai_governor.db                               # SQLite database (10 Lagos hospitals)
│   └── tests/                                       # Test suite (20/20 passing)
├── frontend/                                         # React + TypeScript + Vite UI
│   ├── src/
│   │   ├── App.tsx                                # Main app with 7-tab routing
│   │   ├── pages/                                 # All page components
│   │   │   ├── App.tsx                            # 7-tab routing (intake, command, hospital, network, analytics, hospital_staff, demo)
│   │   │   ├── Header.tsx                         # Role-based header with ADMIN/HOSPITAL_STAFF/PATIENT
│   │   │   ├── HospitalDashboardPage.tsx          # Dual-view: staff portal vs admin dashboard
│   │   │   ├── HospitalStaffPortalPage.tsx        # 7-section operational portal
│   │   │   ├── EmergencyIntakePage.tsx           # Emergency case intake
│   │   │   ├── GovernorCommandPage.tsx           # AI matching & dispatch
│   │   │   ├── AnalyticsPage.tsx                 # Charts & statistics
│   │   │   └── NetworkMapPage.tsx                # Visual network graph
│   │   ├── components/                            # Reusable UI components
│   │   │   ├── HospitalStaffPortal.tsx           # 7-section portal (Emergency Dept, Bed Capacity, Specialists, Facilities, Equipment, Current Capacity, Hospital Info)
│   │   │   └── Header.tsx                        # Role selector & navigation
│   │   ├── services/api.ts                        # ApiService with all hospital CRUD methods + header support
│   │   └── ...
│   ├── vite.config.ts                             # Vite config with /api proxy + tailwindcss
│   ├── package.json                                 # Dependencies (React 18, Tailwind v4, Leaflet)
│   └── dist/                                      # Production build output
├── data/
│   └── seed/
│       └── hospitals.json                         # 10 Lagos hospital seed data with specialties/facilities/beds
├── docker/                                           # Docker configuration (if needed)
└── scripts/                                         # Helper scripts
```

---

## ▶️ How to Launch

### Option 1: One-Click Launcher (Recommended)

**Windows Double-Click:**

1. Navigate to `backend/start_all.bat` and double-click it
2. OR run `start_all.bat` from the `ai-governor` root directory
3. The batch script will:
   - Start the backend FastAPI server on port **8000** (auto-selects available port if 8000 is busy)
   - Start the frontend Vite dev server on port **5173** (auto-ports: 5173/5174/5175)
   - Wire the Vite proxy (`/api` → `http://127.0.0.1:8000`)
   - Open the browser to `http://127.0.0.1:5173/`

**Manual Alternative:**

```batch
:: Start Backend
cd C:\path\to\ai-governor\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info

:: Start Frontend (new terminal)
cd C:\path\to\ai-governor\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

### Access the Application

| URL | Description |
|-----|-------------|
| `http://127.0.0.1:5173/` | Frontend dev server (all 7 tabs) |
| `http://127.0.0.1:5174/` | Production build (verified: 485 KB JS, 65 KB CSS) |
| `http://127.0.0.1:8000/api/docs` | FastAPI auto-docs (Swagger) |
| `http://127.0.0.1:8000/api/health` | Health check endpoint |

---

## 👥 Role System

Three roles are supported:

| Role | Access | Description |
|------|--------|-------------|
| **ADMIN (State EOC)** | Full access | Original 3-column dashboard with telemetry/specialists/facilities. Can create hospitals, manage all settings, run simulation reset |
| **HOSPITAL_STAFF** | Operational portal | 7-section hospital interface: Emergency Dept, Bed Capacity, Specialists, Facilities, Equipment, Current Capacity, Hospital Information. Can only modify their assigned hospital via `current_user.hospital_id` check |
| **PATIENT** | Limited view | Standard dashboard view, unchanged from original |

**Role Switching:**
- Click the **"Hospital Portal"** tab (emerald button)
- Select role from the dropdown that appears
- **Note:** Role selector is now always visible in the header (top-right)
- Switch from any tab by selecting a different role

---

## 🏥 Hospital Staff Portal (HOSPITAL_STAFF Role)

The 7-section operational interface includes:

| Section | Description |
|---------|-------------|
| **1. Emergency Department** | Auto-width Emergency Status dropdown, Accept/Reject controls |
| **2. Bed Capacity** | Compact input for updating bed counts |
| **3. Specialists** | Individual specialist cards with checkboxes + status badges |
| **4. Facilities** | Individual facility cards with checkboxes + status badges |
| **5. Equipment** | Individual equipment cards with checkboxes + status badges |
| **6. Current Capacity** | Summary statistics display |
| **7. Hospital Information** | Hospital details display |

**Design System:**
- **Style:** Liquid-glass / glassmorphism (frosted blur surfaces)
- **Color Palette:** Sky blue primary (`#3b82f6` tints across shades/tints)
- **Corners:** Rounded corners (1rem consistent radius)
- **Typography:** Clean sans-serif with hierarchical weights
- **Depth:** Soft shadows, subtle borders, soft gradients
- **Micro-interactions:** Hover states, transitions, animated sidebar toggling, animated case status changes

**Navigation:**
- **Desktop:** Persistent left sidebar (Dashboard, Incoming Cases, Case History, Resources/Capacity, Settings)
- **Mobile:** Hamburger menu → slide-out menu

**All updates persist to backend database** and affect the Governor matching engine (hospitals with zero beds/unavailable specialists excluded from rankings).

---

## 🔧 Backend API Endpoints

### Hospital Endpoints (require proper headers)

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/api/hospitals` | GET | ADMIN | List all hospitals (send `X-Demo-Role: ADMIN`, `X-Demo-Hospital: hosp_lagos_central`) |
| `/api/hospitals/{id}` | GET | Any | Get full hospital detail with specialties/facilities/beds |
| `/api/hospitals/{id}/status` | PATCH | HOSPITAL_STAFF | Update emergency status + accepting emergencies |
| `/api/hospitals/{id}/capacity` | PATCH | HOSPITAL_STAFF | Update overall capacity |
| `/api/hospitals/{id}/specialists` | PATCH | HOSPITAL_STAFF | Update specialist availability |
| `/api/hospitals/{id}/facilities` | PATCH | HOSPITAL_STAFF | Update facility availability |
| `/api/simulation/hospitals` | POST | Admin | Update simulation hospital telemetry |
| `/api/simulation/stale/{id}` | POST | Admin | Force hospital to be stale (demo) |
| `/api/simulation/reset` | POST | Admin | Reset to fresh seed state |

### Headers for API Calls

```http
Content-Type: application/json
X-Demo-Role: ADMIN  # or HOSPITAL_STAFF or PATIENT
X-Demo-Hospital: hosp_lagos_central
```

**Important:** The `X-Demo-Role` and `X-Demo-Hospital` headers must be sent with every API call for role-based routing to work correctly.

---

## 🧮 Governor Matching Engine

### Scoring Weights (Must Sum to 1.0)

| Weight | Percentage | Description |
|--------|------------|-------------|
| `WEIGHT_CAPABILITY` | 40% | Hospital capability match |
| `WEIGHT_ETA` | 30% | Estimated time of arrival |
| `WEIGHT_CAPACITY` | 15% | Available beds/capacity |
| `WEIGHT_SPECIALIST` | 10% | Specialist availability |
| `WEIGHT_FRESHNESS` | 5% | How recent the hospital data is |

### Hospital Freshness Penalties

| Age of Data | Category | Effect |
|-------------|----------|--------|
| `< 15 minutes` | FRESH | No penalty, included in rankings |
| `15-30 minutes` | AGING | Mild penalty |
| `30-60 minutes` | STALE | Moderate penalty |
| `> 60 minutes` | CRITICALLY_STALE | Strongly penalized/excluded from rankings |

**Every update** (status, capacity, specialists, facilities) creates an audit log entry and refreshes `last_status_update` timestamp.

### Demonstration: One-Click Mass Casualty

- **Endpoint:** `POST /api/demo/scenario/mass-casualty`
- **Requires:** `X-Demo-Role: ADMIN` header
- **Creates:** 20 simultaneous emergencies
- **Tests:** Governor matching engine under mass casualty conditions
- **20/20 tests passing** in the test suite

---

## 🗄️ Database

- **Type:** SQLite (`ai_governor.db`)
- **Location:** `backend/ai_governor.db`
- **Seed Data:** `data/seed/hospitals.json` (10 Lagos hospitals)
- **Tables:** Hospitals, EmergencyBeds, HospitalSpecialties, HospitalFacilities, Referrals, AuditEvents, GovernatorDecisionEngine state

**To reset simulation to fresh state:**
```bash
POST /api/simulation/reset  (Admin role required)
```
OR run the `reset_simulation` endpoint which:
- Rebuilds beds from seed file
- Resets specialties from seed file
- Resets facilities from seed file
- Sets `last_status_update` to fresh timestamps
- Preserves audit continuity

---

## 🛠️ Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.11)
- **Database:** SQLAlchemy + SQLite
- **API:** RESTful with automatic OpenAPI docs
- **Authentication:** Role-based headers (`X-Demo-Role`, `X-Demo-Hospital`)
- **Scoring:** Deterministic GovernorDecisionEngine with weighted scoring

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS v4 (custom glassmorphism design)
- **Routing:** React Router with 7 active tabs
- **State Management:** React hooks (useState, useEffect, useCallback)
- **Charts:** Chart.js / custom CSS for analytics
- **Mapping:** Leaflet (if geospatial features needed)

### Key Dependencies (Frontend)
- `react`, `react-dom` (18)
- `@tanstack/react-query` (data fetching)
- `tailwindcss` + `@tailwindcss/vite` (glassmorphism styling)
- `axios` (API client)
- `chart.js` (analytics charts)
- `lucide-react` (icons)

### Key Dependencies (Backend)
- `fastapi`, `uvicorn` (ASGI server)
- `sqlalchemy`, `alembic` (DB ORM)
- `pydantic-settings` (configuration)
- `python-jose` (JWT/have: actually using custom role headers)
- `httpx` (async HTTP client)

---

## 👨‍💻 Development & Customization

### Adding New Features

#### 1. **Add a New API Endpoint**
   - Create new route in `backend/app/api/routes/`
   - Add schema in `backend/app/schemas/schemas.py`
   - Export from `backend/app/api/routes/__init__.py`
   - Add frontend service method in `frontend/src/services/api.ts`
   - Add UI component in `frontend/src/pages/` or `frontend/src/components/`

#### 2. **Add a New Hospital Specialty**
   - Edit `data/seed/hospitals.json` to add specialty
   - Run `POST /api/simulation/reset` or restart backend
   - Or add via `POST /api/hospitals` (Admin role)

#### 2. **Add a New UI Page**
   - Create new component in `frontend/src/pages/`
   - Add route in `frontend/src/App.tsx`
   - Add navigation in `frontend/src/components/Header.tsx`

#### 3. **Change Color Palette**
   - Edit Tailwind config in `frontend/vite.config.ts`
   - Modify `glass-panel`, `glass-card` CSS classes
   - Update sky blue tint variations

#### 4. **Adjust Governor Scoring Weights**
   - Edit `backend/app/core/config.py`
   - Modify `WEIGHT_CAPABILITY`, `WEIGHT_ETA`, etc.
   - Weights must sum to 1.0

#### 5. **Add a New Role**
   - Define `UserRole` type in `frontend/src/types.ts`
   - Add role selector option in `frontend/src/components/Header.tsx`
   - Add role-check dependency in `backend/app/api/routes/`
   - Add PATCH endpoints with `require_hospital_staff` or custom deps

---

## 📦 What's Included in This Package

### Backend Files (Complete)
- ✅ `main.py` - FastAPI app initialization
- ✅ `core/config.py` - All settings & weights
- ✅ All API routes (`hospitals.py`, `simulation.py`, `governor.py`, `auth.py`, `referrals.py`, `demo.py`)
- ✅ SQLAlchemy models (`app/models/entities.py`)
- ✅ Database initialization (`app/database/init_db.py`)
- ✅ AI service providers (`app/ai/mock_provider.py`, `app/ai/openai_provider.py`, `app/ai/service.py`)
- ✅ Hospital service logic (`app/services/hospital_service.py`)
- ✅ Simulation service (`app/services/simulation_service.py`)
- ✅ Database file (`ai_governor.db` - 10 hospital seed data)
- ✅ Test suite (`backend/tests/test_governor.py` - 20/20 passing)
- ✅ Launcher script (`start_all.bat`)
- ✅ CORS configuration (whitelisted origins)

### Frontend Files (Complete)
- ✅ `App.tsx` - 7-tab routing system
- ✅ `Header.tsx` - Role-based navigation with always-visible role selector
- ✅ `HospitalDashboardPage.tsx` - Dual-view (staff portal vs admin)
- ✅ `HospitalStaffPortalPage.tsx` - 7-section operational portal
- ✅ `HospitalStaffPortal.tsx` - 7-section component with glassmorphism design
- ✅ All page components (EmergencyIntake, GovernorCommand, Analytics, NetworkMap, Demo)
- ✅ `ApiService` - All CRUD methods with header support
- ✅ `vite.config.ts` - Proxy config, Tailwind integration
- ✅ `package.json` - All dependencies listed
- ✅ Production build verified (485 KB JS, 65 KB CSS)

### Data & Configuration
- ✅ `data/seed/hospitals.json` - 10 Lagos hospitals with full data
- ✅ `TEAM_MODEL_ASSIGNMENTS.md` - Team model assignments
- ✅ `backend/start_all.bat` - One-click launcher
- ✅ CORS origins configured for local development

### Documentation
- ✅ This comprehensive README.md
- ✅ Inline code comments throughout
- ✅ Role system documentation
- ✅ API endpoint guide
- ✅ Launch instructions
- ✅ Customization instructions

---

## ⚠️ Known Issues & Workarounds

| Issue | Workaround |
|-------|------------|
| **Browser cache showing stale UI** | Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac) for hard refresh. Use incognito window for clean state. |
| **Role stuck on Hospital Staff** | Clear browser localStorage: `localStorage.removeItem('token')` then refresh. Role selector now always visible in header. |
| **Admin dashboard not showing after role switch** | Ensure `X-Demo-Role: ADMIN` header is sent. The Hospital Portal tab (emerald button) shows the admin view. |
| **Hospital data "Loading..." stuck** | Auto-selection fixes this: HospitalDashboardPage now auto-selects first hospital if none selected, or selects from JWT token for HOSPITAL_STAFF role. |
| **Production build port issues** | Production build runs on port 5174. Dev server on 5173. Use `npm run dev -- --host` for network access. |
| **CORS errors on first run** | The `start_all.bat` configures the Vite proxy automatically (`/api` → `127.0.0.1:8000`). Ensure both servers are running. |

---

## 📞 Team Collaboration

### Sharing with Team Members

1. **Copy this entire package folder** to each team member's laptop
2. **Double-click `start_all.bat`** on each machine
3. **Access `http://127.0.0.1:5173/`** in their browser
4. **Each user selects their role** from the header dropdown
5. **Each user can only modify their assigned hospital** (enforced by `current_user.hospital_id` backend check)

### No Shared Requirements

- ❌ No need to share the same laptop
- ❌ No need to share backend process
- ❌ No network dependency between machines
- ✅ Each instance runs locally and independently
- ✅ SQLite database is local to each machine
- ✅ All team members can run the same demo scenarios independently

---

## 🆘 Troubleshooting

### Common Startup Issues

| Problem | Solution |
|---------|----------|
| `start_all.bat` flashes and closes | Run each server manually in separate terminals |
| "Cannot find module" errors | Ensure you're running from the `ai-governor` root, and `backend/.venv` is active |
| Frontend shows "Failed to scan for dependencies" | Run `npm install` in the frontend directory first |
| Backend CORS blocking frontend | Ensure both servers started via `start_all.bat` (handles proxy config) |
| API returns `403: Staff can only modify their own hospital` | User must select their assigned hospital from the role, or the system auto-assigns based on JWT/hospital_id |
| Production build shows blank screen | Use `http://127.0.0.1:5174/` for production build (verified working). Dev server requires hard refresh (`Ctrl+Shift+R`). |
| Tests failing (20/20 not passing) | Ensure backend is running and database is seeded. Run `pytest backend/tests/test_governor.py` |

### Need Help?

- Check `backend/tests/test_governor.py` for test expectations
- Review `backend/app/core/config.py` for adjustable parameters
- Review `frontend/src/App.tsx` for tab routing structure
- Review `frontend/src/services/api.ts` for API method signatures
- The `TEAM_MODEL_ASSIGNMENTS.md` file contains team-specific model assignments

---

## 📄 Package Generated Successfully

This package is ready to be zipped and shared with team members. Each member can:
1. Extract the zip to any folder on their Windows laptop
2. Double-click `start_all.bat`
3. Access the full AI Governor system in their browser
4. Use all 7 tabs: Intake, Command, Hospital Portal, Network, Analytics, Hospital Staff, Demo
5. Switch between ADMIN, HOSPITAL_STAFF, and PATIENT roles
6. Create, modify, and reset hospital data
7. Run the one-click mass casualty demo
8. View audit logs and Governor matching decisions

---
*AI Governor Hackathon Project - Package generated on 2026-09-18. All systems verified working. Production build confirmed. 20/20 tests passing.*