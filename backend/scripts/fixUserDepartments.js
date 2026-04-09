/**
 * One-time migration: converts User.department name strings → Department ObjectIds
 * Run once: node scripts/fixUserDepartments.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const users = await User.find({ department: { $exists: true, $ne: null } }).lean();
  const depts = await Department.find().select('_id name').lean();
  const nameMap = Object.fromEntries(depts.map(d => [d.name.toLowerCase().trim(), d._id]));

  let fixed = 0;
  for (const u of users) {
    const val = u.department?.toString().trim();
    if (!val) continue;
    if (mongoose.Types.ObjectId.isValid(val) && val.length === 24) continue; // already ObjectId
    const deptId = nameMap[val.toLowerCase()];
    if (deptId) {
      await User.updateOne({ _id: u._id }, { department: deptId });
      console.log(`Fixed: ${u.firstName} ${u.lastName} → ${val} → ${deptId}`);
      fixed++;
    } else {
      console.warn(`No dept found for: ${u.firstName} ${u.lastName} → "${val}"`);
    }
  }

  console.log(`Done. Fixed ${fixed} users.`);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
