/**
 * AidConnect — Database Seeder
 * Run: node seed.js
 * Populates MongoDB with realistic sample data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Volunteer, Report, Task, Notification, Inventory } = require('./models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aidconnect';

/* ── Sample Data ── */
const users = [
  { name:'Admin User',      email:'admin@aidconnect.org',       phone:'+919876500001', password:'Admin@123', role:'admin',       zone:'All' },
  { name:'Ayesha Sharma',   email:'ayesha@aidconnect.org',      phone:'+919876500002', password:'Coord@123', role:'coordinator', zone:'Zone B' },
  { name:'Ravi Mehta',      email:'ravi@aidconnect.org',        phone:'+919876500003', password:'Coord@123', role:'coordinator', zone:'Zone C' },
  { name:'Rahul Verma',     email:'rahul@aidconnect.org',       phone:'+919876500004', password:'Vol@12345', role:'volunteer',   zone:'Zone B' },
  { name:'Priya Singh',     email:'priya@aidconnect.org',       phone:'+919876500005', password:'Vol@12345', role:'volunteer',   zone:'Zone A' },
  { name:'Arjun Patel',     email:'arjun@aidconnect.org',       phone:'+919876500006', password:'Vol@12345', role:'volunteer',   zone:'Zone C' },
  { name:'Meena Rao',       email:'meena@aidconnect.org',       phone:'+919876500007', password:'Vol@12345', role:'volunteer',   zone:'Zone D' },
  { name:'Dr. Priya Nair',  email:'dr.priya@aidconnect.org',    phone:'+919876500008', password:'Vol@12345', role:'volunteer',   zone:'Zone B' },
  { name:'Suresh Kumar',    email:'suresh@aidconnect.org',      phone:'+919876500009', password:'Vol@12345', role:'volunteer',   zone:'Zone A' },
  { name:'Ananya Sharma',   email:'ananya.donor@gmail.com',     phone:'+919876500010', password:'Donor@123', role:'donor',      zone:null },
  { name:'Vikram Sethi',    email:'vikram@ngocorp.in',          phone:'+919876500011', password:'NGO@12345', role:'ngo',        zone:'All' },
  { name:'Citizen User',    email:'citizen@example.com',        phone:'+919876500012', password:'Pass@1234', role:'citizen',    zone:null },
];

const volunteerProfiles = [
  { email:'rahul@aidconnect.org',    skills:['first-aid','driving','logistics'],              availability:'full-time', lat:23.20, lng:79.80, zone:'Zone B', rating:4.9, completed:42 },
  { email:'priya@aidconnect.org',    skills:['logistics','communication','survey'],           availability:'part-time', lat:22.75, lng:75.95, zone:'Zone A', rating:4.8, completed:36 },
  { email:'arjun@aidconnect.org',    skills:['rescue','first-aid','swimming'],                availability:'on-call',   lat:21.30, lng:81.70, zone:'Zone C', rating:4.7, completed:28 },
  { email:'meena@aidconnect.org',    skills:['food-distribution','medical','counseling'],     availability:'full-time', lat:21.20, lng:79.20, zone:'Zone D', rating:4.9, completed:55 },
  { email:'dr.priya@aidconnect.org', skills:['medical','first-aid','counseling'],             availability:'on-call',   lat:22.72, lng:75.87, zone:'Zone B', rating:4.9, completed:30 },
  { email:'suresh@aidconnect.org',   skills:['driving','logistics','construction'],           availability:'part-time', lat:22.80, lng:75.90, zone:'Zone A', rating:4.6, completed:24 },
];

