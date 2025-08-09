const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require("discord.js");
const { isPhysicalLocation, filterExcludedModules, displayRoomName } = require("../../utils/helpers");
const { getExcludedModulesByUserId } = require("../../database");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("weekly")
    .setDescription("Get weekly timetable")
    // Only intake_code and tutorial_group as slash options
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
  // send_as_codeblock is now a button, not a slash option


  async execute(interaction, api, intakeCode, grouping) {
    try {
      // Interactive options
      const displayFormatOptions = [
        { label: "Time Only", value: "time" },
        { label: "Time + Location", value: "time_loc" },
        { label: "Time + Module Code + Location", value: "time_code_loc" },
        { label: "Time + Module Name + Location", value: "time_name_loc" },
      ];
      const timeFormatOptions = [
        { label: "12-hour", value: "12" },
        { label: "24-hour", value: "24" },
      ];
      // (state variables declared after week selection)

      // Fetch all timetable data
      let classes = await api.timetable.fetchAllTimetable(intakeCode);

      // Apply module exclusions
      const excludedModules = await getExcludedModulesByUserId(interaction.user.id);
      classes = filterExcludedModules(classes, excludedModules);

      if (grouping) {
        const upperGrouping = grouping.toUpperCase();
        classes = classes.filter((cls) => cls.grouping && cls.grouping.toUpperCase() === upperGrouping);
      }
      if (!classes.length) {
        return await interaction.editReply({
          content: grouping ? `No classes found for tutorial group ${grouping}.` : "No classes scheduled for this period.",
          embeds: [],
          components: [],
        });
      }

      // Group classes by week
      const weekGroups = {};
      classes.forEach((cls) => {
        const weekStart = new Date(cls.startTime);
        const daysUntilMonday = (weekStart.getDay() - 1 + 7) % 7;
        weekStart.setDate(weekStart.getDate() - daysUntilMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekKey = weekStart.toISOString();
        if (!weekGroups[weekKey]) weekGroups[weekKey] = [];
        weekGroups[weekKey].push(cls);
      });
      const weeks = Object.keys(weekGroups).sort();
      const totalWeeks = weeks.length;

      // Build week select menu
      const weekOptions = weeks.map((weekKey) => {
        const weekStart = new Date(weekKey);
        return {
          label: `Week of ${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
          value: weekKey,
        };
      });
      const weekSelectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_week")
        .setPlaceholder("Select a week to view timetable")
        .addOptions(weekOptions);
      const weekRow = new ActionRowBuilder().addComponents(weekSelectMenu);

      // Initial embed for week selection
      const initialEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("📅 Weekly Timetable")
        .setDescription(
          `**Select a week to get the full weekly schedule**\n\n` +
          `📚 **Intake:** ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}\n` +
          `📋 **Available Weeks:** ${weeks.length}\n\n` +
          `*Use the dropdown menu below to select a specific week*`
        )
        .setFooter({
          text: `${interaction.user.username} • Weekly Timetable Selection`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      let response = await interaction.editReply({ embeds: [initialEmbed], components: [weekRow] });

      // State for interactive options
      let displayFormat = displayFormatOptions[0].value;
      let timeFormat = timeFormatOptions[1].value;
      let sendAsCodeblock = false;
      let selectedWeekKey = null;

      // Collector for week selection and all further interactions
      const collector = response.createMessageComponentCollector({ time: 300000 });
      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: "This menu is not for you!", ephemeral: true });
          return;
        }
        if (i.customId === "select_week") {
          selectedWeekKey = i.values[0];
          await showTimetable(i, selectedWeekKey, true);
        } else if (i.customId === "select_display_format") {
          displayFormat = i.values[0];
          await showTimetable(i, selectedWeekKey, true);
        } else if (i.customId === "select_time_format") {
          timeFormat = i.values[0];
          await showTimetable(i, selectedWeekKey, true);
        } else if (i.customId === "toggle_codeblock") {
          sendAsCodeblock = !sendAsCodeblock;
          await showTimetable(i, selectedWeekKey, true);
        }
      });
      collector.on("end", () => {
        // Disable all components on timeout
        interaction.editReply({ components: [] }).catch(console.error);
      });

      // Helper to show timetable for a week with interactive options
      async function showTimetable(i, weekKey, isUpdate = false) {
        const weekClasses = weekGroups[weekKey] || [];
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 4);
        const selectedWeekLabel = `Week of ${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
        const embed = await createWeeklyTimetableEmbed(
          weekClasses,
          weekStart,
          weekEnd,
          intakeCode,
          grouping,
          displayFormat,
          timeFormat,
          sendAsCodeblock,
          selectedWeekLabel
        );
        // Interactive option menus (week select always present)
        const weekSelectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_week")
          .setPlaceholder("Select a week to view timetable")
          .addOptions(weekOptions.map(opt => ({ ...opt, default: opt.value === weekKey })));
        const weekRow = new ActionRowBuilder().addComponents(weekSelectMenu);
        const displayRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_display_format")
            .setPlaceholder("Select display format")
            .addOptions(displayFormatOptions.map(opt => ({ ...opt, default: opt.value === displayFormat })))
        );
        const timeRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select_time_format")
            .setPlaceholder("Select time format")
            .addOptions(timeFormatOptions.map(opt => ({ ...opt, default: opt.value === timeFormat })))
        );
        const codeblockRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("toggle_codeblock")
            .setLabel(`Send as Codeblock: ${sendAsCodeblock ? "On" : "Off"}`)
            .setStyle(ButtonStyle.Secondary)
        );
        const components = [weekRow, displayRow, timeRow, codeblockRow];
        await i.update({ embeds: [embed], components });
      }
    } catch (error) {
      console.error("Error in weekly-dev command:", {
        message: error.message,
        stack: error.stack,
        interaction: {
          user: interaction.user.tag,
          options: interaction.options.data,
        },
      });
      await interaction.editReply("An error occurred while fetching the timetable.");
    }
  },
};

