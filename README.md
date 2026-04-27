# 🌿 AidConnect — Smart NGO Resource System

> India's most advanced disaster relief coordination platform — AI-powered volunteer matching, offline-first architecture, real-time crisis mapping, and full-stack resource management.

---

## 📁 Complete Project Structure

```
NGO/
├── 📄 index.html          → Public landing page (hero, SOS, map, crises)
├── 📄 login.html          → Authentication (Sign In / Sign Up, 6 roles)
├── 📄 dashboard.html      → Coordinator dashboard (charts, reports, tasks)
├── 📄 reports.html        → Reports management (table + kanban, filters)
├── 📄 volunteer.html      → Volunteer portal (tasks, GPS, SOS, badges)
├── 📄 map.html            → Full-screen live crisis map
├── 📄 inventory.html      → Resource inventory (zone-wise stock management)
├── 📄 donors.html         → Donor portal (campaigns, impact, donation form)
├── js/
│   └── 📄 api.js          → Frontend API client (JWT, Socket.IO, offline sync)
└── backend/
    ├── 📄 server.js       → Complete Express + Socket.IO API server
    ├── 📄 models.js       → MongoDB schemas (7 entities)
    ├── 📄 seed.js         → Database seeder (demo data)
    ├── 📄 package.json    → Dependencies
    └── 📄 .env.example    → Environment variables template
```

---

## 🚀 Quick Start

### Step 1 — Prerequisites
```bash
# Install Node.js 18+ from https://nodejs.org
node --version   # Should show v18+
npm --version    # Should show 9+
```

### Step 2 — Frontend (No setup needed!)
Open any `.html` file directly in your browser, or serve with VS Code Live Server:
```
http://localhost:5500/index.html       → Landing page
http://localhost:5500/dashboard.html  → Dashboard
```

### Step 3 — Backend Setup
```bash
cd "C:\Users\shikh\Downloads\NGO\backend"

# Install dependencies
npm install

# Copy environment file
copy .env.example .env
```

### Step 4 — Configure MongoDB
Edit `backend/.env`:
```env
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.mongodb.net/aidconnect
```
> **Free MongoDB Atlas:** https://cloud.mongodb.com → Create free M0 cluster → Get connection string

### Step 5 — Seed Database
```bash
npm run seed
```
Output:
```
✅ Created 12 users
✅ Created 6 volunteer profiles
✅ Created 8 reports
✅ Created 4 tasks
✅ Created 20 inventory items
```

### Step 6 — Start Server
```bash
npm run dev     # Development (auto-restart)
npm start       # Production
```
Server runs at: `http://localhost:5000`

### Step 7 — Test Login
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aidconnect.org | Admin@123 |
| Coordinator | ayesha@aidconnect.org | Coord@123 |
| Volunteer | rahul@aidconnect.org | Vol@12345 |
| Donor | ananya.donor@gmail.com | Donor@123 |

---

## 🖥️ Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing | `/index.html` | Public hero, live crisis ticker, campaign cards, live map, volunteer CTA, SOS button |
| Login | `/login.html` | Split-screen auth with 6 role selection, Google/Phone OTP |
| Dashboard | `/dashboard.html` | Coordinator panel with real-time stats, reports table, Chart.js graphs |
| Reports | `/reports.html` | Table view + Kanban board, filters, smart matching trigger |
| Volunteer | `/volunteer.html` | My tasks, GPS navigation, SOS button, achievement badges |
| Map | `/map.html` | Full-screen Leaflet map with layer toggles, fly-to animation |
| Inventory | `/inventory.html` | Zone-wise stock tracking, charts, dispatch history |
| Donors | `/donors.html` | Campaign cards, donation form, fund allocation chart |

---

## ⚙️ Backend API Reference

**Base URL:** `http://localhost:5000/api`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, get JWT tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Revoke token |
| GET  | `/auth/me` | Get current user |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/reports` | List reports (filters: status, category, severity, zone) |
| POST | `/reports` | File new report (auto-matches volunteers) |
| GET  | `/reports/:id` | Get report details |
| PUT  | `/reports/:id` | Update report |
| DELETE | `/reports/:id` | Delete (admin only) |
| POST | `/reports/:id/escalate` | Escalate report |

### Volunteers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/volunteers` | List all volunteers |
| GET | `/volunteers/me` | My volunteer profile |
| PUT | `/volunteers/me` | Update profile, location, availability |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/tasks` | List tasks |
| POST | `/tasks` | Create & assign task (auto-match) |
| PUT  | `/tasks/:id/status` | Update status (in_progress, completed) |

### Smart Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/match` | `{ reportId, limit }` → scored volunteer list |

