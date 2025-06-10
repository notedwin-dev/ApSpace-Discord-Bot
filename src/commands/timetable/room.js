const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const {
  isPhysicalLocation,
  normalizeRoomName,
} = require("../../utils/helpers");

// Function to capitalize room name for display
function capitalizeRoomName(roomName) {
  return roomName
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

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

    // Sort by time
    classes.sort((a, b) => a.startTime - b.startTime);

    // Group classes by module code and time slot
    const mergedClasses = classes.reduce((acc, cls) => {
      const key = `${
        cls.moduleCode
      }_${cls.startTime.getTime()}_${cls.endTime.getTime()}`;
      if (!acc[key]) {
        acc[key] = {
          ...cls,
          groups: [cls.tutorialGroup].filter(Boolean), // Only add if tutorialGroup exists
        };
      } else if (cls.tutorialGroup) {
        acc[key].groups.push(cls.tutorialGroup);
      }
      return acc;
    }, {});

    // Convert back to array
    const groupedClasses = Object.values(mergedClasses);

    // Split into chunks of 15 fields for better readability
    const embeds = [];
    const FIELDS_PER_EMBED = 15;
    const totalPages = Math.ceil(groupedClasses.length / FIELDS_PER_EMBED);

    for (let page = 0; page < totalPages; page++) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(
          `📅 Schedule for Room ${capitalizeRoomName(roomNumber)} on ${date.toDateString()}`
        )
        .setDescription(
          `All classes scheduled for this room${
            totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : ""
          }`
        );

      const pageClasses = groupedClasses.slice(
        page * FIELDS_PER_EMBED,
        (page + 1) * FIELDS_PER_EMBED
      );

      pageClasses.forEach((cls) => {
        const startTime = cls.startTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const endTime = cls.endTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const groupInfo =
          cls.groups && cls.groups.length > 0
            ? `\n👥 Groups: ${cls.groups.join(", ")}`
            : "";

        embed.addFields({
          name: `${cls.moduleCode} - ${cls.moduleName}`,
          value: `🕒 ${startTime} - ${endTime} • ${date.toDateString()}${groupInfo}`,
          inline: true,
        });
      });

      embeds.push(embed);
    }

    return { embeds };
  },
};
