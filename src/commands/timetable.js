const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const api = require('../api');
const { getIntakeCodeByUserId, getGroupingByUserId } = require('../database');

const command = new SlashCommandBuilder()
  .setName('timetable')
  .setDescription('Get timetable information')
  .addSubcommand(subcommand =>
    subcommand
      .setName('today')
      .setDescription('Get today\'s timetable')
      .addStringOption(option =>
        option
          .setName('intake_code')
          .setDescription('Optional: Override your saved intake code')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('tutorial_group')
          .setDescription('Optional: Filter by tutorial group (e.g., G1, G2)')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('sort_by')
          .setDescription('Optional: Sort results by category')
          .setRequired(false)
          .addChoices(
            { name: 'By Time', value: 'time' },
            { name: 'By Module', value: 'module' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('weekly')
      .setDescription('Get weekly timetable')
      .addStringOption(option =>
        option
          .setName('intake_code')
          .setDescription('Optional: Override your saved intake code')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('tutorial_group')
          .setDescription('Optional: Filter by tutorial group (e.g., G1, G2)')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('sort_by')
          .setDescription('Optional: Sort results by category')
          .setRequired(false)
          .addChoices(
            { name: 'By Day', value: 'day' },
            { name: 'By Module', value: 'module' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('daily')
      .setDescription('Get timetable for a specific weekday')
      .addStringOption(option =>
        option
          .setName('weekday')
          .setDescription('The day of the week')
          .setRequired(true)
          .addChoices(
            { name: 'Monday', value: 'monday' },
            { name: 'Tuesday', value: 'tuesday' },
            { name: 'Wednesday', value: 'wednesday' },
            { name: 'Thursday', value: 'thursday' },
            { name: 'Friday', value: 'friday' }
          ))
      .addStringOption(option =>
        option
          .setName('intake_code')
          .setDescription('Optional: Override your saved intake code')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('tutorial_group')
          .setDescription('Optional: Filter by tutorial group (e.g., G1, G2)')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('sort_by')
          .setDescription('Optional: Sort results by category')
          .setRequired(false)
          .addChoices(
            { name: 'By Time', value: 'time' },
            { name: 'By Module', value: 'module' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('date')
      .setDescription('Get timetable for a specific date')
      .addStringOption(option =>
        option
          .setName('date')
          .setDescription('Date in YYYY-MM-DD format')
          .setRequired(true))
      .addStringOption(option =>
        option
          .setName('intake_code')
          .setDescription('Optional: Override your saved intake code')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('tutorial_group')
          .setDescription('Optional: Filter by tutorial group (e.g., G1, G2)')
          .setRequired(false))
      .addStringOption(option =>
        option
          .setName('sort_by')
          .setDescription('Optional: Sort results by category')
          .setRequired(false)
          .addChoices(
            { name: 'By Time', value: 'time' },
            { name: 'By Module', value: 'module' }
          )))
  .addSubcommand(subcommand =>
    subcommand
      .setName('empty-rooms')
      .setDescription('Find empty rooms')
      .addStringOption(option =>
        option
          .setName('time')
          .setDescription('Time in HH:mm format')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('room')
      .setDescription('Get schedule for a specific room')
      .addStringOption(option =>
        option
          .setName('room_number')
          .setDescription('Room number (e.g. B-06-12)')
          .setRequired(true))
      .addStringOption(option =>
        option
          .setName('date')
          .setDescription('Optional: Date in YYYY-MM-DD format')
          .setRequired(false)));

async function execute(interaction) {
  await interaction.deferReply();
  try {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const providedIntakeCode = interaction.options.getString('intake_code');
    let grouping = interaction.options.getString('tutorial_group');
    const sortBy = interaction.options.getString('sort_by');
    
    // If no group specified, get user's default group
    if (!grouping) {
      grouping = await getGroupingByUserId(userId);
    }
    
    let intakeCode = providedIntakeCode;
    if (!intakeCode) {
      intakeCode = await getIntakeCodeByUserId(userId);
      if (!intakeCode) {
        return await interaction.editReply('Please set your intake code first using `/setintake`');
      }
    }

    let classes = [];
    let embed = new EmbedBuilder().setColor(0x0099FF);

    switch (subcommand) {
      case 'today': {
        const date = new Date();
        classes = await api.timetable.getByIntake(intakeCode, date);
        embed.setTitle(`📅 Today's Timetable (${date.toDateString()})`);
        break;
      }
      
      case 'weekly': {
        classes = await api.timetable.getWeeklyByIntake(intakeCode);
        embed.setTitle('📅 Weekly Timetable');
        break;
      }

      case 'daily': {
        const weekday = interaction.options.getString('weekday');
        classes = await api.timetable.getDailyByIntake(intakeCode, weekday);
        embed.setTitle(`📅 Timetable for ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}`);
        break;
      }

      case 'date': {
        const date = new Date(interaction.options.getString('date'));
        classes = await api.timetable.getByIntake(intakeCode, date);
        embed.setTitle(`📅 Timetable for ${date.toDateString()}`);
        break;
      }      case 'empty-rooms': {
        const timeStr = interaction.options.getString('time');
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        const date = new Date();
        const startTime = new Date(date.setHours(hours, minutes, 0));
        const endTime = new Date(date.setHours(hours + 1, minutes, 0));

        const emptyRooms = await api.timetable.getEmptyRooms(date, [startTime, endTime]);
        
        if (emptyRooms.length === 0) {
          embed
            .setTitle(`🏫 Empty Rooms`)
            .setDescription('No empty rooms found for this time slot.');
          return await interaction.editReply({ embeds: [embed] });
        }        // Group rooms by building and floor
        const groupedRooms = {};
        emptyRooms.forEach(room => {
          let key;
          let displayName;          if (room.toLowerCase().includes('auditorium')) {
            // Handle auditorium format: "Auditorium 3 @ Level 3"
            const match = room.match(/Auditorium (\d+) @ Level (\d+)/i);
            if (match) {
              key = `AUD-${match[2]}`; // AUD-3 for level 3
              displayName = `Auditorium ${match[1]}`;
            } else {
              key = 'AUD-Other';
              displayName = room;
            }
          } else if (room.toLowerCase().includes('tech lab')) {
            // Handle Tech Lab format: "Tech Lab 4-03"
            const match = room.match(/Tech Lab (\d+)-(\d+)/i);
            if (match) {
              key = `TLAB-${match[1]}`; // TLAB-4 for level 4
              displayName = room;
            } else {
              key = 'LAB-Other';
              displayName = room;
            }
          } else {
            // Handle standard format: B-06-12, D-07-02, etc.
            const parts = room.split('-');
            if (parts.length >= 2) {
              key = `${parts[0]}-${parts[1]}`; // B-06
              displayName = room;
            } else {
              // Handle other special cases
              key = 'Other';
              displayName = room;
            }
          }

          if (!groupedRooms[key]) {
            groupedRooms[key] = {              category: key.startsWith('AUD') ? 'Auditorium' : 
                       key.startsWith('TLAB') ? 'Tech Labs' :
                       key === 'LAB-Other' ? 'Other Labs' :
                       key === 'Other' ? 'Other Rooms' : `Block ${key.split('-')[0]}`,
              floor: key.split('-')[1] || '',
              rooms: []
            };
          }
          groupedRooms[key].rooms.push(displayName);
        });        // Sort groups: Auditoriums first, then blocks by name, then others
        const sortedGroups = Object.entries(groupedRooms).sort(([keyA, dataA], [keyB, dataB]) => {
          // Auditoriums come first
          if (keyA.startsWith('AUD') && !keyB.startsWith('AUD')) return -1;
          if (!keyA.startsWith('AUD') && keyB.startsWith('AUD')) return 1;
          // Other rooms go last
          if (keyA === 'Other') return 1;
          if (keyB === 'Other') return -1;
          // Everything else sorts normally
          return keyA.localeCompare(keyB);
        });
        
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
          }          let name;
          if (key.startsWith('AUD')) {
            name = 'Auditoriums';
            if (data.floor) name += ` (Level ${data.floor})`;
          } else if (key.startsWith('TLAB')) {
            name = `Tech Labs (Level ${data.floor})`;
          } else if (key === 'LAB-Other') {
            name = 'Other Labs';
          } else if (key === 'Other') {
            name = 'Other Rooms';
          } else {
            name = `${data.category}, Floor ${data.floor}`;
          }

          currentPage.push({
            name: name,
            value: data.rooms.sort().join('\n'),
            inline: true
          });
          currentFieldCount++;
        }

        if (currentPage.length > 0) {
          pages.push(currentPage);
        }

        // Create the embed for page 1
        embed.setTitle(`🏫 Empty Rooms at ${timeStr}`);
        const totalPages = pages.length;
        
        if (totalPages > 1) {
          embed.setFooter({ text: `Page 1/${totalPages} • ${emptyRooms.length} empty rooms total` });
        }
        
        embed.setDescription(`Found ${emptyRooms.length} empty rooms available for the next hour\nSearch time: ${timeStr} - ${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        
        // Add the fields for page 1
        pages[0].forEach(field => embed.addFields(field));
          // Create navigation buttons if needed
        const row = totalPages > 1 ? new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('prev')
              .setLabel('Previous')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⬅️'),
            new ButtonBuilder()
              .setCustomId('next')
              .setLabel('Next')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('➡️')
          ) : null;

        const response = await interaction.editReply({
          embeds: [embed],
          components: row ? [row] : []
        });

        if (totalPages > 1) {
          let currentPageIndex = 0;
          
          // Create button collector
          const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === interaction.user.id,
            time: 300000 // 5 minutes
          });

          collector.on('collect', async (i) => {
            // Update page index based on button clicked
            if (i.customId === 'next') {
              currentPageIndex = (currentPageIndex + 1) % totalPages;
            } else {
              currentPageIndex = (currentPageIndex - 1 + totalPages) % totalPages;
            }
            
            // Create new embed for the new page
            const newEmbed = new EmbedBuilder()
              .setColor(0x0099FF)
              .setTitle(`🏫 Empty Rooms at ${timeStr}`)
              .setDescription(`Found ${emptyRooms.length} empty rooms available for the next hour\nSearch time: ${timeStr} - ${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
              .setFooter({ text: `Page ${currentPageIndex + 1}/${totalPages} • ${emptyRooms.length} empty rooms total` });
            
            pages[currentPageIndex].forEach(field => newEmbed.addFields(field));
            
            // Update the message with new embed
            await i.update({ embeds: [newEmbed] });
          });
          
          collector.on('end', () => {
            // Disable the buttons when collector expires
            row.components.forEach(button => button.setDisabled(true));
            interaction.editReply({ components: [row] }).catch(error => 
              console.error('Failed to disable buttons:', error));
          });
        }
        
        return;
      }

      case 'room': {
        const roomNumber = interaction.options.getString('room_number');
        const date = interaction.options.getString('date') ? new Date(interaction.options.getString('date')) : new Date();
        classes = await api.timetable.getRoomSchedule(roomNumber, date);
        embed.setTitle(`📅 Schedule for Room ${roomNumber} on ${date.toDateString()}`);
        break;
      }    }    
    // Only filter by tutorial group if not searching by room
    if (subcommand !== 'room' && grouping) {
      classes = classes.filter(cls => cls.grouping === grouping.toUpperCase());
      if (!classes.length) {
        return await interaction.editReply(`No classes found for tutorial group ${grouping}.`);
      }
    } else if (!classes.length) {
      return await interaction.editReply('No classes scheduled for this period.');
    }

    // Set description based on command type
    if (subcommand === 'room') {
      embed.setDescription(`All classes scheduled for this room`);
    } else {
      embed.setDescription(`Intake: ${intakeCode}${grouping ? ` (Group ${grouping})` : ''}`);
    }
    // Sort classes based on sort_by option
    if (sortBy) {
      switch (sortBy) {
        case 'time':
          classes.sort((a, b) => a.startTime - b.startTime);
          classes.forEach(cls => {
            const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            embed.addFields({
              name: `${cls.moduleCode} - ${cls.moduleName}`,
              value: `🕒 ${startTime} - ${endTime}\n🏫 Room ${cls.roomNumber}`
            });
          });
          break;

        case 'module':
          const moduleGroups = {};
          classes.forEach(cls => {
            if (!moduleGroups[cls.moduleCode]) {
              moduleGroups[cls.moduleCode] = [];
            }
            moduleGroups[cls.moduleCode].push(cls);
          });

          for (const [moduleCode, moduleClasses] of Object.entries(moduleGroups)) {
            const firstClass = moduleClasses[0];
            let value = moduleClasses.map(cls => {
              const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const day = cls.startTime.toLocaleDateString('en-US', { weekday: 'long' });
              return `${day}: 🕒 ${startTime} - ${endTime}\n🏫 Room ${cls.roomNumber}`;
            }).join('\n');
            
            embed.addFields({
              name: `${moduleCode} - ${firstClass.moduleName}`,
              value: value
            });
          }
          break;

        case 'day':
          const dayGroups = {};
          classes.forEach(cls => {
            const day = cls.startTime.toLocaleDateString('en-US', { weekday: 'long' });
            if (!dayGroups[day]) {
              dayGroups[day] = [];
            }
            dayGroups[day].push(cls);
          });

          for (const [day, dayClasses] of Object.entries(dayGroups)) {
            dayClasses.sort((a, b) => a.startTime - b.startTime);
            let value = dayClasses.map(cls => {
              const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              return `${cls.moduleCode} - ${cls.moduleName}\n🕒 ${startTime} - ${endTime}\n🏫 Room ${cls.roomNumber}`;
            }).join('\n\n');
            
            embed.addFields({
              name: day,
              value: value
            });
          }
          break;
      }
    } else {
      // Default sorting by time
      classes.sort((a, b) => a.startTime - b.startTime);
      classes.forEach(cls => {
        const startTime = cls.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const endTime = cls.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        embed.addFields({
          name: `${cls.moduleCode} - ${cls.moduleName}`,
          value: `🕒 ${startTime} - ${endTime}\n🏫 Room ${cls.roomNumber}`
        });
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error executing timetable command:', error);
    await interaction.editReply('An error occurred while fetching the timetable.');
  }
}

module.exports = {
  data: command,
  execute
};