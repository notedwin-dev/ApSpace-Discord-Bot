const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { prisma } = require('../database');
const { timetable } = require('../api');

// Filter out online classes (not physical locations)
const isPhysicalLocation = (room) => {
  // Filter out all ONLMCO3 rooms (they are all online classes)
  return !room.includes('ONLMCO3');
};

/**
 * Initialize cron jobs for timetable updates and notifications
 * @param {import('discord.js').Client} bot - The Discord.js client instance
 */
function initializeCronJobs(bot) {
  // Update timetable every day at 00:00
  cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled timetable update...');
    try {
      await timetable.fetchAndCacheTimetable();
      console.log('Timetable updated successfully');
      await sendTimetableUpdates(bot);
    } catch (error) {
      console.error('Error updating timetable:', error);
    }
  });
  // Send daily updates at 06:00 AM (Monday-Friday)
  cron.schedule('0 6 * * 1-5', async () => {
    console.log('Sending daily timetable updates...');
    try {
      await sendTimetableUpdates(bot);
    } catch (error) {
      console.error('Error sending timetable updates:', error);
    }
  });

  // Send weekly schedule on Sunday at 08:00 PM
  cron.schedule('0 20 * * 0', async () => {
    console.log('Sending weekly timetable updates...');
    try {
      await sendWeeklyTimetableUpdates(bot);
    } catch (error) {
      console.error('Error sending weekly timetable updates:', error);
    }
  });
}

/**
 * Send timetable updates to all configured channels
 * @param {import('discord.js').Client} bot - The Discord.js client instance
 */
async function sendTimetableUpdates(bot) {
  try {
    // Get all servers with webhook channels configured
    const servers = await prisma.server.findMany({
      where: {
        webhookChannel: {
          not: null
        }
      },
      include: {
        user: {
          include: {
            user: true
          }
        }
      }
    });

    for (const server of servers) {
      const channel = bot.channels.cache.get(server.webhookChannel);
      if (!channel) continue;

      // Send updates for each user in the server
      for (const serverUser of server.user) {
        const user = serverUser.user;
        if (!user.intakeCode) continue;

        const today = new Date();
        let classes = await timetable.getByIntake(user.intakeCode, today);

        // Filter by tutorial group if set
        if (user.grouping) {
          classes = classes.filter(cls => cls.grouping === user.grouping.toUpperCase());
        }

        if (classes.length > 0) {
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📅 Today's Timetable (${today.toDateString()})`)
            .setDescription(`Intake: ${user.intakeCode}${user.grouping ? ` (Group ${user.grouping})` : ''}`);

          // Sort classes by time
          classes.sort((a, b) => a.startTime - b.startTime);
          classes.forEach(cls => {
            const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            embed.addFields({
              name: `${cls.moduleCode} - ${cls.moduleName}`,
              value: `🕒 ${startTime} - ${endTime}\n${isPhysicalLocation(cls.roomNumber) ? `🏫 Room ${cls.roomNumber}` : '💻 Online Class'}`
            });
          });

          await channel.send({ 
            content: `<@${user.userId}>, here's your timetable for today:`,
            embeds: [embed] 
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending timetable updates:', error);
  }
}

/**
 * Send weekly timetable updates to all configured channels
 * @param {import('discord.js').Client} bot - The Discord.js client instance
 */
async function sendWeeklyTimetableUpdates(bot) {
  try {
    // Get all servers with webhook channels configured
    const servers = await prisma.server.findMany({
      where: {
        webhookChannel: {
          not: null
        }
      },
      include: {
        user: {
          include: {
            user: true
          }
        }
      }
    });

    for (const server of servers) {
      const channel = bot.channels.cache.get(server.webhookChannel);
      if (!channel) continue;

      // Send updates for each user in the server
      for (const serverUser of server.user) {
        const user = serverUser.user;
        if (!user.intakeCode) continue;

        // Calculate next week's date range (Monday to Friday)
        const today = new Date();
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + (8 - today.getDay())); // Next Monday (8 because we want next week)
        nextMonday.setHours(0, 0, 0, 0);

        const nextFriday = new Date(nextMonday);
        nextFriday.setDate(nextMonday.getDate() + 4); // Friday is 4 days after Monday
        nextFriday.setHours(23, 59, 59, 999);

        let classes = await timetable.getWeeklyByIntake(user.intakeCode, nextMonday, nextFriday);

        // Filter by tutorial group if set
        if (user.grouping) {
          classes = classes.filter(cls => cls.grouping === user.grouping.toUpperCase());
        }

        if (classes.length > 0) {
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📅 Timetable for ${nextMonday.toLocaleDateString()} - ${nextFriday.toLocaleDateString()}`)
            .setDescription(`Intake: ${user.intakeCode}${user.grouping ? ` (Group ${user.grouping})` : ''}`);

          // Group classes by day
          const dayGroups = {};
          classes.forEach(cls => {
            const day = cls.startTime.toLocaleDateString('en-US', { weekday: 'long' });
            if (!dayGroups[day]) {
              dayGroups[day] = [];
            }
            dayGroups[day].push(cls);
          });

          // Add fields for each day
          for (const [day, dayClasses] of Object.entries(dayGroups)) {
            dayClasses.sort((a, b) => a.startTime - b.startTime);
            let value = dayClasses.map(cls => {
              const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              return `${cls.moduleCode} - ${cls.moduleName}\n🕒 ${startTime} - ${endTime}\n${isPhysicalLocation(cls.roomNumber) ? `🏫 Room ${cls.roomNumber}` : '💻 Online Class'}`;
            }).join('\n\n');
            
            embed.addFields({
              name: `📆 ${day}`,
              value: value || 'No classes'
            });
          }

          await channel.send({
            content: `<@${user.userId}>, here's your timetable for next week:`,
            embeds: [embed]
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending weekly timetable updates:', error);
  }
}

module.exports = {
  initializeCronJobs
};