### SOS & Emergency
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sos` | `{ lat, lng, message }` → broadcasts to all coordinators |

### SMS (Offline Reports)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sms/webhook` | Parses SMS format: `REPORT FL 482001 Flooding near market` |

### Other
```
GET  /stats          → Dashboard analytics
GET  /inventory      → Stock levels
PUT  /inventory/:id  → Update stock
GET  /notifications  → My notifications
PUT  /notifications/read-all → Mark all read
GET  /health         → Server health check
```

---

## 🤖 Smart Matching Algorithm

**Scoring formula (100 points total):**
```
Total Score = Skill Match (40%) + Distance (30%) + Availability (20%) + Performance (10%) + Urgency Bonus
```

**Logic:**
1. Filter: `skills ∩ needed_skills`, `status = available/on-call`, `distance ≤ radius`
2. Score each volunteer
3. Sort descending
4. Return top N matches
5. If 0 matches → escalate to coordinator → broadcast to all zone volunteers

---

## 📵 Offline SMS Report Format

Citizens without internet can file reports by SMS:
```
REPORT <TYPE> <PINCODE> <MESSAGE>
```
| Code | Meaning |
|------|---------|
| FL   | Flood   |
| MD   | Medical |
| FD   | Food    |
| SH   | Shelter |
| IN   | Infrastructure |
| FR   | Fire    |
| EQ   | Earthquake |
| OT   | Other   |

**Example:**
```
REPORT FL 482001 Flooding near market area 50 families trapped on rooftops
```

---

## ⚡ Real-Time Events (Socket.IO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `notification` | Server → Client | New notification |
| `sos:alert` | Server → All | Emergency SOS broadcast |
| `report:updated` | Server → All | Report status changed |
| `task:created` | Server → All | New task created |
| `task:updated` | Server → All | Task status changed |
| `volunteer:location` | Client → Server | GPS location update |
| `volunteer:location:broadcast` | Server → Coordinators | Live volunteer positions |
| `report:new_sms` | Server → Coordinators | Incoming SMS report |
| `inventory:low_stock` | Server → Coordinators | Stock below threshold |

---

## 🔌 Free API Integrations

| Service | Use | Tier |
|---------|-----|------|
| **MongoDB Atlas** | Database | Free M0 (512MB) |
| **OpenStreetMap + Leaflet.js** | Maps | Free/Open Source |
| **Fast2SMS** | SMS gateway (India) | Free 50 SMS/day |
| **Firebase** | Push notifications | Free Spark plan |
| **Cloudinary** | Image uploads | Free 25GB |
| **Render/Railway** | Backend hosting | Free tier |
| **UptimeRobot** | Keep server awake | Free 50 monitors |

---

## 🌐 Deployment

### Frontend — GitHub Pages
```bash
# Push NGO/ folder to GitHub repo
# Enable Pages in Settings → Pages → main branch
```

### Backend — Render (Free)
1. Push `backend/` to GitHub
2. Create new Web Service on [render.com](https://render.com)
3. Set environment variables from `.env.example`
4. Deploy

### Keep Backend Alive
Add server URL to [UptimeRobot](https://uptimerobot.com) with 5-minute ping interval.

---

## 📱 PWA — Offline Support

The app works offline with:
- **IndexedDB (Dexie.js)** — local report storage
- **SMS fallback** — report via basic SMS
- **Auto-sync** — pending reports uploaded when internet returns

---

## 🔒 Security

- JWT with 15-minute access tokens + 7-day refresh tokens
- bcrypt password hashing (12 rounds)
- Rate limiting: 200 req/15min global, 20 req/15min auth
- Helmet.js security headers
- MongoDB sanitization
- Role-based access control (citizen/volunteer/coordinator/ngo/admin)

---

## 👥 Contributing

1. Fork the repository  
2. Create feature branch: `git checkout -b feature/new-feature`  
3. Commit: `git commit -m 'Add new feature'`  
4. Push & open Pull Request

---

## 📄 License

MIT License — Free to use for NGO and humanitarian purposes.

---

**Built with ❤️ for disaster relief workers across India**  
*AidConnect — Because every second counts in a crisis* 🌿
