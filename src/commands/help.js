const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with bot commands and features")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Get help for a specific category")
        .setRequired(false)
        .addChoices(
          { name: "Timetable Commands", value: "timetable" },
          { name: "Settings & Configuration", value: "settings" },
          { name: "Server Management", value: "server" }
        )
    ),

  async execute(interaction) {
    const category = interaction.options.getString("category");
    const embed = new EmbedBuilder().setColor(0x0099ff);

    if (!category) {
      // Show general help
      embed
        .setTitle("📚 ApSpace Discord Bot Help")
        .setDescription(
          "Stay up to date with your APU auto-scheduled timetable right in Discord! Here's what I can do:"
        )
        .addFields(
          {
            name: "🔄 Personal Timetable",
            value:
              "View your schedule by day, week, or date\n" +
              "• `/timetable today` - See today's classes\n" +
              "• `/timetable weekly` - View weekly schedule\n" +
              "• `/timetable daily` - Check specific weekday\n" +
              "• `/timetable date` - Look up any date",
            inline: false,
          },
          {
            name: "🏫 Room Management",
            value:
              "Find available rooms or check schedules\n" +
              "• `/timetable empty-rooms` - Find vacant rooms\n" +
              "• `/timetable room` - Check room schedule",
            inline: false,
          },
          {
            name: "⚙️ Settings",
            value:
              "Configure your preferences\n" +
              "• `/setintake` - Set your intake & group\n" +
              "• `/schedule` - Configure server announcements",
            inline: false,
          },
          {
            name: "📋 Need More Details?",
            value:
              "Use `/help category:` with one of these options:\n" +
              "• `timetable` - All timetable commands\n" +
              "• `settings` - Personal settings\n" +
              "• `server` - Server management",
            inline: false,
          }
        )
        .setFooter({
          text: "Tip: Most commands have optional parameters for customization!",
        });
    } else if (category === "timetable") {
      embed
        .setTitle("📅 Timetable Commands")
        .setDescription("Detailed guide for all timetable-related commands")
        .addFields(
          {
            name: "/timetable today [options]",
            value:
              "View today's schedule\n" +
              "Optional: `intake_code`, `tutorial_group`, `sort_by`",
            inline: false,
          },
          {
            name: "/timetable weekly <display_format> [options]",
            value:
              "View weekly schedule with customizable format:\n" +
              "• Time Only\n" +
              "• Time + Location\n" +
              "• Time + Module Code + Location\n" +
              "• Time + Module Name + Location\n" +
              "Optional: `time_format` (12/24h), `intake_code`, `tutorial_group`",
            inline: false,
          },
          {
            name: "/timetable daily <weekday> [options]",
            value:
              "View schedule for specific weekday\n" +
              "Required: Select a weekday\n" +
              "Optional: `intake_code`, `tutorial_group`, `sort_by`",
            inline: false,
          },
          {
            name: "/timetable date <date> [options]",
            value:
              "View schedule for specific date\n" +
              "Required: Date in YYYY-MM-DD format\n" +
              "Optional: `intake_code`, `tutorial_group`, `sort_by`",
            inline: false,
          },
          {
            name: "/timetable empty-rooms [options]",
            value:
              "Find available rooms\n" +
              "Optional: `start_time`, `end_time`, `date`\n" +
              "Times in HH:mm format, date in YYYY-MM-DD",
            inline: false,
          },
          {
            name: "/timetable room <room_number> [date]",
            value:
              "Check room schedule\n" +
              "Room formats:\n" +
              "• Regular rooms: B-06-12\n" +
              "• Auditoriums: Audi 1, Auditorium 1\n" +
              "• Tech Labs: Tech Lab 4-03, TLab 4-03",
            inline: false,
          }
        );
    } else if (category === "settings") {
      embed
        .setTitle("⚙️ Personal Settings")
        .setDescription("Configure your personal preferences")
        .addFields(
          {
            name: "/setintake <intake_code> [options]",
            value:
              "Set your personal settings:\n" +
              "• `intake_code` - Your intake code (required)\n" +
              "• `tutorial_group` - Your group (e.g., G1, G2)\n" +
              "• `dm_notifications` - Get schedule updates via DM",
            inline: false,
          },
          {
            name: "Display Preferences",
            value:
              "Most commands support these options:\n" +
              "• Different display formats\n" +
              "• 12/24-hour time format\n" +
              "• Sorting by time or module",
            inline: false,
          },
          {
            name: "Automatic Updates",
            value:
              "When DM notifications are enabled:\n" +
              "• Daily updates at 6:00 AM (Mon-Fri)\n" +
              "• Weekly overview on Sunday at 8:00 PM\n" +
              "• Immediate notifications for changes",
            inline: false,
          }
        );
    } else if (category === "server") {
      embed
        .setTitle("🖥️ Server Management")
        .setDescription("Configure server-wide timetable announcements")
        .addFields(
          {
            name: "/schedule channel <channel>",
            value:
              "Set up server-wide announcements\n" +
              "• Choose a channel for timetable updates\n" +
              "• Requires ModerateMembers permission",
            inline: false,
          },
          {
            name: "/schedule intake <intake_code>",
            value:
              "Set server-wide default intake\n" +
              "• Announcements will show this intake's schedule\n" +
              "• Users can still override with personal settings",
            inline: false,
          },
          {
            name: "/schedule disable",
            value: "Turn off server-wide announcements",
            inline: false,
          },
          {
            name: "Automatic Updates",
            value:
              "Server channels receive:\n" +
              "• Daily updates (6:00 AM, Mon-Fri)\n" +
              "• Weekly overview (Sunday, 8:00 PM)\n" +
              "• Rate-limited to prevent spam",
            inline: false,
          }
        );
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
