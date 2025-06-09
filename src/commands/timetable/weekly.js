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
        .setName("display_format")
        .setDescription("Choose how detailed the timetable should be")
        .setRequired(true)
        .addChoices(
          { name: "Time Only", value: "time" },
          { name: "Time + Location", value: "time_loc" },
          { name: "Time + Module Code + Location", value: "time_code_loc" },
          { name: "Time + Module Name + Location", value: "time_name_loc" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("time_format")
        .setDescription("Optional: Choose time format")
        .setRequired(false)
        .addChoices(
          { name: "12-hour", value: "12" },
          { name: "24-hour", value: "24" }
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
    ),

  async execute(interaction, api, intakeCode, grouping) {
    // Get display format preference
    const displayFormat = interaction.options.getString("display_format");
    const timeFormat = interaction.options.getString("time_format") || "24";

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
      // Get to Monday by subtracting days until we reach Monday (1)
      // getDay() returns 0 for Sunday, so we use (day - 1 + 7) % 7 to get days until Monday
      const daysUntilMonday = (weekStart.getDay() - 1 + 7) % 7;
      weekStart.setDate(weekStart.getDate() - daysUntilMonday);
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
        .setTitle("📅 Weekly Timetable"); // Add header with intake and week info
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4); // Friday is 4 days after Monday

      const formatDate = (date) => {
        return date.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      };

      embed.addFields({
        name: `👥 ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}`,
        value: `${formatDate(weekStart)} - ${formatDate(weekEnd)}${
          totalWeeks > 1 ? ` • Week ${weekIndex + 1}/${totalWeeks}` : ""
        }`,
        inline: true,
      });

      // Group by day within the week
      const dayGroups = {};
      weekClasses.forEach((cls) => {
        const day = cls.startTime.toLocaleDateString("en-US", {
          weekday: "long",
        });
        if (!dayGroups[day]) dayGroups[day] = [];
        dayGroups[day].push(cls);
      });

      // Add fields for each day in correct order
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach(
        (day) => {
          if (dayGroups[day]) {
            const dayClasses = dayGroups[day];
            dayClasses.sort((a, b) => a.startTime - b.startTime);
            const value = dayClasses
              .map((cls) => {
                const formatTime = (date) => {
                  return date
                    .toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: timeFormat === "12",
                      timeZone: "Asia/Kuala_Lumpur",
                    })
                    .toLowerCase();
                };
                const startTime = formatTime(cls.startTime);
                const endTime = formatTime(cls.endTime);
                const time = `${startTime} - ${endTime}`;
                const location = isPhysicalLocation(cls.roomNumber)
                  ? `📍${cls.roomNumber}`
                  : "💻";

                switch (displayFormat) {
                  case "time":
                    return `\`${time}\``;
                  case "time_loc":
                    return `\`${time}\` ${location}`;
                  case "time_name_loc":
                    return `\`${time}\` • ${cls.moduleName} ${location}`;
                  case "time_code_loc":
                  default:
                    return `\`${time}\` • ${cls.moduleCode} ${location}`;
                }
              })
              .join("\n");

            embed.addFields({
              name: `${day}`,
              value: value || "⚠️ No classes scheduled",
            });
          } else {
            embed.addFields({
              name: `${day}`,
              value: "⚠️ No classes scheduled",
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
          currentWeekIndex = (currentWeekIndex - 1 + totalWeeks) % totalWeeks;
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
