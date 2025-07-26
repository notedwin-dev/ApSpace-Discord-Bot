const { Client, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { initializeCronJobs } = require('./cron/timetableUpdater');
const { fetchAndCacheTimetable } = require('./api/timetable');

const bot = new Client({
  intents: [
    'GuildWebhooks',
    'Guilds',
    'GuildMessages',
  ],
  partials: [
    'Message',
    'Channel',
    'Reaction',
  ],
});

// Initialize commands collection
bot.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    bot.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Load and register events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    bot.once(event.name, (...args) => event.execute(...args, bot));
  } else {
    bot.on(event.name, (...args) => event.execute(...args, bot));
  }
}

// Initialize cron jobs
initializeCronJobs(bot);

(async () => {
  try {
    console.log('Fetching the latest schedule on bot startup...');
    await fetchAndCacheTimetable();
    console.log('Successfully fetched and cached the latest schedule.');
  } catch (error) {
    console.error('Error fetching the latest schedule on startup:', error);
  }
})();

bot.login(process.env.BOT_TOKEN);