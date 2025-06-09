const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const { isPhysicalLocation } = require("../../utils/helpers");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("date")
    .setDescription("Get timetable for a specific date")
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Date in YYYY-MM-DD format")
        .setRequired(true)
    )
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
    const date = new Date(interaction.options.getString("date"));
    let classes = await api.timetable.getByIntake(intakeCode, date);

    // Apply tutorial group filter
    if (grouping) {
      classes = classes.filter(
        (cls) => cls.grouping === grouping.toUpperCase()
      );
    }

    if (!classes.length) {
      return {
        content: grouping
          ? `No classes scheduled for tutorial group ${grouping} for this period.`
          : "No classes scheduled for this period.",
      };
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📅 Timetable for ${date.toDateString()}`)
      .setDescription(
        `Intake: ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}`
      );

    const sortBy = interaction.options.getString("sort_by");

    if (sortBy === "module") {
      // Sort by module
      const moduleGroups = {};
      classes.forEach((cls) => {
        if (!moduleGroups[cls.moduleCode]) {
          moduleGroups[cls.moduleCode] = [];
        }
        moduleGroups[cls.moduleCode].push(cls);
      });

      for (const [moduleCode, moduleClasses] of Object.entries(moduleGroups)) {
        const firstClass = moduleClasses[0];
        let value = moduleClasses
          .map((cls) => {
            const startTime = cls.startTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const endTime = cls.endTime.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const day = cls.startTime.toLocaleDateString("en-US", {
              weekday: "long",
            });
            return `${day}: 🕒 ${startTime} - ${endTime}\n${
              isPhysicalLocation(cls.roomNumber)
                ? `🏫 Room ${cls.roomNumber}`
                : "💻 Online Class"
            }`;
          })
          .join("\n");

        embed.addFields({
          name: `${moduleCode} - ${firstClass.moduleName}`,
          value: value,
        });
      }
    } else {
      // Default: sort by time
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
    }

    return { embeds: [embed] };
  },
};
