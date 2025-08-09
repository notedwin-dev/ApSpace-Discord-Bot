const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { isPhysicalLocation, filterExcludedModules, displayRoomName } = require("../../utils/helpers");
const { getExcludedModulesByUserId } = require("../../database");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("daily")
    .setDescription("Get timetable for a specific weekday")
    .addStringOption((option) =>
      option
        .setName("weekday")
        .setDescription("The day of the week")
        .setRequired(true)
        .addChoices(
          { name: "Monday", value: "monday" },
          { name: "Tuesday", value: "tuesday" },
          { name: "Wednesday", value: "wednesday" },
          { name: "Thursday", value: "thursday" },
          { name: "Friday", value: "friday" }
        )
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
    let classes = await api.timetable.getDailyByIntake(
      intakeCode,
      interaction.options.getString("weekday")
    );

    // Apply module exclusions
    const excludedModules = await getExcludedModulesByUserId(interaction.user.id);
    classes = filterExcludedModules(classes, excludedModules);

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

    // Group classes by date for pagination
    const dateGroups = {};
    classes.forEach((cls) => {
      const dateKey = cls.startTime.toDateString();
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(cls);
    });

    const dates = Object.keys(dateGroups).sort();
    const totalDates = dates.length;

    let embed = new EmbedBuilder().setColor(0x0099ff);

    if (totalDates > 1) {
      // Create pagination for multiple dates
      let currentDateIndex = 0;
      const createDateEmbed = (dateIndex) => {
        const dateKey = dates[dateIndex];
        const dateClasses = dateGroups[dateKey];
        const displayDate = new Date(dateKey);
        const weekday = interaction.options.getString("weekday");

        const dateEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(
            `📅 ${weekday.charAt(0).toUpperCase() + weekday.slice(1)} Timetable`
          )
          .setDescription(
            `Date ${
              dateIndex + 1
            } of ${totalDates}\n${displayDate.toLocaleDateString()}\nIntake: ${intakeCode}${
              grouping ? ` (Group ${grouping})` : ""
            }`
          )
          .setFooter({
            text: `Use buttons to navigate between dates • ${totalDates} dates total`,
          });

        // Sort classes by time
        dateClasses.sort((a, b) => a.startTime - b.startTime);
        dateClasses.forEach((cls) => {
          const startTime = cls.startTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const endTime = cls.endTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
          dateEmbed.addFields({
            name: `${cls.moduleCode} - ${cls.moduleName}`,
            value: `🕒 ${startTime} - ${endTime}\n${
              isPhysicalLocation(cls.roomNumber)
              ? `🏫 Room ${displayRoomName(cls.roomNumber)}`
                : "💻 Online Class"
            }`,
          });
        });

        return dateEmbed;
      };

      // Create initial embed and buttons
      embed = createDateEmbed(0);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_date")
          .setLabel("Previous Date")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⬅️"),
        new ButtonBuilder()
          .setCustomId("next_date")
          .setLabel("Next Date")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("➡️")
      );

      const response = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      // Create button collector
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 900000, // 15 minutes
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "These buttons aren't for you!",
            ephemeral: true,
          });
          return;
        }

        if (i.customId === "next_date") {
          currentDateIndex = (currentDateIndex + 1) % totalDates;
        } else {
          currentDateIndex = (currentDateIndex - 1 + totalDates) % totalDates;
        }

        const newEmbed = createDateEmbed(currentDateIndex);
        await i.update({ embeds: [newEmbed] });
      });

      collector.on("end", () => {
        row.components.forEach((button) => button.setDisabled(true));
        interaction.editReply({ components: [row] }).catch(console.error);
      });

      return;
    }

    // If only one date, proceed with normal display
    const weekday = interaction.options.getString("weekday");
    embed
      .setTitle(
        `📅 Timetable for ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`
      )
      .setDescription(
        `Intake: ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}`
      );

    // Default sort by time
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
          ? `🏫 Room ${displayRoomName(cls.roomNumber)}`
            : "💻 Online Class"
        }`,
      });
    });

    return await interaction.editReply({ embeds: [embed] });
  },
};
