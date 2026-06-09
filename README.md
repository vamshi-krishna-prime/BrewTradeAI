# BrewTrade AI

**Carib Brewery — International Product Ordering & Approval Intelligence Platform (POC)**

BrewTrade AI is a proof-of-concept platform that lets Carib Brewery's overseas distributors place orders, market managers approve them with a Claude-powered AI copilot, and executives observe the entire global business through analytics and a what-if simulation lab.

---

## Quick Start

### Option 1 — Single-click (Windows)
Double-click `launch_app.bat` in the project root. It will:

1. Verify Python and Node are installed
2. Create a Python virtual environment in `backend/.venv`
3. Install backend dependencies (cached after first run)
4. Install frontend dependencies (cached after first run)
5. Start the FastAPI backend on port **8000** in its own window
6. Start the Vite dev server on port **5173** in its own window
7. Open the app in your default browser

### Option 2 — Manual

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # (Windows)   or:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Then browse to **http://localhost:5173**.

---

## Demo Credentials

| Role | Username | Password |
| --- | --- | --- |
| Distributor | `caribbean_imports` *(or any seeded distributor — see login hints)* | `demo123` |
| Market Manager | `manager_demo` | `demo123` |
| Executive | `exec_demo` | `demo123` |

> Dozens of distributor accounts are seeded automatically, one per generated overseas distributor company. The login screen surfaces username/password hints under each role card. Additional manager logins exist as `manager_jamaica`, `manager_usa`, `manager_uk`, `manager_global`; additional executive: `ceo_demo`. All passwords are `demo123`.

---

## Configuring the Claude API Key

Claude (Anthropic) powers the AI Order Assistant, Decision Copilot, Explainability, Approval Reports and Executive Summary.

Edit `backend/config.py` and replace the placeholder:

```python
CLAUDE_API_KEY: str = "YOUR_CLAUDE_API_KEY_HERE"
CLAUDE_MODEL: str = "claude-sonnet-4-5"
```

Or create `backend/.env` with:

```
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-5
```

The app degrades gracefully — without a key, AI screens display the deterministic fallback content while the rest of the platform remains fully functional.

---

## Tech Stack

**Frontend**
- React 18 + Vite 5
- React Router v6, Material UI v5, Framer Motion
- TanStack Query v5, Axios
- Recharts + Plotly (`react-plotly.js`) for analytics & simulation visualisations

**Backend**
- Python 3 + FastAPI + Uvicorn
- SQLAlchemy + SQLite (`brewtrade.db`)
- Pydantic v2 + pydantic-settings
- Faker (seed data), APScheduler (auto-tick simulation), Pandas (analytics)
- Anthropic SDK (Claude)

---

## Folder Structure

```
BrewTrade AI/
├── launch_app.bat              <- one-click Windows launcher
├── README.md
├── backend/
│   ├── main.py                 FastAPI entry-point, scheduler, static mount
│   ├── config.py               Settings (Claude key, DB URL, CORS)
│   ├── database.py             SQLAlchemy engine + SessionLocal
│   ├── models.py               ORM models
│   ├── schemas.py              Pydantic request/response models
│   ├── requirements.txt
│   ├── routers/                auth, customers, products, merchandise,
│   │                           orders, promotions, documents, inventory,
│   │                           ai, simulation, analytics
│   ├── services/               claude_ai, simulation_engine, business_logic,
│   │                           pdf_generator, seed_data
│   └── static/                 served at /static (products / promotions /
│                               merchandise images, generated PDFs)
└── frontend/
    ├── index.html
    ├── package.json
    ├── public/                 logo + favicon
    └── src/
        ├── api/                axios client + typed API functions
        ├── components/         Layout shells + reusable UI (Glass / KPI / etc.)
        ├── contexts/           auth + cart contexts
        ├── pages/              20 route pages (see below)
        ├── theme.js            MUI theme (white + premium gold, glassmorphism)
        └── utils/              formatting helpers
```

---

## Feature Highlights — 20 Screens

### Distributor Portal (`/distributor/*`)
| Screen | Description |
| --- | --- |
| **Dashboard** | KPI tiles (active orders, credit usage, deliveries), quick actions, recent activity. |
| **Product Catalog** | Browseable Carib beer & beverage catalog with MOQ, available qty, market filters. |
| **Merchandise** | Branded apparel & POS material catalog. |
| **Cart** | Multi-line cart, freight & duty preview, submit for approval. |
| **My Orders** | All historical orders with status pipeline and search. |
| **Order Tracking** | Per-order timeline: pending → approved → in-transit → delivered. |
| **AR Dashboard** | Credit limit, outstanding balance, aging bucket, payment history. |
| **Documents** | Compliance docs (FDA, customs, COA, halal certs) per customer. |
| **Promotions** | Live trade promotions and seasonal offers. |
| **AI Order Assistant** | Claude-powered chat that drafts orders from natural language. |
| **Profile** | Distributor account details and contact preferences. |

### Market Manager Portal (`/manager/*`)
| Screen | Description |
| --- | --- |
| **Manager Dashboard** | Approval queue volume, SLA, market heatmap, AI alerts. |
| **Approval Queue** | All pending orders with risk scores and one-click approve / reject. |
| **Order Review** | Deep-dive on a single order: line items, customer AR, AI recommendation. |
| **AI Decision Copilot** | Multi-turn Claude assistant on the active order with structured tools. |
| **AI Explainability** | Feature-importance & rule trace for the AI recommendation. |
| **AI Approval Report** | Auto-generated narrative report (PDF-ready) of the approval decision. |

### Executive Portal (`/executive/*`)
| Screen | Description |
| --- | --- |
| **Executive Analytics** | Global revenue, market mix, top SKUs, growth & risk indicators. |
| **Simulation Lab** | What-if event injection (see below). |
| **AI Summary** | Claude-generated executive narrative over the latest KPIs. |

---

## Simulation Lab — Injectable Events

Trigger from `/executive/simulation`. The simulation engine writes events into the live DB and is also driven on a 60-second auto-tick by APScheduler so orders progress through their pipeline organically during a demo.

- **Demand Spike** — pushes a surge of orders for one or more SKUs in a market.
- **Inventory Shortage** — drains stock of a product to force trade-offs.
- **Inventory Recovery** — replenishes a previously shorted SKU.
- **Credit Risk** — degrades a distributor's AR health to test approval gating.
- **New Promotion** — spawns a time-limited trade promotion.
- **Shipping Delay** — extends in-transit time for active shipments.
- **New Customer** — onboards a new overseas distributor with seeded baseline.
- **Auto-Tick** *(scheduler-driven)* — every 60s the engine advances order statuses, ages AR, and updates inventory.

---

## API & Static

- FastAPI app: `http://localhost:8000`
- Interactive docs (Swagger): `http://localhost:8000/docs`
- Static assets: `http://localhost:8000/static/...`
- Vite frontend proxies `/api` to the backend.

---

## Troubleshooting

- **`launch_app.bat` reports Python or Node missing** — install Python 3.10+ and Node 18+, ensure both are on `PATH`, then re-run.
- **Reinstall backend deps** — delete `backend\.deps_installed` and re-run the launcher.
- **Reinstall frontend deps** — delete `frontend\node_modules` and re-run the launcher.
- **Reset demo data** — stop the backend, delete `backend\brewtrade.db`, restart. The startup hook re-seeds automatically.
- **CORS issues** — edit `CORS_ORIGINS` in `backend/config.py`.

---

## License

Demo / POC use only. Not for production deployment.

© Carib Brewery — BrewTrade AI POC.
