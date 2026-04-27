const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/* ─── USER ─── */
const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true, maxlength: 80 },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:        { type: String, trim: true, default: null },  // optional for Google OAuth users
  password:     { type: String, minlength: 8, select: false }, // optional for Google OAuth
  role:         { type: String, enum: ['citizen', 'volunteer', 'coordinator', 'donor', 'ngo', 'admin'], default: 'citizen' },
  zone:         { type: String, default: null },
  state:        { type: String, default: null },

  // Google OAuth fields
  googleId:     { type: String, default: null },
  picture:      { type: String, default: null },
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },

  isVerified:   { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
  pushTokens:   [String],
  createdAt:    { type: Date, default: Date.now }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  // Only hash password if it exists and was modified
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function(candidate) {
  if (!this.password) return false; // Google OAuth users have no password
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.toPublic = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  return obj;
};

/* ─── VOLUNTEER ─── */
const LocationSchema = new mongoose.Schema({
  type:        { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
}, { _id: false });

const VolunteerSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  skills:      [{ type: String, enum: ['medical', 'first-aid', 'rescue', 'driving', 'logistics', 'food-distribution', 'counseling', 'translation', 'survey', 'communication', 'swimming', 'construction', 'teaching'] }],
  availability: { type: String, enum: ['full-time', 'part-time', 'weekends', 'on-call'], default: 'on-call' },
  status:      { type: String, enum: ['available', 'busy', 'offline', 'on-task'], default: 'offline' },
  location:    LocationSchema,
  zone:        { type: String },
  radius:      { type: Number, default: 50 }, // km willing to travel
  rating:      { type: Number, default: 0, min: 0, max: 5 },
  totalRatings:{ type: Number, default: 0 },
  completedTasks: { type: Number, default: 0 },
  totalHours:  { type: Number, default: 0 },
  badges:      [{ name: String, earnedAt: Date }],
  isVerified:  { type: Boolean, default: false },
  joinedAt:    { type: Date, default: Date.now }
}, { timestamps: true });

VolunteerSchema.index({ location: '2dsphere' });

/* ─── REPORT ─── */
const ReportSchema = new mongoose.Schema({
  reportId:    { type: String, unique: true }, // auto-generated R-2026-XXXX
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 2000 },
  category:    { type: String, required: true, enum: ['flood', 'medical', 'food', 'shelter', 'infrastructure', 'fire', 'earthquake', 'drought', 'other'] },
  severity:    { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status:      { type: String, enum: ['open', 'in_progress', 'assigned', 'resolved', 'closed', 'escalated'], default: 'open' },
  location: {
    address:   String,
    city:      String,
    state:     String,
    pincode:   String,
    zone:      String,
    geo:       LocationSchema
  },
  peopleAffected: { type: Number, default: 0 },
  resourcesNeeded: [{ resource: String, quantity: Number, unit: String }],
  skillsNeeded:   [String],
  filedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  filedVia:    { type: String, enum: ['web', 'sms', 'app', 'phone', 'coordinator'], default: 'web' },
  reporterPhone: String,
  assignedVolunteers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' }],
  matchScore:  Number,
  tasks:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  media:       [{ url: String, type: { type: String, enum: ['image', 'video'] }, uploadedAt: Date }],
  updates:     [{ note: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
  resolvedAt:  Date,
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  escalatedAt: Date,
  escalationLevel: { type: Number, default: 0 } // 0-5
}, { timestamps: true });

ReportSchema.pre('save', function(next) {
  if (!this.reportId) {
    const y = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    this.reportId = `R-${y}-${rand}`;
  }
  next();
});

/* ─── TASK ─── */
const TaskSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: String,
  type:        { type: String, enum: ['distribution', 'rescue', 'medical', 'survey', 'logistics', 'shelter', 'communication'], required: true },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status:      { type: String, enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'failed'], default: 'pending' },
  report:      { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  assignedTo:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  location: {
    address: String, city: String, state: String, zone: String,
    geo: LocationSchema
  },
  deadline:    Date,
  startedAt:   Date,
  completedAt: Date,
  resources:   [{ resource: String, quantity: Number, unit: String }],
  skillsRequired: [String],
  completionNote: String,
  proofMedia:  [{ url: String, type: String }],
  peopleHelped: { type: Number, default: 0 },
  matchScores: [{ volunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' }, score: Number }]
}, { timestamps: true });

/* ─── NOTIFICATION ─── */
const NotificationSchema = new mongoose.Schema({
  recipient:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, enum: ['sos', 'task_assigned', 'task_completed', 'report_filed', 'report_resolved', 'resource_alert', 'volunteer_match', 'system', 'escalation'], required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  data:        mongoose.Schema.Types.Mixed,
  isRead:      { type: Boolean, default: false },
  readAt:      Date,
  channel:     [{ type: String, enum: ['push', 'sms', 'email', 'in-app'] }]
}, { timestamps: true });

/* ─── INVENTORY ─── */
const InventorySchema = new mongoose.Schema({
  resource:    { type: String, required: true },
  category:    { type: String, enum: ['food', 'medical', 'shelter', 'clothing', 'water', 'equipment', 'other'] },
  zone:        { type: String, required: true },
  quantity:    { type: Number, required: true, min: 0 },
  unit:        { type: String, default: 'units' },
  minThreshold:{ type: Number, default: 50 },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

/* ─── SMS LOG ─── */
const SMSLogSchema = new mongoose.Schema({
  phone:     { type: String, required: true },
  rawText:   { type: String, required: true },
  parsed:    {
    type:     String,
    category: String,
    pincode:  String,
    message:  String,
    isValid:  Boolean
  },
  reportCreated: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = {
  User:         mongoose.model('User', UserSchema),
  Volunteer:    mongoose.model('Volunteer', VolunteerSchema),
  Report:       mongoose.model('Report', ReportSchema),
  Task:         mongoose.model('Task', TaskSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  Inventory:    mongoose.model('Inventory', InventorySchema),
  SMSLog:       mongoose.model('SMSLog', SMSLogSchema)
};
