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
  // Update timetable cache on Friday, Saturday, and Sunday at 00:00
  cron.schedule("0 0 * * 5-7", async () => {
    console.log("Running scheduled timetable cache update (weekend)...");
    try {
      await timetable.fetchAndCacheTimetable();
      console.log("Timetable cache updated successfully");
    } catch (error) {
      console.error("Error updating timetable cache:", error);
    }
  });

  // Send daily updates at 12:00 AM (Monday-Friday)
  cron.schedule("0 0 * * 1-5", async () => {
    console.log("Sending daily timetable updates...");
    try {
      await sendTimetableUpdates(bot);
    } catch (error) {
      console.error("Error sending timetable updates:", error);
    }
  });

  // Update cache and send weekly schedule on Sunday at 08:00 PM
  cron.schedule("0 20 * * 0", async () => {
    console.log("Updating cache before sending weekly updates...");
    try {
      await timetable.fetchAndCacheTimetable();
      console.log(
        "Cache updated successfully, sending weekly timetable updates..."
      );
      await sendWeeklyTimetableUpdates(bot);
    } catch (error) {
      console.error("Error sending weekly timetable updates:", error);
    }
  });
}

/**
 * Send timetable updates to users and server channels
 * @param {import('discord.js').Client} bot - The Discord.js client instance
 */
