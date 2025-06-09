const { Events } = require("discord.js");
const deployCommands = require("../deploy-commands");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`\x1b[32m[Status]:\x1b[0m ${client.user.tag} is online!`);
    client.user.setActivity("ApSpace Schedules", { type: "WATCHING" });

    // Deploy slash commands
    try {
      await deployCommands.execute(client);
      console.log("\x1b[32m[Status]:\x1b[0m Slash commands deployed successfully.");
    } catch (error) {
      console.error("\x1b[31m[Error]:\x1b[0m Failed to deploy slash commands:", error);
    }
  },
};