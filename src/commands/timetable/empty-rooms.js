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
    .setName("empty-rooms")
    .setDescription("Find empty rooms")
    .addStringOption((option) =>
      option
        .setName("start_time")
        .setDescription(
          "Optional: Start time in HH:mm format (defaults to current time)"
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("end_time")
        .setDescription(
          "Optional: End time in HH:mm format (defaults to start time + 1 hour)"
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Optional: Date in YYYY-MM-DD format")
        .setRequired(false)
    ),

  async execute(interaction, api) {
    // Get current time for defaults
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    // Get start time (default to current time)
    const startTimeStr =
      interaction.options.getString("start_time") || currentTime;
    const [startHours, startMinutes] = startTimeStr.split(":").map(Number);

    // Get end time (default to start time + 1 hour)
    const endTimeStr = interaction.options.getString("end_time");
    let endHours, endMinutes;

    if (endTimeStr) {
      [endHours, endMinutes] = endTimeStr.split(":").map(Number);
    } else {
      endHours = startHours + 1;
      endMinutes = startMinutes;
    }

    const dateStr = interaction.options.getString("date");
    const date = dateStr ? new Date(dateStr) : new Date();
    const startTime = new Date(date.setHours(startHours, startMinutes, 0));
    const endTime = new Date(date.setHours(endHours, endMinutes, 0));

    const emptyRooms = (
      await api.timetable.getEmptyRooms(date, [startTime, endTime])
    ).filter(isPhysicalLocation);

    const embed = new EmbedBuilder().setColor(0x0099ff);

    if (emptyRooms.length === 0) {
      embed
        .setTitle(
          `🏫 Empty Rooms${dateStr ? ` on ${date.toDateString()}` : ""}`
        )
        .setDescription("No empty rooms found for this time slot.");
      return { embeds: [embed] };
    }

    // Group rooms by building and floor
    const groupedRooms = {};
    emptyRooms.forEach((room) => {
      let key;
      let displayName;
      if (room.toLowerCase().includes("auditorium")) {
        // Handle auditorium format: "Auditorium 3 @ Level 3"
        const match = room.match(/Auditorium (\d+) @ Level (\d+)/i);
        if (match) {
          key = `AUD-${match[2]}`; // AUD-3 for level 3
          displayName = `Auditorium ${match[1]}`;
        } else {
          key = "AUD-Other";
          displayName = room;
        }
      } else if (room.toLowerCase().includes("tech lab")) {
        // Handle Tech Lab format: "Tech Lab 4-03"
        const match = room.match(/Tech Lab (\d+)-(\d+)/i);
        if (match) {
          key = `TLAB-${match[1]}`; // TLAB-4 for level 4
          displayName = room;
        } else {
          key = "LAB-Other";
          displayName = room;
        }
      } else {
        // Handle standard format: B-06-12, D-07-02, etc.
        const parts = room.split("-");
        if (parts.length >= 2) {
          key = `${parts[0]}-${parts[1]}`; // B-06
          displayName = room;
        } else {
          key = "Other";
          displayName = room;
        }
      }

      if (!groupedRooms[key]) {
        groupedRooms[key] = {
          category: key.startsWith("AUD")
            ? "Auditorium"
            : key.startsWith("TLAB")
            ? "Tech Labs"
            : key === "LAB-Other"
            ? "Other Labs"
            : key === "Other"
            ? "Other Rooms"
            : `Block ${key.split("-")[0]}`,
          floor: key.split("-")[1] || "",
          rooms: [],
        };
      }
      groupedRooms[key].rooms.push(displayName);
    });

    // Sort groups: Auditoriums first, then blocks by name, then others
    const sortedGroups = Object.entries(groupedRooms).sort(
      ([keyA], [keyB]) => {
        // Auditoriums come first
        if (keyA.startsWith("AUD") && !keyB.startsWith("AUD")) return -1;
        if (!keyA.startsWith("AUD") && keyB.startsWith("AUD")) return 1;
        // Other rooms go last
        if (keyA === "Other") return 1;
        if (keyB === "Other") return -1;
        // Everything else sorts normally
        return keyA.localeCompare(keyB);
      }
    );

    // Split into pages of 24 fields (leaving room for header)
    const fieldsPerPage = 24;
    const pages = [];
    let currentPage = [];
    let currentFieldCount = 0;

    for (const [key, data] of sortedGroups) {
      if (currentFieldCount >= fieldsPerPage) {
        pages.push(currentPage);
        currentPage = [];
        currentFieldCount = 0;
      }
      let name;
      if (key.startsWith("AUD")) {
        name = "Auditoriums";
        if (data.floor) name += ` (Level ${data.floor})`;
      } else if (key.startsWith("TLAB")) {
        name = `Tech Labs (Level ${data.floor})`;
      } else if (key === "LAB-Other") {
        name = "Other Labs";
      } else if (key === "Other") {
        name = "Other Rooms";
      } else {
        name = `${data.category}, Floor ${data.floor}`;
      }

      currentPage.push({
        name: name,
        value: data.rooms.sort().join("\n"),
        inline: true,
      });
      currentFieldCount++;
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    // Create the embed for page 1
    embed.setTitle(
      `🏫 Empty Rooms from ${startTimeStr} to ${
        endTimeStr ||
        `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(
          2,
          "0"
        )}`
      }${dateStr ? ` on ${date.toDateString()}` : ""}`
    );
    const totalPages = pages.length;

    if (totalPages > 1) {
      embed.setFooter({
        text: `Page 1/${totalPages} • ${emptyRooms.length} empty rooms total`,
      });
    }

    embed.setDescription(
      `Found ${
        emptyRooms.length
      } empty rooms available\nTime range: ${startTimeStr} - ${
        endTimeStr ||
        `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(
          2,
          "0"
        )}`
      }`
    );

    // Add the fields for page 1
    pages[0].forEach((field) => embed.addFields(field));

    // Create navigation buttons if needed
    if (totalPages > 1) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⬅️"),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("➡️")
      );

      const response = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      let currentPageIndex = 0;

      // Create button collector
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300000, // 5 minutes
      });

      collector.on("collect", async (i) => {
        // Update page index based on button clicked
        if (i.customId === "next") {
          currentPageIndex = (currentPageIndex + 1) % totalPages;
        } else {
          currentPageIndex = (currentPageIndex - 1 + totalPages) % totalPages;
        }

        // Create new embed for the new page
        const newEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`🏫 Empty Rooms at ${startTimeStr}`)
          .setDescription(
            `Found ${
              emptyRooms.length
            } empty rooms available\nTime range: ${startTimeStr} - ${
              endTimeStr ||
              `${String(endHours).padStart(2, "0")}:${String(
                endMinutes
              ).padStart(2, "0")}`
            }`
          )
          .setFooter({
            text: `Page ${currentPageIndex + 1}/${totalPages} • ${
              emptyRooms.length
            } empty rooms total`,
          });

        pages[currentPageIndex].forEach((field) => newEmbed.addFields(field));

        // Update the message with new embed
        await i.update({ embeds: [newEmbed] });
      });

      collector.on("end", () => {
        // Disable the buttons when collector expires
        row.components.forEach((button) => button.setDisabled(true));
        interaction
          .editReply({ components: [row] })
          .catch((error) => console.error("Failed to disable buttons:", error));
      });

      return;
    }

    return { embeds: [embed] };
  },
};
