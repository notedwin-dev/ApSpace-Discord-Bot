const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const { isPhysicalLocation } = require("../../utils/helpers");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("today")
    .setDescription("Get today's timetable")
    .addStringOption((option) =>
      option
        .setName("intake_code")
        .setDescription("Optional: Override your saved intake code")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("tutorial_group")
        .setDescription("Optional: Filter by tutorial group (e.g., G1, G2)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("sort_by")
        .setDescription("Optional: Sort results by category")
        .setRequired(false)
        .addChoices(
          { name: "By Time", value: "time" },
          { name: "By Module", value: "module" }
        )
    ),

  async execute(interaction, api, intakeCode, grouping) {
    const date = new Date();
    let classes = await api.timetable.getByIntake(intakeCode, date);

    // Apply tutorial group filter
    if (grouping) {
      classes = classes.filter(
        (cls) => cls.grouping === grouping.toUpperCase()
      );
    }

    if (!classes.length) {
      return await interaction.editReply(
        grouping
          ? `No classes found for tutorial group ${grouping}.`
          : "No classes scheduled for this period."
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📅 Today's Timetable (${date.toDateString()})`)
      .setDescription(
        `Intake: ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}`
      );

    // Sort by time by default
    classes.sort((a, b) => a.startTime - b.startTime);
    classes.forEach((cls) => {
      const startTime = cls.startTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTime = cls.endTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      embed.addFields({
        name: `${cls.moduleCode} - ${cls.moduleName}`,
        value: `🕒 ${startTime} - ${endTime}\n${
          isPhysicalLocation(cls.roomNumber)
            ? `🏫 Room ${cls.roomNumber}`
            : "💻 Online Class"
        }`,
      });
    });

    return { embeds: [embed] };
  },
};
