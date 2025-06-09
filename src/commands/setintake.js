const { SlashCommandBuilder } = require('discord.js');
const { prisma } = require('../database');

const command = new SlashCommandBuilder()
  .setName("setintake")
  .setDescription("Set your intake code")
  .addStringOption((option) =>
    option
      .setName("intake_code")
      .setDescription("Your intake code")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("tutorial_group")
      .setDescription("Your tutorial group (e.g., G1, G2)")
      .setRequired(true)
  )
  .addBooleanOption((option) =>
    option
      .setName("dm_notifications")
      .setDescription(
        "Receive daily and weekly timetables in DMs (default: true)"
      )
      .setRequired(true)
  );

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const intakeCode = interaction.options.getString("intake_code");
    const tutorialGroup = interaction.options
      .getString("tutorial_group")
      ?.toUpperCase();
    const dmNotifications = interaction.options.getBoolean("dm_notifications");

    // Only test DM if notifications are enabled
    if (dmNotifications) {
      try {
        await interaction.user.send({
          content:
            "✅ Thanks for enabling DMs! You'll receive your daily and weekly timetable updates here.",
        });
      } catch (error) {
        return await interaction.editReply({
          content:
            "❌ I couldn't send you a DM! Please enable direct messages from server members:\n" +
            "1. Right-click on the server name\n" +
            "2. Click 'Privacy Settings'\n" +
            "3. Enable 'Direct Messages'\n" +
            "Then try the command again.",
          ephemeral: true,
        });
      }
    }

    // Upsert user with intake code and tutorial group
    await prisma.user.upsert({
      where: { userId },
      update: {
        intakeCode,
        grouping: tutorialGroup,
        dmNotifications,
      },
      create: {
        userId,
        intakeCode,
        grouping: tutorialGroup,
        dmNotifications,
      },
    });

    await interaction.editReply({
      content:
        `✅ Successfully set your intake code to ${intakeCode}${
          tutorialGroup ? ` (Group ${tutorialGroup})` : ""
        }\n` +
        (dmNotifications
          ? "You'll receive daily and weekly timetable updates in your DMs!"
          : "You won't receive DM notifications for timetable updates."),
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error setting intake code:", error);
    await interaction.editReply({
      content: "An error occurred while setting your intake code.",
      ephemeral: true,
    });
  }
}

module.exports = {
  data: command,
  execute,
};
