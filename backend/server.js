/**
 * AidConnect — Smart NGO Resource System
 * Complete Express + Socket.IO + MongoDB Backend
 * Version: 1.0.0
 */

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const compression= require('compression');
const jwt        = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const winston    = require('winston');

const { User, Volunteer, Report, Task, Notification, Inventory, SMSLog } = require('./models');

/* ══════════════════════════════════
   LOGGER
══════════════════════════════════ */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

/* ══════════════════════════════════
   APP SETUP
══════════════════════════════════ */
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 5000;

/* ── Middleware ── */
// Helmet with permissive CSP so frontend CDN scripts, inline JS, and external images all work
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'", "*"],
      scriptSrc:     ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                      "https://unpkg.com", "https://cdn.jsdelivr.net",
                      "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      styleSrc:      ["'self'", "'unsafe-inline'",
                      "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc:       ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc:        ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc:    ["'self'", "ws:", "wss:", "*"],
      workerSrc:     ["'self'", "blob:"],
      frameSrc:      ["'self'", "*"],
      scriptSrcAttr: ["'unsafe-inline'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
// Allow both direct server access (5000) and VS Code Live Server (5500)
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5000',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, Postman, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Serve frontend static files
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.redirect('/index.html'));

/* ── Global Rate Limiter ── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { success: false, error: 'Too many requests. Please try again later.' }
}));

/* ── Auth Rate Limiter ── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts. Please wait 15 minutes.' }
});

/* ══════════════════════════════════
   DATABASE CONNECTION
══════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aidconnect', {
  serverSelectionTimeoutMS: 5000
})
.then(() => logger.info('✅ MongoDB connected'))
.catch(err => logger.error(`❌ MongoDB connection error: ${err.message}`));

/* ══════════════════════════════════
   JWT UTILITIES
══════════════════════════════════ */
const signToken  = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });
const signRefresh= (id)       => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user || !req.user.isActive) return res.status(401).json({ success: false, error: 'User not found or deactivated' });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ success:false, error:'Access denied — insufficient permissions' });
  next();
};

