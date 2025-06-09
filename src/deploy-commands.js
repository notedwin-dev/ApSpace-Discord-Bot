const { REST, Routes, Collection } = require("discord.js");
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  async execute(bot) {
    const commands = [];
    bot.commands = new Collection();

    const clientId = process.env.CLIENT_ID;
    const token = process.env.BOT_TOKEN;

    // Grab all the command files from the commands directory
    const commandsPath = path.join(__dirname, "commands");
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ("data" in command && "execute" in command) {
        command.filepath = filePath;
        commands.push(command.data.toJSON());
        bot.commands.set(command.data.name, command);
      } else {
        console.log(
          `\x1b[33m[WARNING]: The command at ${filePath} is missing a required "data" or "execute" property.\x1b[0m`
        );
      }
    }

    const rest = new REST().setToken(token);

    try {
      // Only register commands from Shard 0 to avoid duplicate registrations
      if (!bot.shard || bot.shard.ids.includes(0)) {
        console.log(
          `\x1b[32m[Status]:\x1b[0m Started refreshing ${commands.length} application (/) commands.`
        );

        const data = await rest.put(Routes.applicationCommands(clientId), {
          body: commands,
        });

        console.log(
          `\x1b[32m[Status]:\x1b[0m Successfully reloaded ${data.length} application (/) commands.`
        );
      }
    } catch (error) {
      console.error(error);
    }
  },
};
