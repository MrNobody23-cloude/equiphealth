const mongoose = require('mongoose');

global.dbConnected = false;

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  console.log('\n🔍 DATABASE CONNECTION DEBUG:');
  console.log('─'.repeat(60));
  console.log('MongoDB URI exists:', !!mongoUri);
  
  if (!mongoUri || mongoUri.trim() === '') {
    console.log('⚠️  No MONGODB_URI found in environment variables');
    console.log('📝 Running in IN-MEMORY MODE (no persistent storage)\n');
    global.dbConnected = false;
    return;
  }

  try {
    console.log('🔄 Attempting to connect to MongoDB Atlas...');
    
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    global.dbConnected = true;
    
    console.log('✅ MongoDB Atlas Connection Successful!');
    console.log('─'.repeat(60));
    console.log(`📡 Host: ${conn.connection.host}`);
    console.log(`📂 Database: ${conn.connection.name}`);
    console.log('─'.repeat(60) + '\n');

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
      global.dbConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
      global.dbConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      global.dbConnected = true;
    });

  } catch (error) {
    console.error('\n❌ MongoDB Atlas Connection FAILED!');
    console.error('Error:', error.message);
    console.log('\n📝 Running in IN-MEMORY MODE\n');
    global.dbConnected = false;
  }
};

module.exports = connectDB;