/* ══════════════════════════════════
   VALIDATION HELPERS
══════════════════════════════════ */
const validate = validations => async (req, res, next) => {
  await Promise.all(validations.map(v => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

const respond = (res, data, code=200) => res.status(code).json({ success:true, ...data });
const error   = (res, msg,  code=500) => res.status(code).json({ success:false, error: msg });

/* ══════════════════════════════════
   SMART MATCHING ALGORITHM
══════════════════════════════════ */
/**
 * Score a volunteer for a given report/task
 * Weights: Skill 40% | Distance 30% | Availability 20% | Performance 10%
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function scoreVolunteer(volunteer, report) {
  const needed = report.skillsNeeded || [];
  const has    = volunteer.skills || [];

  // Skill Score (0-40)
  const matchedSkills = needed.filter(s => has.includes(s)).length;
  const skillScore = needed.length > 0 ? (matchedSkills / needed.length) * 40 : 40;

  // Distance Score (0-30) — closer = higher
  let distScore = 0;
  if (volunteer.location?.coordinates && report.location?.geo?.coordinates) {
    const [vLon, vLat] = volunteer.location.coordinates;
    const [rLon, rLat] = report.location.geo.coordinates;
    const dist = haversine(vLat, vLon, rLat, rLon);
    if (dist <= volunteer.radius) {
      distScore = Math.max(0, 30 - (dist / volunteer.radius) * 30);
    }
  }

  // Availability Score (0-20)
  const availMap = { 'full-time': 20, 'part-time': 15, 'weekends': 10, 'on-call': 8 };
  const availScore = availMap[volunteer.availability] || 8;

  // Performance Score (0-10)
  const perfScore = volunteer.totalRatings > 0 ? (volunteer.rating / 5) * 10 : 5;

  // Urgency Boost
  let boost = 0;
  if (report.severity === 'critical') boost = 5;
  if (volunteer.status === 'available') boost += 3;

  const total = Math.min(100, skillScore + distScore + availScore + perfScore + boost);
  return {
    volunteerId: volunteer._id,
    score: Math.round(total),
    breakdown: { skillScore: Math.round(skillScore), distScore: Math.round(distScore), availScore, perfScore: Math.round(perfScore) },
    distance: volunteer._tempDist || null
  };
}

async function findBestVolunteers(report, limit=5) {
  const volunteers = await Volunteer.find({
    status: { $in: ['available', 'on-call'] },
    isVerified: true
  }).populate('user', 'name phone email');

  const scored = volunteers.map(v => scoreVolunteer(v, report));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/* ══════════════════════════════════
   SMS PARSER (Offline Reports)
══════════════════════════════════ */
/**
 * Expected format: REPORT <TYPE> <PINCODE> <MESSAGE>
 * Example: REPORT FL 482001 Flooding near market 50 families need help
 */
function parseSMS(text, phone) {
  const typeMap = {
    'FL': 'flood', 'MD': 'medical', 'FD': 'food', 'SH': 'shelter',
    'IN': 'infrastructure', 'FR': 'fire', 'EQ': 'earthquake', 'OT': 'other'
  };
  const parts = text.trim().toUpperCase().split(' ');
  if (parts[0] !== 'REPORT' || parts.length < 4) {
    return { isValid: false, error: 'Invalid format. Use: REPORT <TYPE> <PINCODE> <MESSAGE>' };
  }
  const category = typeMap[parts[1]];
  if (!category) return { isValid: false, error: `Unknown type "${parts[1]}". Use: FL/MD/FD/SH/IN/FR/EQ/OT` };
  const pincode = parts[2];
  const message = parts.slice(3).join(' ');
  return { isValid: true, category, pincode, message, severity: 'high', phone };
}

/* ══════════════════════════════════
   NOTIFICATION SENDER
══════════════════════════════════ */
async function sendNotification({ recipientId, type, title, message, data={}, socketId=null }) {
  try {
    const notif = await Notification.create({ recipient: recipientId, type, title, message, data, channel: ['in-app'] });
    // Emit real-time via Socket.IO
    io.to(`user_${recipientId}`).emit('notification', notif);
    // In production: also send push (Firebase), SMS (Fast2SMS)
    return notif;
  } catch (e) {
    logger.error(`Notification error: ${e.message}`);
  }
}

/* ══════════════════════════════════
   ─── ROUTES ───
══════════════════════════════════ */

/* ── Health Check ── */
app.get('/api/health', (req, res) => {
  respond(res, {
    status: 'OK',
    server: 'AidConnect API v1.0.0',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

/* ══════════════════════════════════
   AUTH ROUTES
══════════════════════════════════ */
// POST /api/auth/register
app.post('/api/auth/register', authLimiter, validate([
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').trim().notEmpty().withMessage('Phone number required')
    .matches(/^[+]?[0-9\s\-().]{7,15}$/).withMessage('Enter a valid phone number (e.g. +91 98765 43210)'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['citizen','volunteer','coordinator','donor','ngo','admin'])
]), async (req, res) => {
  try {
    const { name, email, phone, password, role, zone } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return error(res, 'Email already registered', 409);

    const user = await User.create({ name, email, phone, password, role: role || 'citizen', zone });

    // If volunteer, create volunteer profile
    if (role === 'volunteer') {
      await Volunteer.create({ user: user._id, zone });
    }

    const accessToken  = signToken(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    await sendNotification({ recipientId: user._id, type:'system', title:'Welcome to AidConnect! 🌿', message:`Hello ${name}, your account has been created. Complete your profile to start volunteering.` });

    logger.info(`User registered: ${email} as ${role}`);
    respond(res, { message: 'Registration successful', user: user.toPublic(), accessToken, refreshToken }, 201);
  } catch (e) {
    logger.error(e.message);
    error(res, 'Registration failed: ' + e.message);
  }
});

// POST /api/auth/login
app.post('/api/auth/login', authLimiter, validate([
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
]), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return error(res, 'Invalid email or password', 401);
    }
    if (!user.isActive) return error(res, 'Account deactivated. Contact support.', 403);

    user.lastLogin = new Date();
    const accessToken  = signToken(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshTokens = user.refreshTokens.slice(-5); // keep last 5 only
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    logger.info(`Login: ${email}`);
    respond(res, { message: 'Login successful', user: user.toPublic(), accessToken, refreshToken });
  } catch (e) {
    error(res, 'Login failed: ' + e.message);
  }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return error(res, 'Refresh token required', 401);
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return error(res, 'User not found', 401);
    const stored = user.refreshTokens.find(t => t.token === refreshToken);
    if (!stored) return error(res, 'Invalid refresh token', 403);
    const accessToken = signToken(user._id, user.role);
    respond(res, { accessToken });
  } catch (e) {
    error(res, 'Token refresh failed', 403);
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', protect, async (req, res) => {
  const { refreshToken } = req.body;
  req.user.refreshTokens = req.user.refreshTokens.filter(t => t.token !== refreshToken);
  await req.user.save();
  respond(res, { message: 'Logged out successfully' });
});

// POST /api/auth/google
// Accepts a Google ID token from the frontend, verifies it server-side, and returns our own JWT
app.post('/api/auth/google', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return error(res, 'Google ID token required', 400);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com') {
      return error(res, 'Google Sign-In is not configured on this server. Please set GOOGLE_CLIENT_ID in .env', 503);
    }

    // Verify the token with Google's servers
    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      logger.error(`Google token verification failed: ${verifyErr.message}`);
      return error(res, 'Invalid Google token. Please try signing in again.', 401);
    }

    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return error(res, 'Google account email is not verified.', 400);
    }

    // Upsert user — find by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Existing user — link Google account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        user.picture = picture;
        user.isVerified = true;
      }
      user.lastLogin = new Date();
      user.picture = picture || user.picture;
    } else {
      // New user — create account
      user = new User({
        name,
        email,
        googleId,
        picture,
        authProvider: 'google',
        role: 'citizen',
        isVerified: true,
        isActive: true,
      });
    }

    const accessToken  = signToken(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    user.refreshTokens = user.refreshTokens.slice(-5);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    logger.info(`Google login: ${email} (${user.role})`);
    respond(res, {
      message: 'Google sign-in successful',
      user: user.toPublic(),
      accessToken,
      refreshToken,
      isNewUser: !!(user.createdAt && (Date.now() - user.createdAt.getTime()) < 5000)
    });
  } catch (e) {
    logger.error(`Google auth error: ${e.message}`);
    error(res, 'Google sign-in failed: ' + e.message);
  }
});