async function sendTimetableUpdates(bot) {
  try {
    const servers = await prisma.server.findMany({
      include: {
        user: {
          include: {
            user: true
          }
        }
      }
    });

    for (const server of servers) {
      const guild = bot.guilds.cache.get(server.id);
      if (!guild) continue;

      // Handle server-wide announcements
      if (server.webhookChannel && server.defaultIntake) {
        const channel = bot.channels.cache.get(server.webhookChannel);
        if (channel) {
          const today = new Date();
          const classes = await timetable.getByIntake(server.defaultIntake, today);

          if (classes.length > 0) {
            const embed = new EmbedBuilder()
              .setColor(0x0099FF)
              .setTitle(`📅 Today's Classes (${today.toDateString()})`)
              .setDescription(`Server-wide timetable for intake: ${server.defaultIntake}`);

            // Sort and group classes
            classes.sort((a, b) => a.startTime - b.startTime);
            const groupedClasses = {};
            
            classes.forEach(cls => {
              if (!groupedClasses[cls.grouping]) {
                groupedClasses[cls.grouping] = [];
              }
              groupedClasses[cls.grouping].push(cls);
            });

            // Add fields for each tutorial group
            for (const [group, groupClasses] of Object.entries(groupedClasses)) {
              let value = groupClasses.map(cls => {
                const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return `${cls.moduleCode} - ${cls.moduleName}\n🕒 ${startTime} - ${endTime}\n${isPhysicalLocation(cls.roomNumber) ? `🏫 Room ${cls.roomNumber}` : '💻 Online Class'}`;
              }).join('\n\n');

              embed.addFields({
                name: `Group ${group || 'Common'}`,
                value: value
              });
            }

            await channel.send({ embeds: [embed] });
          }
        }
      }

      // Handle personal timetables via DM
      for (const serverUser of server.user) {
        const user = serverUser.user;
        if (!user.intakeCode) continue;

        const member = await guild.members.fetch(user.userId).catch(() => null);
        if (!member) continue;

        const today = new Date();
        let classes = await timetable.getByIntake(user.intakeCode, today);

        // Filter by tutorial group if set
        if (user.grouping) {
          classes = classes.filter(cls => cls.grouping === user.grouping.toUpperCase());
        }

        if (classes.length > 0) {
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📅 Your Timetable for ${today.toDateString()}`)
            .setDescription(`Intake: ${user.intakeCode}${user.grouping ? ` (Group ${user.grouping})` : ''}`);

          classes.sort((a, b) => a.startTime - b.startTime);
          classes.forEach(cls => {
            const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            embed.addFields({
              name: `${cls.moduleCode} - ${cls.moduleName}`,
              value: `🕒 ${startTime} - ${endTime}\n${isPhysicalLocation(cls.roomNumber) ? `🏫 Room ${cls.roomNumber}` : '💻 Online Class'}`
            });
          });

          // Send as DM
          await member.send({ embeds: [embed] }).catch(error => 
            console.error(`Failed to send DM to ${member.user.tag}:`, error));
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
    const servers = await prisma.server.findMany({
      include: {
        user: {
          include: {
            user: true,
          },
        },
      },
    });

    for (const server of servers) {
      const guild = bot.guilds.cache.get(server.id);
      if (!guild) continue;

      // Handle server-wide announcements
      if (server.webhookChannel && server.defaultIntake) {
        const channel = bot.channels.cache.get(server.webhookChannel);
        if (channel) {
          const today = new Date();
          const nextMonday = new Date(today);
          nextMonday.setDate(today.getDate() + (8 - today.getDay())); // Next Monday
          nextMonday.setHours(0, 0, 0, 0);

          const nextFriday = new Date(nextMonday);
          nextFriday.setDate(nextMonday.getDate() + 4); // Friday is 4 days after Monday
          nextFriday.setHours(23, 59, 59, 999);

          const classes = await timetable.getWeeklyByIntake(
            server.defaultIntake,
            nextMonday,
            nextFriday
          );

          if (classes.length > 0) {
            const embed = new EmbedBuilder()
              .setColor(0x0099ff)
              .setTitle(
                `📅 Next Week's Classes (${nextMonday.toLocaleDateString()} - ${nextFriday.toLocaleDateString()})`
              )
              .setDescription(
                `Server-wide timetable for intake: ${server.defaultIntake}`
              );

            // Sort and group classes by day and tutorial group
            const dayGroups = {};
            classes.forEach((cls) => {
              const day = cls.startTime.toLocaleDateString("en-US", {
                weekday: "long",
              });
              if (!dayGroups[day]) {
                dayGroups[day] = {};
              }
              if (!dayGroups[day][cls.grouping]) {
                dayGroups[day][cls.grouping] = [];
              }
              dayGroups[day][cls.grouping].push(cls);
            });

            // Add fields for each day and group
            for (const [day, groups] of Object.entries(dayGroups)) {
              for (const [group, groupClasses] of Object.entries(groups)) {
                groupClasses.sort((a, b) => a.startTime - b.startTime);
                let value = groupClasses
                  .map((cls) => {
                    const startTime = cls.startTime.toLocaleTimeString(
                      "en-US",
                      { hour: "2-digit", minute: "2-digit" }
                    );
                    const endTime = cls.endTime.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return `${cls.moduleCode} - ${
                      cls.moduleName
                    }\n🕒 ${startTime} - ${endTime}\n${
                      isPhysicalLocation(cls.roomNumber)
                        ? `🏫 Room ${cls.roomNumber}`
                        : "💻 Online Class"
                    }`;
                  })
                  .join("\n\n");

                embed.addFields({
                  name: `📆 ${day} (Group ${group || "Common"})`,
                  value: value || "No classes",
                });
              }
            }

            await channel.send({ embeds: [embed] });
          }
        }
      }

      // Handle personal timetables via DM
      for (const serverUser of server.user) {
        const user = serverUser.user;
        if (!user.intakeCode || !user.dmNotifications) continue;

        const member = await guild.members.fetch(user.userId).catch(() => null);
        if (!member) continue;

        const today = new Date();
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + (8 - today.getDay()));
        nextMonday.setHours(0, 0, 0, 0);

        const nextFriday = new Date(nextMonday);
        nextFriday.setDate(nextMonday.getDate() + 4);
        nextFriday.setHours(23, 59, 59, 999);

        let classes = await timetable.getWeeklyByIntake(
          user.intakeCode,
          nextMonday,
          nextFriday
        );

        // Filter by tutorial group if set
        if (user.grouping) {
          classes = classes.filter(
            (cls) => cls.grouping === user.grouping.toUpperCase()
          );
        }

        if (classes.length > 0) {
          const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`📅 Your Timetable for Next Week`)
            .setDescription(
              `${nextMonday.toLocaleDateString()} - ${nextFriday.toLocaleDateString()}\nIntake: ${
                user.intakeCode
              }${user.grouping ? ` (Group ${user.grouping})` : ""}`
            );

          // Group classes by day
          const dayGroups = {};
          classes.forEach((cls) => {
            const day = cls.startTime.toLocaleDateString("en-US", {
              weekday: "long",
            });
            if (!dayGroups[day]) {
              dayGroups[day] = [];
            }
            dayGroups[day].push(cls);
          });

          // Add fields for each day
          for (const [day, dayClasses] of Object.entries(dayGroups)) {
            dayClasses.sort((a, b) => a.startTime - b.startTime);
            let value = dayClasses
              .map((cls) => {
                const startTime = cls.startTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const endTime = cls.endTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return `${cls.moduleCode} - ${
                  cls.moduleName
                }\n🕒 ${startTime} - ${endTime}\n${
                  isPhysicalLocation(cls.roomNumber)
                    ? `🏫 Room ${cls.roomNumber}`
                    : "💻 Online Class"
                }`;
              })
              .join("\n\n");

            embed.addFields({
              name: `📆 ${day}`,
              value: value || "No classes",
            });
          }

          // Send as DM
          await member
            .send({ embeds: [embed] })
            .catch((error) =>
              console.error(
                `Failed to send weekly DM to ${member.user.tag}:`,
                error
              )
            );
        }
      }
    }
  } catch (error) {
    console.error("Error sending weekly timetable updates:", error);
  }
}

module.exports = {
  initializeCronJobs
};
