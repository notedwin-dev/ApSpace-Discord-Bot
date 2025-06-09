const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const api = require("../api");
const { getIntakeCodeByUserId, getGroupingByUserId } = require("../database");
// Import subcommands
const dailyCommand = require("./timetable/daily");
const todayCommand = require("./timetable/today");
const weeklyCommand = require("./timetable/weekly");
const dateCommand = require("./timetable/date");
const emptyRoomsCommand = require("./timetable/empty-rooms");
const roomCommand = require("./timetable/room");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timetable")
    .setDescription("Get timetable information")
    .addSubcommand(todayCommand.data)
    .addSubcommand(weeklyCommand.data)
    .addSubcommand(dailyCommand.data)
    .addSubcommand(dateCommand.data)
    .addSubcommand(emptyRoomsCommand.data)
    .addSubcommand(roomCommand.data),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      const subcommand = interaction.options.getSubcommand();
      const userId = interaction.user.id;
      const providedIntakeCode = interaction.options.getString("intake_code");
      let grouping = interaction.options.getString("tutorial_group");
      const sortBy = interaction.options.getString("sort_by");

      // If no group specified, get user's default group
      if (!grouping) {
        grouping = await getGroupingByUserId(userId);
      }

      let intakeCode = providedIntakeCode;
      if (!intakeCode) {
        intakeCode = await getIntakeCodeByUserId(userId);
        if (!intakeCode) {
          return await interaction.editReply(
            "Please set your intake code first using `/setintake`"
          );
        }
      }

      let classes = [];
      let embed = new EmbedBuilder().setColor(0x0099ff);

      switch (subcommand) {
        case "today": {
          const response = await todayCommand.execute(
            interaction,
            api,
            intakeCode,
            grouping
          );
          if (response) {
            return await interaction.editReply(response);
          }
          return;
        }
        case "weekly": {
          const response = await weeklyCommand.execute(
            interaction,
            api,
            intakeCode,
            grouping
          );
          if (response) {
            return await interaction.editReply(response);
          }
          return;
        }
        case "daily": {
          return await dailyCommand.execute(
            interaction,
            api,
            intakeCode,
            grouping
          );
        }
        case "date": {
          const response = await dateCommand.execute(
            interaction,
            api,
            intakeCode,
            grouping
          );
          if (response) {
            return await interaction.editReply(response);
          }
          return;
        }
        case "empty-rooms": {
          const response = await emptyRoomsCommand.execute(interaction, api);
          if (response) {
            return await interaction.editReply(response);
          }
          return;
        }
        case "room": {
          const response = await roomCommand.execute(interaction, api);
          if (response) {
            return await interaction.editReply(response);
          }
          return;
        }
      } // All subcommands now handle their own responses

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error executing timetable command:", error);
      await interaction.editReply(
        "An error occurred while fetching the timetable."
      );
    }
  },
};
