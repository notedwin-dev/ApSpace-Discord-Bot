const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const {
  isPhysicalLocation,
  normalizeRoomName,
} = require("../../utils/helpers");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("room")
    .setDescription("Get schedule for a specific room")
    .addStringOption((option) =>
      option
        .setName("room_number")
        .setDescription("Room number (e.g. Audi 1, B-06-12)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Optional: Date in YYYY-MM-DD format")
        .setRequired(false)
    ),

  async execute(interaction, api) {
    let roomNumber = interaction.options.getString("room_number");
    const date = interaction.options.getString("date")
      ? new Date(interaction.options.getString("date"))
      : new Date();

    // Normalize the room number for consistent searching
    roomNumber = normalizeRoomName(roomNumber);
    const classes = await api.timetable.getRoomSchedule(roomNumber, date);

    if (!classes.length) {
      return {
        content: "No classes scheduled for this period.",
      };
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📅 Schedule for Room ${roomNumber} on ${date.toDateString()}`)
      .setDescription("All classes scheduled for this room");

    // Sort by time
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