const reports = [
  {
    title: 'Severe Flooding — Napier Town, Jabalpur',
    description: 'Heavy rainfall has caused severe flooding in Napier Town residential area. Roads are submerged, power is out. Approximately 200 families stranded on rooftops. Immediate rescue, food and medical aid required.',
    category: 'flood', severity: 'critical', status: 'in_progress',
    location: { address: 'Napier Town', city: 'Jabalpur', state: 'Madhya Pradesh', pincode: '482001', zone: 'Zone C', geo: { type:'Point', coordinates:[79.99, 23.18] } },
    peopleAffected: 800, skillsNeeded: ['rescue','first-aid','driving'],
    resourcesNeeded: [{ resource:'Food Packets', quantity:500, unit:'pcs' }, { resource:'Blankets', quantity:200, unit:'pcs' }]
  },
  {
    title: 'Medical Emergency — Waterborne Illness, Indore',
    description: 'Outbreak of waterborne illness (suspected cholera) in Zone B slums. 80+ people showing symptoms. Urgent need for ORS, IV fluids and medical teams.',
    category: 'medical', severity: 'critical', status: 'in_progress',
    location: { city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', zone: 'Zone B', geo: { type:'Point', coordinates:[75.86, 22.72] } },
    peopleAffected: 120, skillsNeeded: ['medical','first-aid']
  },
  {
    title: 'Food Shortage — Tribal Village, Raipur',
    description: '500 people in tribal settlement near Raipur have not received food for 3 days due to road blockage from storm damage. Access by jungle track only.',
    category: 'food', severity: 'high', status: 'assigned',
    location: { city: 'Raipur', state: 'Chhattisgarh', pincode: '492001', zone: 'Zone C', geo: { type:'Point', coordinates:[81.63, 21.25] } },
    peopleAffected: 500, skillsNeeded: ['food-distribution','driving']
  },
  {
    title: 'Shelter Needed — Storm Displaced Families, Nagpur',
    description: 'A violent storm has destroyed 120 homes in eastern Nagpur. Families are sleeping in the open. Need tents, blankets and temporary shelter setup.',
    category: 'shelter', severity: 'high', status: 'open',
    location: { city: 'Nagpur', state: 'Maharashtra', pincode: '440001', zone: 'Zone D', geo: { type:'Point', coordinates:[79.09, 21.15] } },
    peopleAffected: 450, skillsNeeded: ['construction','logistics']
  },
  {
    title: 'Infrastructure Damage — Bridge Collapse Risk, Bhopal',
    description: 'The Kaliasot bridge shows structural cracks after last weeks flooding. Engineers have flagged it as unsafe. Evacuation of 2km zone recommended pending inspection.',
    category: 'infrastructure', severity: 'medium', status: 'assigned',
    location: { city: 'Bhopal', state: 'Madhya Pradesh', pincode: '462001', zone: 'Zone A', geo: { type:'Point', coordinates:[77.41, 23.25] } },
    peopleAffected: 2000, skillsNeeded: ['communication','survey']
  },
  {
    title: 'Water Contamination — Jaipur Well',
    description: 'Residents of Vaishali Nagar report foul-smelling, discolored water. 300 households affected. Water testing confirmed E. coli contamination.',
    category: 'medical', severity: 'medium', status: 'open',
    location: { city: 'Jaipur', state: 'Rajasthan', pincode: '302021', zone: 'Zone A', geo: { type:'Point', coordinates:[75.79, 26.92] } },
    peopleAffected: 1200, skillsNeeded: ['medical','survey']
  },
  {
    title: 'Landslide — Highway Blocked, Bhopal',
    description: 'A major landslide has blocked NH-12 near Bhopal. 40 vehicles and ~150 people stranded. No casualties reported yet. Clearance needed urgently.',
    category: 'infrastructure', severity: 'high', status: 'resolved',
    location: { city: 'Bhopal', state: 'Madhya Pradesh', zone: 'Zone A', geo: { type:'Point', coordinates:[77.20, 23.10] } },
    peopleAffected: 150, skillsNeeded: ['construction','rescue']
  },
  {
    title: 'Fire — Factory Blaze, Indore',
    description: 'A chemical factory fire broke out in Sanwer industrial area. Fire brigade on site. 30 families from nearby slum evacuated. Need food, water and temporary shelter.',
    category: 'fire', severity: 'high', status: 'resolved',
    location: { city: 'Indore', state: 'Madhya Pradesh', zone: 'Zone B', geo: { type:'Point', coordinates:[75.90, 22.80] } },
    peopleAffected: 120, skillsNeeded: ['first-aid','logistics','food-distribution']
  }
];

const inventoryItems = [
  { resource:'Food Packets',       category:'food',      zone:'Zone A', quantity:840, unit:'pcs',    minThreshold:100 },
  { resource:'Food Packets',       category:'food',      zone:'Zone B', quantity:320, unit:'pcs',    minThreshold:100 },
  { resource:'Food Packets',       category:'food',      zone:'Zone C', quantity:48,  unit:'pcs',    minThreshold:100 },
  { resource:'Food Packets',       category:'food',      zone:'Zone D', quantity:560, unit:'pcs',    minThreshold:100 },
  { resource:'Medicine Kits',      category:'medical',   zone:'Zone A', quantity:210, unit:'kits',   minThreshold:30 },
  { resource:'Medicine Kits',      category:'medical',   zone:'Zone B', quantity:180, unit:'kits',   minThreshold:30 },
  { resource:'Medicine Kits',      category:'medical',   zone:'Zone C', quantity:90,  unit:'kits',   minThreshold:30 },
  { resource:'Medicine Kits',      category:'medical',   zone:'Zone D', quantity:12,  unit:'kits',   minThreshold:30 },
  { resource:'Blankets',           category:'shelter',   zone:'Zone A', quantity:420, unit:'pcs',    minThreshold:80 },
  { resource:'Blankets',           category:'shelter',   zone:'Zone B', quantity:380, unit:'pcs',    minThreshold:80 },
  { resource:'Blankets',           category:'shelter',   zone:'Zone C', quantity:32,  unit:'pcs',    minThreshold:80 },
  { resource:'Blankets',           category:'shelter',   zone:'Zone D', quantity:290, unit:'pcs',    minThreshold:80 },
  { resource:'Water Cans (20L)',   category:'water',     zone:'Zone A', quantity:150, unit:'cans',   minThreshold:50 },
  { resource:'Water Cans (20L)',   category:'water',     zone:'Zone B', quantity:200, unit:'cans',   minThreshold:50 },
  { resource:'Water Cans (20L)',   category:'water',     zone:'Zone C', quantity:80,  unit:'cans',   minThreshold:50 },
  { resource:'Water Cans (20L)',   category:'water',     zone:'Zone D', quantity:120, unit:'cans',   minThreshold:50 },
  { resource:'Tents',              category:'shelter',   zone:'Zone A', quantity:45,  unit:'units',  minThreshold:15 },
  { resource:'Tents',              category:'shelter',   zone:'Zone B', quantity:30,  unit:'units',  minThreshold:15 },
  { resource:'Tents',              category:'shelter',   zone:'Zone C', quantity:12,  unit:'units',  minThreshold:15 },
  { resource:'Tents',              category:'shelter',   zone:'Zone D', quantity:28,  unit:'units',  minThreshold:15 },
];

/* ── SEEDER ── */
async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}), Volunteer.deleteMany({}),
      Report.deleteMany({}), Task.deleteMany({}),
      Notification.deleteMany({}), Inventory.deleteMany({})
    ]);
    console.log('✅ Data cleared\n');

    // Create Users
    console.log('👤 Creating users...');
    const createdUsers = [];
    for (const u of users) {
      const user = await User.create({ ...u, isVerified: true, isActive: true });
      createdUsers.push(user);
    }
    console.log(`✅ Created ${createdUsers.length} users\n`);

    // Create Volunteers
    console.log('🙋 Creating volunteer profiles...');
    const volDocs = [];
    for (const vp of volunteerProfiles) {
      const user = createdUsers.find(u => u.email === vp.email);
      if (!user) continue;
      const vol = await Volunteer.create({
        user: user._id,
        skills: vp.skills,
        availability: vp.availability,
        status: 'available',
        location: { type: 'Point', coordinates: [vp.lng, vp.lat] },
        zone: vp.zone,
        radius: 100,
        rating: vp.rating,
        totalRatings: Math.floor(Math.random() * 50) + 10,
        completedTasks: vp.completed,
        isVerified: true
      });
      volDocs.push(vol);
    }
    console.log(`✅ Created ${volDocs.length} volunteer profiles\n`);

    // Create Reports
    console.log('📋 Creating reports...');
    const adminUser = createdUsers.find(u => u.role === 'admin');
    const coordUser = createdUsers.find(u => u.role === 'coordinator');
    const reportDocs = await Promise.all(reports.map(async (r, i) => {
      return Report.create({ ...r, filedBy: i % 2 === 0 ? adminUser._id : coordUser._id, filedVia: i % 3 === 0 ? 'sms' : 'web' });
    }));
    console.log(`✅ Created ${reportDocs.length} reports\n`);

    // Create Tasks
    console.log('✅ Creating tasks...');
    const tasks = [
      {
        title: 'Food Distribution — Zone B Camp',
        type: 'distribution', priority: 'high', status: 'in_progress',
        report: reportDocs[0]._id,
        location: { city: 'Indore', zone: 'Zone B', geo: { type:'Point', coordinates:[75.88, 22.73] } },
        deadline: new Date(Date.now() + 8*3600*1000),
        skillsRequired: ['food-distribution','driving'],
        assignedTo: [volDocs[3]._id], // Meena Rao
        createdBy: coordUser._id
      },
      {
        title: 'Flood Rescue — Napier Town River Bank',
        type: 'rescue', priority: 'urgent', status: 'in_progress',
        report: reportDocs[0]._id,
        location: { city: 'Jabalpur', zone: 'Zone C', geo: { type:'Point', coordinates:[79.97, 23.19] } },
        deadline: new Date(Date.now() + 4*3600*1000),
        skillsRequired: ['rescue','first-aid'],
        assignedTo: [volDocs[0]._id, volDocs[2]._id], // Rahul + Arjun
        createdBy: coordUser._id
      },
      {
        title: 'Medical Survey — Zone A Shelter Residents',
        type: 'medical', priority: 'medium', status: 'pending',
        location: { city: 'Bhopal', zone: 'Zone A', geo: { type:'Point', coordinates:[77.41, 23.25] } },
        deadline: new Date(Date.now() + 24*3600*1000),
        skillsRequired: ['medical','survey'],
        assignedTo: [volDocs[4]._id], // Dr. Priya
        createdBy: coordUser._id
      },
      {
        title: 'Blanket Distribution — Zone D',
        type: 'distribution', priority: 'high', status: 'completed',
        location: { city: 'Nagpur', zone: 'Zone D', geo: { type:'Point', coordinates:[79.09, 21.15] } },
        completedAt: new Date(Date.now() - 2*3600*1000),
        completionNote: 'Distributed blankets to 320 families. All zones covered.',
        peopleHelped: 320,
        assignedTo: [volDocs[3]._id],
        createdBy: coordUser._id
      },
    ];
    const taskDocs = await Task.insertMany(tasks);
    console.log(`✅ Created ${taskDocs.length} tasks\n`);

    // Update volunteer badges
    await Volunteer.updateMany({ rating: { $gte: 4.8 } }, { $push: { badges: { name: 'Top Volunteer', earnedAt: new Date() } } });
    await Volunteer.updateMany({ completedTasks: { $gte: 40 } }, { $push: { badges: { name: 'Experienced', earnedAt: new Date() } } });

    // Create Notifications
    console.log('🔔 Creating notifications...');
    const notifData = [];
    for (const u of createdUsers.filter(u => ['coordinator','admin'].includes(u.role))) {
      notifData.push(
        { recipient: u._id, type: 'report_filed', title: '🆕 New Critical Report', message: 'Severe Flooding — Zone C, Jabalpur. 800 people affected.', isRead: false },
        { recipient: u._id, type: 'task_completed', title: '✅ Task Completed', message: 'Blanket Distribution — Zone D. 320 families helped by Meena Rao.', isRead: false },
        { recipient: u._id, type: 'resource_alert', title: '⚠️ Low Stock Alert', message: 'Blankets in Zone C: 32 units remaining (below threshold).', isRead: true },
        { recipient: u._id, type: 'sos', title: '🆘 SOS Alert Resolved', message: 'Volunteer triggered SOS near Jabalpur. Handled by coordinator.', isRead: true }
      );
    }
    await Notification.insertMany(notifData);
    console.log(`✅ Created ${notifData.length} notifications\n`);

    // Create Inventory
    console.log('📦 Creating inventory...');
    await Inventory.insertMany(inventoryItems.map(i => ({ ...i, lastUpdated: new Date() })));
    console.log(`✅ Created ${inventoryItems.length} inventory items\n`);

    console.log('\n══════════════════════════════════════');
    console.log('  🌿 AidConnect Database Seeded!');
    console.log('══════════════════════════════════════');
    console.log('\n  Test Login Credentials:');
    console.log('  ┌─────────────────────────────────────────────────────┐');
    console.log('  │ Admin:       admin@aidconnect.org     Admin@123     │');
    console.log('  │ Coordinator: ayesha@aidconnect.org    Coord@123     │');
    console.log('  │ Volunteer:   rahul@aidconnect.org     Vol@12345     │');
    console.log('  │ Donor:       ananya.donor@gmail.com   Donor@123     │');
    console.log('  └─────────────────────────────────────────────────────┘');
    console.log('\n  Summary:');
    console.log(`  • Users:       ${createdUsers.length}`);
    console.log(`  • Volunteers:  ${volDocs.length}`);
    console.log(`  • Reports:     ${reportDocs.length}`);
    console.log(`  • Tasks:       ${taskDocs.length}`);
    console.log(`  • Inventory:   ${inventoryItems.length}`);
    console.log('\n  Run: npm run dev   to start the server\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Seed error:', e.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
