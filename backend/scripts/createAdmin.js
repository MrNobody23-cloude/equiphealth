#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load env vars
dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@equipmenthealth.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('\n⚠️  Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role');
      }
      
      process.exit(0);
    }

    // Create admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminName = process.env.ADMIN_NAME || 'System Administrator';

    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      provider: 'local',
      emailVerified: true // Auto-verify admin
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('\n' + '='.repeat(60));
    console.log('ADMIN CREDENTIALS');
    console.log('='.repeat(60));
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role:', admin.role);
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

// Run the script
createAdmin();