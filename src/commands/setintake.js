const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../database");

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
        const testEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("✅ DM Test Successful")
          .setDescription(
            "You'll receive your daily and weekly timetable updates here."
          );

        await interaction.user.send({ embeds: [testEmbed] });
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("❌ DM Test Failed")
          .setDescription(
            "I couldn't send you a DM! Please follow these steps:"
          )
          .addFields({
            name: "How to Enable DMs",
            value:
              "1. Right-click on the server name\n2. Click 'Privacy Settings'\n3. Enable 'Direct Messages'\n\nThen try the command again.",
          });

        return await interaction.editReply({
          embeds: [errorEmbed],
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

    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ Settings Updated Successfully")
      .addFields(
        {
          name: "Intake Code",
          value: intakeCode,
          inline: true,
        },
        {
          name: "Tutorial Group",
          value: tutorialGroup || "Not set",
          inline: true,
        },
        {
          name: "DM Notifications",
          value: dmNotifications ? "🔔 Enabled" : "🔕 Disabled",
          inline: true,
        }
      )
      .setDescription(
        dmNotifications
          ? "> You will receive daily and weekly timetable updates in your DMs."
          : "> You have opted out of DM notifications for timetable updates."
      );

    await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
  } catch (error) {
    console.error("Error setting intake code:", error);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ Error")
      .setDescription("An error occurred while setting your intake code.");

    await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

module.exports = {
  data: command,
  execute,
};
