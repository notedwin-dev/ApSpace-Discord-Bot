const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { isPhysicalLocation } = require("../../utils/helpers");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("weekly")
    .setDescription("Get weekly timetable")
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
          { name: "By Day", value: "day" },
          { name: "By Module", value: "module" }
        )
    ),

  async execute(interaction, api, intakeCode, grouping) {
    let classes = await api.timetable.getWeeklyByIntake(intakeCode);

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

    // Group classes by week, ensuring weeks with no classes are excluded
    const weekGroups = {};
    classes.forEach((cls) => {
      const weekStart = new Date(cls.startTime);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Set to Sunday
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString();

      if (!weekGroups[weekKey]) {
        weekGroups[weekKey] = [];
      }
      weekGroups[weekKey].push(cls);
    });

    const weeks = Object.keys(weekGroups).sort();
    const totalWeeks = weeks.length;

    // Function to create embed for a specific week
    const createWeekEmbed = (weekKey, weekIndex, totalWeeks) => {
      const weekClasses = weekGroups[weekKey];
      const weekStart = new Date(weekKey);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("📅 Weekly Timetable")
        .setDescription(
          totalWeeks > 1
            ? `Week ${weekIndex + 1} of ${totalWeeks}\nWeek: ${
                weekStart.toISOString().split("T")[0]
              }\nIntake: ${intakeCode}${
                grouping ? ` (Group ${grouping})` : ""
              }`
            : `Week: ${
                weekStart.toISOString().split("T")[0]
              }\nIntake: ${intakeCode}${
                grouping ? ` (Group ${grouping})` : ""
              }`
        );

      // Group by day within the week
      const dayGroups = {};
      weekClasses.forEach((cls) => {
        const day = cls.startTime.toLocaleDateString("en-US", {
          weekday: "long",
        });
        if (!dayGroups[day]) {
          dayGroups[day] = [];
        }
        dayGroups[day].push(cls);
      });

      // Add fields for each day in correct order
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach(
        (day) => {
          if (dayGroups[day]) {
            const dayClasses = dayGroups[day];
            dayClasses.sort((a, b) => a.startTime - b.startTime);
            let value = dayClasses
              .map((cls) => {
                const startTime = cls.startTime.toLocaleTimeString(
                  "en-US",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
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
              name: `📆 ${day} (${dayClasses[0].startTime.toLocaleDateString()})`,
              value: value || "No classes",
            });
          }
        }
      );

      if (totalWeeks > 1) {
        embed.setFooter({
          text: `Use buttons to navigate between weeks • ${totalWeeks} weeks total`,
        });
      }

      return embed;
    };

    if (totalWeeks > 1) {
      let currentWeekIndex = 0;
      // Create initial embed and buttons
      const embed = createWeekEmbed(weeks[0], 0, totalWeeks);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_week")
          .setLabel("Previous Week")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⬅️"),
        new ButtonBuilder()
          .setCustomId("next_week")
          .setLabel("Next Week")
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

        if (i.customId === "next_week") {
          currentWeekIndex = (currentWeekIndex + 1) % totalWeeks;
        } else {
          currentWeekIndex =
            (currentWeekIndex - 1 + totalWeeks) % totalWeeks;
        }

        const newEmbed = createWeekEmbed(
          weeks[currentWeekIndex],
          currentWeekIndex,
          totalWeeks
        );
        await i.update({ embeds: [newEmbed] });
      });

      collector.on("end", () => {
        row.components.forEach((button) => button.setDisabled(true));
        interaction.editReply({ components: [row] }).catch(console.error);
      });

      return;
    } else {
      // Single week display
      const embed = createWeekEmbed(weeks[0], 0, totalWeeks);
      return { embeds: [embed] };
    }
  },
};