// GET /api/auth/me
app.get('/api/auth/me', protect, (req, res) => respond(res, { user: req.user }));

/* ══════════════════════════════════
   REPORT ROUTES
══════════════════════════════════ */
// GET /api/reports
app.get('/api/reports', protect, async (req, res) => {
  try {
    const { status, category, severity, zone, page=1, limit=20, sort='-createdAt' } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    if (zone)     filter['location.zone'] = zone;

    // Coordinators/admins see all; citizens/volunteers see their own
    if (!['coordinator','admin','ngo'].includes(req.user.role)) {
      filter.filedBy = req.user._id;
    }

    const skip = (parseInt(page)-1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      Report.find(filter).populate('filedBy','name email phone').populate('assignedVolunteers').sort(sort).skip(skip).limit(parseInt(limit)),
      Report.countDocuments(filter)
    ]);

    respond(res, { reports, total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)) });
  } catch (e) {
    error(res, e.message);
  }
});

// POST /api/reports
app.post('/api/reports', protect, validate([
  body('title').trim().notEmpty().isLength({ max:200 }),
  body('description').trim().notEmpty().isLength({ max:2000 }),
  body('category').isIn(['flood','medical','food','shelter','infrastructure','fire','earthquake','drought','other']),
  body('severity').isIn(['low','medium','high','critical'])
]), async (req, res) => {
  try {
    const { title, description, category, severity, location, peopleAffected, resourcesNeeded, skillsNeeded, filedVia, reporterPhone } = req.body;

    const report = await Report.create({
      title, description, category, severity,
      location: location || {},
      peopleAffected: peopleAffected || 0,
      resourcesNeeded: resourcesNeeded || [],
      skillsNeeded: skillsNeeded || [],
      filedBy: req.user._id,
      filedVia: filedVia || 'web',
      reporterPhone: reporterPhone || req.user.phone
    });

    // Auto-match volunteers
    const matches = await findBestVolunteers(report);

    // Notify coordinators of new report
    const coords = await User.find({ role: { $in: ['coordinator','admin'] } }).select('_id');
    for (const coord of coords) {
      await sendNotification({
        recipientId: coord._id,
        type: 'report_filed',
        title: `🆕 New ${severity.toUpperCase()} Report Filed`,
        message: `${title} — ${location?.city || 'Unknown'} · ${peopleAffected || '?'} people affected`,
        data: { reportId: report._id }
      });
    }

    logger.info(`Report created: ${report.reportId} by ${req.user.email}`);
    respond(res, { report, matches, message: `Report filed. ${matches.length} volunteers matched.` }, 201);
  } catch (e) {
    error(res, e.message);
  }
});

