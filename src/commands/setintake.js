const { SlashCommandBuilder } = require('discord.js');
const { prisma } = require('../database');

const command = new SlashCommandBuilder()
  .setName('setintake')
  .setDescription('Set your intake code')  .addStringOption(option =>
    option
      .setName('intake_code')
      .setDescription('Your intake code')
      .setRequired(true))
  .addStringOption(option =>
    option
      .setName('tutorial_group')
      .setDescription('Your tutorial group (e.g., G1, G2)')
      .setRequired(true));

async function execute(interaction) {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;    const intakeCode = interaction.options.getString('intake_code');
    const tutorialGroup = interaction.options.getString('tutorial_group')?.toUpperCase();

    // Upsert user with intake code and tutorial group
    await prisma.user.upsert({
      where: { userId },
      update: { 
        intakeCode,
        grouping: tutorialGroup
      },
      create: {
        userId,
        intakeCode,
        grouping: tutorialGroup
      }
    });

    await interaction.editReply(`Successfully set your intake code to ${intakeCode}${tutorialGroup ? ` (Group ${tutorialGroup})` : ''}`);
  } catch (error) {
    console.error('Error setting intake code:', error);
    await interaction.editReply('An error occurred while setting your intake code.');
  }
}

module.exports = {
  data: command,
  execute,
};
