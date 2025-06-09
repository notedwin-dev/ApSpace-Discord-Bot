const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { prisma } = require('../database');

const command = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Set up automatic timetable updates in a channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to send timetable updates to')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

async function execute(interaction) {
  await interaction.deferReply();

  try {
    const channel = interaction.options.getChannel('channel');
    const serverId = interaction.guildId;    // Update or create server configuration
    const server = await prisma.server.upsert({
      where: { serverId },
      update: {
        webhookChannel: channel.id,
      },
      create: {
        serverId,
        webhookChannel: channel.id,
      }
    });

    // Check if user exists, if not create it
    const user = await prisma.user.upsert({
      where: { userId: interaction.user.id },
      update: {},
      create: { userId: interaction.user.id }
    });

    // Create ServerUser relation if it doesn't exist
    await prisma.serverUser.upsert({
      where: {
        id: await prisma.serverUser.findFirst({
          where: {
            serverId: server.id,
            userId: user.id
          }
        }).then(su => su?.id ?? '')
      },
      update: {},
      create: {
        server: { connect: { id: server.id } },
        user: { connect: { id: user.id } }
      }
    });

    await interaction.editReply(`Successfully set ${channel} as the timetable update channel!`);
  } catch (error) {
    console.error('Error setting schedule channel:', error);
    await interaction.editReply('An error occurred while setting up the schedule channel.');
  }
}

module.exports = {
  data: command,
  execute,
};