async function createWeeklyTimetableEmbed(
  weekClasses,
  weekStart,
  weekEnd,
  intakeCode,
  grouping,
  displayFormat,
  timeFormat,
  sendAsCodeblock,
  selectedWeekLabel
) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("📅 Weekly Timetable");

  const formatDate = (date) => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Custom codeblock format
  let description = "";
  if (sendAsCodeblock) {
    // Title lines inside codeblock, always at the top
    description += "```";
    description += `\n👥 ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}`;
    description += `\n${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    description += "\n";

    // Group by day within the week
    const dayGroups = {};
    weekClasses.forEach((cls) => {
      const day = cls.startTime.toLocaleDateString("en-US", {
        weekday: "long",
      });
      if (!dayGroups[day]) dayGroups[day] = [];
      dayGroups[day].push(cls);
    });

    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach((day, idx, arr) => {
      description += `\n${day}:`;
      if (dayGroups[day]) {
        const dayClasses = dayGroups[day];
        dayClasses.sort((a, b) => a.startTime - b.startTime);
        if (dayClasses.length > 0) {
          dayClasses.forEach((cls) => {
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
              ? `📍${displayRoomName(cls.roomNumber)}`
              : "💻";
            let line = "";
            switch (displayFormat) {
              case "time":
                line = `${time}`;
                break;
              case "time_loc":
                line = `${time} ${location}`;
                break;
              case "time_name_loc":
                line = `${time} • ${cls.moduleName} ${location}`;
                break;
              case "time_code_loc":
              default:
                line = `${time} • ${cls.moduleCode} ${location}`;
                break;
            }
            description += `\n${line}`;
          });
        } else {
          description += "\nNo classes scheduled";
        }
      } else {
        description += "\nNo classes scheduled";
      }
      if (idx < arr.length - 1) description += "\n";
    });
    description += "\n```";
    embed.setDescription(description);
  } else {
    // ...existing code for embed fields...
    // Enhanced description
    description = `**${selectedWeekLabel}**\n`;
    description += `📅 **Period:** ${formatDate(weekStart)} - ${formatDate(weekEnd)}\n`;
    description += `👥 **Intake:** ${intakeCode}${grouping ? ` (Group ${grouping})` : ""}\n`;
    description += `📊 **Format:** ${displayFormat.replace("_", " + ").replace(/\b\w/g, l => l.toUpperCase())}\n`;
    description += `⏰ **Time:** ${timeFormat === "12" ? "12-hour" : "24-hour"} format\n\n`;

    if (weekClasses.length === 0) {
      description += "⚠️ **No classes scheduled for this week**";
      embed.setDescription(description);
      return embed;
    }

    description += `📚 **Total Classes:** ${weekClasses.length}\n`;
    embed.setDescription(description);

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
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach((day) => {
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
              ? `📍${displayRoomName(cls.roomNumber)}`
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
          name: `${getEmojiForDay(day)} ${day}`,
          value: value || "⚠️ No classes scheduled",
          inline: false,
        });
      } else {
        embed.addFields({
          name: `${getEmojiForDay(day)} ${day}`,
          value: "⚠️ No classes scheduled",
          inline: false,
        });
      }
    });
  }

  embed.setFooter({
    text: `Weekly Schedule • Use the back button to select a different week or setup`,
  });

  return embed;

  function getEmojiForDay(day) {
    const dayEmojis = {
      Monday: "📅",
      Tuesday: "📆",
      Wednesday: "🗓️",
      Thursday: "📋",
      Friday: "📊"
    };
    return dayEmojis[day] || "📅";
  }
}