// GET /api/reports/:id
app.get('/api/reports/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('filedBy','name email phone')
      .populate({ path:'assignedVolunteers', populate: { path:'user', select:'name phone email' } })
      .populate({ path:'tasks', populate: { path:'assignedTo', populate:{ path:'user', select:'name' } } });
    if (!report) return error(res, 'Report not found', 404);
    respond(res, { report });
  } catch (e) { error(res, e.message); }
});

// PUT /api/reports/:id
app.put('/api/reports/:id', protect, authorize('coordinator','admin','ngo'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return error(res, 'Report not found', 404);

    Object.assign(report, req.body);
    if (note) report.updates.push({ note, by: req.user._id });
    if (status === 'resolved') { report.resolvedAt = new Date(); report.resolvedBy = req.user._id; }
    await report.save();

    io.emit('report:updated', { reportId: report._id, status: report.status });
    respond(res, { report });
  } catch (e) { error(res, e.message); }
});

// DELETE /api/reports/:id
app.delete('/api/reports/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    respond(res, { message: 'Report deleted' });
  } catch (e) { error(res, e.message); }
});

// POST /api/reports/:id/escalate
app.post('/api/reports/:id/escalate', protect, authorize('coordinator','admin'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return error(res, 'Report not found', 404);
    report.status = 'escalated';
    report.escalatedAt = new Date();
    report.escalationLevel = Math.min((report.escalationLevel || 0) + 1, 5);
    await report.save();
    const admins = await User.find({ role:'admin' }).select('_id');
    for (const a of admins) {
      await sendNotification({ recipientId: a._id, type:'escalation', title:'⚠️ Report Escalated', message:`${report.title} escalated to level ${report.escalationLevel}`, data:{ reportId:report._id } });
    }
    respond(res, { report, message: `Report escalated to level ${report.escalationLevel}` });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   VOLUNTEER ROUTES
══════════════════════════════════ */
// GET /api/volunteers
app.get('/api/volunteers', protect, authorize('coordinator','admin','ngo'), async (req, res) => {
  try {
    const { status, skill, zone, available, page=1, limit=20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (skill)  filter.skills = skill;
    if (zone)   filter.zone   = zone;
    if (available === 'true') filter.status = { $in: ['available','on-call'] };

    const skip = (parseInt(page)-1) * parseInt(limit);
    const [volunteers, total] = await Promise.all([
      Volunteer.find(filter).populate('user','name email phone').sort('-rating -completedTasks').skip(skip).limit(parseInt(limit)),
      Volunteer.countDocuments(filter)
    ]);
    respond(res, { volunteers, total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)) });
  } catch (e) { error(res, e.message); }
});

// GET /api/volunteers/me
app.get('/api/volunteers/me', protect, async (req, res) => {
  try {
    const vol = await Volunteer.findOne({ user: req.user._id }).populate('user','name email phone role');
    if (!vol) return error(res, 'Volunteer profile not found', 404);
    respond(res, { volunteer: vol });
  } catch (e) { error(res, e.message); }
});

// PUT /api/volunteers/me
app.put('/api/volunteers/me', protect, async (req, res) => {
  try {
    const { skills, availability, location, zone, radius, status } = req.body;
    const vol = await Volunteer.findOneAndUpdate(
      { user: req.user._id },
      { skills, availability, location, zone, radius, status },
      { new: true, upsert: true }
    ).populate('user','name email phone');
    io.emit('volunteer:updated', { id: vol._id, status: vol.status, location: vol.location });
    respond(res, { volunteer: vol });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   TASK ROUTES
══════════════════════════════════ */
// GET /api/tasks
app.get('/api/tasks', protect, async (req, res) => {
  try {
    const { status, priority, type, page=1, limit=20 } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (type)     filter.type     = type;

    if (req.user.role === 'volunteer') {
      const vol = await Volunteer.findOne({ user: req.user._id });
      if (vol) filter.assignedTo = vol._id;
    }

    const skip = (parseInt(page)-1) * parseInt(limit);
    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate({ path:'assignedTo', populate:{ path:'user', select:'name phone' } })
        .populate('report','reportId title severity')
        .populate('createdBy','name')
        .sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Task.countDocuments(filter)
    ]);
    respond(res, { tasks, total });
  } catch (e) { error(res, e.message); }
});

// POST /api/tasks
app.post('/api/tasks', protect, authorize('coordinator','admin','ngo'), validate([
  body('title').notEmpty(),
  body('type').isIn(['distribution','rescue','medical','survey','logistics','shelter','communication']),
  body('priority').isIn(['low','medium','high','urgent'])
]), async (req, res) => {
  try {
    const { title, description, type, priority, report, location, deadline, resources, skillsRequired, volunteerIds } = req.body;

    const task = await Task.create({
      title, description, type, priority, location,
      deadline: deadline ? new Date(deadline) : null,
      resources: resources || [],
      skillsRequired: skillsRequired || [],
      report: report || null,
      createdBy: req.user._id
    });

    let assignedVols = [];
    if (volunteerIds?.length) {
      assignedVols = volunteerIds;
    } else {
      // Auto-match
      const reportDoc = report ? await Report.findById(report) : null;
      if (reportDoc) {
        const matches = await findBestVolunteers(reportDoc, 1);
        if (matches.length) assignedVols = [matches[0].volunteerId];
      }
    }

    if (assignedVols.length) {
      const vols = await Volunteer.find({ _id: { $in: assignedVols } }).populate('user','_id name');
      task.assignedTo = vols.map(v => v._id);
      task.status = 'assigned';
      await task.save();

      // Notify each volunteer
      for (const v of vols) {
        await sendNotification({
          recipientId: v.user._id,
          type: 'task_assigned',
          title: `📋 New Task: ${title}`,
          message: `You have been assigned a ${priority.toUpperCase()} priority ${type} task. Deadline: ${deadline || 'ASAP'}`,
          data: { taskId: task._id }
        });
        await Volunteer.findByIdAndUpdate(v._id, { status: 'on-task' });
      }
    }

    if (report) await Report.findByIdAndUpdate(report, { $push: { tasks: task._id }, status: 'assigned' });

    io.emit('task:created', { task });
    logger.info(`Task created: ${task.title}`);
    respond(res, { task, message: `Task created. ${assignedVols.length} volunteer(s) assigned.` }, 201);
  } catch (e) { error(res, e.message); }
});

// PUT /api/tasks/:id/status
app.put('/api/tasks/:id/status', protect, async (req, res) => {
  try {
    const { status, completionNote, peopleHelped, proofMedia } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return error(res, 'Task not found', 404);

    task.status = status;
    if (status === 'in_progress') task.startedAt = new Date();
    if (status === 'completed') {
      task.completedAt = new Date();
      task.completionNote = completionNote;
      task.peopleHelped = peopleHelped || 0;
      task.proofMedia = proofMedia || [];

      // Update volunteer stats
      for (const volId of task.assignedTo) {
        await Volunteer.findByIdAndUpdate(volId, {
          $inc: { completedTasks: 1 },
          status: 'available'
        });
      }

      // Notify coordinator
      const coords = await User.find({ role: { $in:['coordinator','admin'] } }).select('_id');
      for (const c of coords) {
        await sendNotification({ recipientId: c._id, type:'task_completed', title:`✅ Task Completed`, message:`${task.title} — ${peopleHelped || 0} people helped`, data:{ taskId: task._id } });
      }
    }
    await task.save();
    io.emit('task:updated', { taskId: task._id, status });
    respond(res, { task });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   MATCH ROUTE
══════════════════════════════════ */
// POST /api/match
app.post('/api/match', protect, authorize('coordinator','admin','ngo'), async (req, res) => {
  try {
    const { reportId, limit=5 } = req.body;
    const report = await Report.findById(reportId);
    if (!report) return error(res, 'Report not found', 404);

    const matches = await findBestVolunteers(report, parseInt(limit));

    // Populate volunteer user details
    const populated = await Promise.all(matches.map(async m => {
      const vol = await Volunteer.findById(m.volunteerId).populate('user','name phone email');
      return { ...m, volunteer: vol };
    }));

    respond(res, { matches: populated, report: { id: report._id, title: report.title, severity: report.severity } });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   SOS ROUTE
══════════════════════════════════ */
// POST /api/sos
app.post('/api/sos', protect, async (req, res) => {
  try {
    const { lat, lng, message } = req.body;
    const sosId = uuidv4();

    logger.warn(`🆘 SOS from ${req.user.name} at [${lat}, ${lng}]`);

    // Broadcast to all coordinators and admins via Socket.IO
    io.emit('sos:alert', {
      id: sosId,
      user: { name: req.user.name, phone: req.user.phone, id: req.user._id },
      location: { lat, lng },
      message: message || 'Emergency SOS',
      timestamp: new Date().toISOString()
    });

    // Create urgent report
    const report = await Report.create({
      title: `🆘 SOS — ${req.user.name}`,
      description: `Emergency SOS triggered by ${req.user.name}. ${message || ''}`,
      category: 'other',
      severity: 'critical',
      location: { geo: { type:'Point', coordinates:[lng, lat] } },
      filedBy: req.user._id, filedVia: 'app', status: 'open'
    });

    // Notify coordinators
    const coords = await User.find({ role: { $in:['coordinator','admin'] } }).select('_id');
    for (const c of coords) {
      await sendNotification({ recipientId: c._id, type:'sos', title:'🆘 EMERGENCY SOS ALERT', message:`${req.user.name} needs immediate help at [${lat?.toFixed(4)},${lng?.toFixed(4)}]`, data:{ sosId, userId: req.user._id, lat, lng } });
    }

    respond(res, { sosId, reportId: report._id, message: 'SOS sent. Help is on the way.' });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   SMS WEBHOOK (simulate Fast2SMS)
══════════════════════════════════ */
// POST /api/sms/webhook
app.post('/api/sms/webhook', async (req, res) => {
  try {
    const { message, sender } = req.body;
    const log = await SMSLog.create({ phone: sender, rawText: message });
    const parsed = parseSMS(message, sender);
    log.parsed = parsed;

    if (parsed.isValid) {
      const report = await Report.create({
        title: `SMS Report — ${parsed.category.toUpperCase()} — PIN ${parsed.pincode}`,
        description: parsed.message,
        category: parsed.category,
        severity: parsed.severity || 'high',
        location: { pincode: parsed.pincode },
        filedVia: 'sms', reporterPhone: sender
      });
      log.reportCreated = report._id;
      io.emit('report:new_sms', { report, phone: sender });
      logger.info(`SMS report created from ${sender}: ${report.reportId}`);
    }
    await log.save();
    res.status(200).send('OK');
  } catch (e) {
    logger.error(e.message);
    res.status(200).send('OK'); // Always 200 for SMS webhook
  }
});

/* ══════════════════════════════════
   NOTIFICATION ROUTES
══════════════════════════════════ */
// GET /api/notifications
app.get('/api/notifications', protect, async (req, res) => {
  try {
    const notifs = await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(50);
    const unread = notifs.filter(n => !n.isRead).length;
    respond(res, { notifications: notifs, unread });
  } catch (e) { error(res, e.message); }
});

// PUT /api/notifications/read-all
app.put('/api/notifications/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    respond(res, { message: 'All notifications marked as read' });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   INVENTORY ROUTES
══════════════════════════════════ */
// GET /api/inventory
app.get('/api/inventory', protect, async (req, res) => {
  try {
    const { zone } = req.query;
    const filter = zone ? { zone } : {};
    const items = await Inventory.find(filter).populate('updatedBy','name');
    const lowStock = items.filter(i => i.quantity <= i.minThreshold);
    respond(res, { inventory: items, lowStock });
  } catch (e) { error(res, e.message); }
});

// PUT /api/inventory/:id
app.put('/api/inventory/:id', protect, authorize('coordinator','admin'), async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, { ...req.body, lastUpdated: new Date(), updatedBy: req.user._id }, { new: true });
    if (item.quantity <= item.minThreshold) {
      io.emit('inventory:low_stock', { item });
    }
    respond(res, { item });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   ANALYTICS / STATS
══════════════════════════════════ */
app.get('/api/stats', protect, authorize('coordinator','admin','ngo'), async (req, res) => {
  try {
    const [
      totalReports, openReports, resolvedReports,
      totalVolunteers, activeVolunteers,
      totalTasks, completedTasks,
      criticalReports
    ] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: { $in: ['open','in_progress'] } }),
      Report.countDocuments({ status: 'resolved' }),
      Volunteer.countDocuments(),
      Volunteer.countDocuments({ status: { $in: ['available','on-task'] } }),
      Task.countDocuments(),
      Task.countDocuments({ status:'completed' }),
      Report.countDocuments({ severity:'critical', status:{ $ne:'resolved' } })
    ]);

    // Reports per day last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
    const daily = await Report.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum:1 } } },
      { $sort: { _id: 1 } }
    ]);

    const byCategory = await Report.aggregate([
      { $group: { _id: '$category', count: { $sum:1 } } }
    ]);

    respond(res, { stats: { totalReports, openReports, resolvedReports, totalVolunteers, activeVolunteers, totalTasks, completedTasks, criticalReports }, daily, byCategory });
  } catch (e) { error(res, e.message); }
});

/* ══════════════════════════════════
   SOCKET.IO — REAL-TIME
══════════════════════════════════ */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch (e) { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);

  // Join personal room
  socket.join(`user_${socket.userId}`);

  // Volunteer location update
  socket.on('volunteer:location', async ({ lat, lng }) => {
    try {
      await Volunteer.findOneAndUpdate(
        { user: socket.userId },
        { location: { type:'Point', coordinates:[lng, lat] } }
      );
      io.emit('volunteer:location:broadcast', { userId: socket.userId, lat, lng });
    } catch (e) { logger.error(e.message); }
  });

  // Task status update
  socket.on('task:update', ({ taskId, status }) => {
    io.emit('task:status_change', { taskId, status, userId: socket.userId });
  });

  // Chat between coordinator and volunteer
  socket.on('chat:message', ({ to, message }) => {
    io.to(`user_${to}`).emit('chat:message', {
      from: socket.userId,
      message, timestamp: new Date().toISOString()
    });
  });

  // SOS from mobile
  socket.on('sos:trigger', async (data) => {
    io.emit('sos:alert', { ...data, userId: socket.userId, timestamp: new Date().toISOString() });
    logger.warn(`🆘 SOS socket from ${socket.userId}: ${JSON.stringify(data)}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

/* ══════════════════════════════════
   ERROR HANDLER
══════════════════════════════════ */
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} — ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.use((req, res) => res.status(404).json({ success: false, error: `Route ${req.method} ${req.url} not found` }));

/* ══════════════════════════════════
   START SERVER
══════════════════════════════════ */
server.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════╗
  ║   🌿 AidConnect API  v1.0.0          ║
  ║   Port  : ${PORT}                        ║
  ║   Mode  : ${process.env.NODE_ENV || 'development'}                ║
  ║   Health: http://localhost:${PORT}/api/health ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
