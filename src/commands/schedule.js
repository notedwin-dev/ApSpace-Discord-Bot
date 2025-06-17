const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ApplicationIntegrationType,
} = require("discord.js");
const { prisma } = require("../database");

const command = new SlashCommandBuilder()
  .setName("schedule")
  .setDescription("Configure timetable update settings")
  .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
  .setDefaultMemberPermissions(
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ModerateMembers
  ) // Make command admin-only
  .addSubcommand((subcommand) =>
    subcommand
      .setName("channel")
      .setDescription("Set a channel for server-wide announcements")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel for server-wide announcements")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("intake")
      .setDescription("Set server-wide default intake code")
      .addStringOption((option) =>
        option
          .setName("intake_code")
          .setDescription("Default intake code for the server")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("disable")
      .setDescription("Disable timetable updates for this server")
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const subcommand = interaction.options.getSubcommand();
    const serverId = interaction.guildId;

    switch (subcommand) {
      case "channel": {
        const channel = interaction.options.getChannel("channel");

        await prisma.server.upsert({
          where: { serverId: serverId },
          update: { webhookChannel: channel.id },
          create: {
            serverId: serverId,
            name: interaction.guild.name,
            webhookChannel: channel.id,
          },
        });

        await interaction.editReply(
          `Server-wide announcements will be sent to ${channel}`
        );
        break;
      }

      case "intake": {
        const intakeCode = interaction.options.getString("intake_code");

        await prisma.server.upsert({
          where: { serverId: serverId },
          update: { defaultIntake: intakeCode },
          create: {
            serverId: serverId,
            name: interaction.guild.name,
            defaultIntake: intakeCode,
          },
        });

        await interaction.editReply(
          `Server-wide default intake code set to ${intakeCode}`
        );
        break;
      }

      case "disable": {
        await prisma.server.update({
          where: { serverId: serverId },
          data: {
            webhookChannel: null,
            defaultIntake: null,
          },
        });

        await interaction.editReply(
          "Timetable updates disabled for this server"
        );
        break;
      }
    }
  } catch (error) {
    console.error("Error executing schedule command:", error);
    await interaction.editReply(
      "An error occurred while configuring timetable updates"
    );
  }
}

module.exports = {
  data: command,
  execute,
};
