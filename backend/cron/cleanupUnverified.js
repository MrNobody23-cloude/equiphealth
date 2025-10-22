const cron = require('node-cron');
const User = require('../models/User');

// Run cleanup every day at 2 AM
const scheduleCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await User.deleteMany({
        emailVerified: false,
        provider: 'local',
        createdAt: { $lt: oneDayAgo }
      });

      console.log(`🧹 [${new Date().toISOString()}] Cleaned up ${result.deletedCount} unverified users`);
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  });

  console.log('✅ Cleanup cron job scheduled (runs daily at 2 AM)');
};

module.exports = scheduleCleanup;