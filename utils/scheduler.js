const cron = require('node-cron');
const Trip = require('../models/Trip');

// This function runs every night at 00:01 AM
const initScheduler = () => {
  console.log("⏰ Scheduler initialized: Waiting for midnight...");

  // Schedule: '1 0 * * *' means "At 00:01 every day"
  cron.schedule('1 0 * * *', async () => {
    console.log("🚀 Running Daily Trip Generator...");
    
    try {
      const today = new Date();
      
      // 1. Find all Active Templates (Blueprints)
      const templates = await Trip.find({ 
        isTemplate: true,
        isActive: true,
        recurrence: 'DAILY' 
      });

      console.log(`Found ${templates.length} templates to clone.`);

      // 2. Clone each one for TODAY
      for (const template of templates) {
        
        // Calculate new Start Time for TODAY
        // Keep the same Hour/Minute from the template, but change Date to Today
        const newStartTime = new Date();
        const templateTime = new Date(template.startTime);
        newStartTime.setHours(templateTime.getHours(), templateTime.getMinutes(), 0, 0);

        // Create the Copy
        const dailyTrip = new Trip({
          driver: template.driver,
          bus: template.bus,
          stops: template.stops, // Copies all stops
          polyline: template.polyline,
          routeName: template.routeName,
          
          // Vital Flags
          isTemplate: false, // This is a real trip, not a template
          recurrence: 'NONE',
          parentTripId: template._id,
          
          startTime: newStartTime,
          status: 'SCHEDULED',
          isActive: true
        });

        await dailyTrip.save();
        console.log(`✅ Generated Trip: ${dailyTrip.routeName} for ${newStartTime.toDateString()}`);
      }

    } catch (error) {
      console.error("❌ Scheduler Error:", error);
    }
  });
};

module.exports = initScheduler;