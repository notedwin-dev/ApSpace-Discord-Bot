const {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getExcludedModulesByUserId, setExcludedModulesByUserId } = require("../../database");

module.exports = {
  data: new SlashCommandSubcommandBuilder()
    .setName("manage-modules")
    .setDescription("Manage which modules to hide from your timetable")
    .addStringOption((option) =>
      option
        .setName("intake_code")
        .setDescription("Optional: Override your saved intake code")
        .setRequired(false)
    ),

  async execute(interaction, api, intakeCode, grouping) {
    try {
      // Fetch all timetable data to get unique modules for this intake
      let classes = await api.timetable.fetchAllTimetable(intakeCode);
      
      if (!classes.length) {
        return await interaction.editReply({
          content: "No classes found for your intake code. Please check your intake code.",
          embeds: [],
          components: [],
        });
      }

      // Get unique modules for this intake code
      const moduleMap = new Map();
      classes.forEach((cls) => {
        if (!moduleMap.has(cls.moduleCode)) {
          moduleMap.set(cls.moduleCode, {
            code: cls.moduleCode,
            name: cls.moduleName,
          });
        }
      });
      const availableModules = Array.from(moduleMap.values());

      if (availableModules.length === 0) {
        return await interaction.editReply({
          content: "No modules found for your intake code.",
          embeds: [],
          components: [],
        });
      }

      // Get currently excluded modules for this user
      let excludedModules = await getExcludedModulesByUserId(interaction.user.id);
      if (!excludedModules) {
        excludedModules = [];
      }

      // Create initial embed
      const createEmbed = (excludedList) => {
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("🎯 Manage Module Visibility")
          .setDescription(
            `**Select modules to hide from your timetable**\n\n` +
            `📚 **Intake:** ${intakeCode}\n` +
            `📊 **Total Modules:** ${availableModules.length}\n` +
            `🚫 **Currently Hidden:** ${excludedList.length}\n\n` +
            `*Use the dropdown menu below to select modules you want to hide*`
          )
          .setFooter({
            text: `${interaction.user.username} • Module Management`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTimestamp();

        if (excludedList.length > 0) {
          const hiddenModules = availableModules
            .filter(module => excludedList.includes(module.code))
            .map(module => `• **${module.code}** - ${module.name}`)
            .join("\n");
          embed.addFields({
            name: "🚫 Currently Hidden Modules",
            value: hiddenModules || "None",
            inline: false,
          });
        }

        return embed;
      };

      // Create multi-select menu with all available modules
      const createSelectMenu = (currentExcluded) => {
        const options = availableModules.map(module => ({
          label: `${module.code} - ${module.name}`,
          value: module.code,
          default: currentExcluded.includes(module.code),
        }));

        return new StringSelectMenuBuilder()
          .setCustomId("select_excluded_modules")
          .setPlaceholder("Select modules to hide from your timetable")
          .setMinValues(0)
          .setMaxValues(Math.min(options.length, 25)) // Discord limit
          .addOptions(options.slice(0, 25)); // Discord limit
      };

      // Create confirm and reset buttons
      const createButtons = () => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("confirm_changes")
            .setLabel("Confirm & Save")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
          new ButtonBuilder()
            .setCustomId("reset_all")
            .setLabel("Show All Modules")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🔄")
        );
      };

      // Initial UI
      let currentExcluded = [...excludedModules];
      let embed = createEmbed(currentExcluded);
      let selectMenu = createSelectMenu(currentExcluded);
      let selectRow = new ActionRowBuilder().addComponents(selectMenu);
      let buttonRow = createButtons();

      let response = await interaction.editReply({
        embeds: [embed],
        components: [selectRow, buttonRow],
      });

      // Collector for all interactions
      const collector = response.createMessageComponentCollector({ time: 300000 });
      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: "This menu is not for you!", ephemeral: true });
          return;
        }

        if (i.customId === "select_excluded_modules") {
          // Update current selection
          currentExcluded = i.values || [];
          
          // Update embed and select menu
          embed = createEmbed(currentExcluded);
          selectMenu = createSelectMenu(currentExcluded);
          selectRow = new ActionRowBuilder().addComponents(selectMenu);
          
          await i.update({
            embeds: [embed],
            components: [selectRow, buttonRow],
          });
        } else if (i.customId === "confirm_changes") {
          // Save the changes to database
          await setExcludedModulesByUserId(interaction.user.id, currentExcluded);
          
          const successEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle("✅ Module Preferences Saved")
            .setDescription(
              `Your module visibility preferences have been updated!\n\n` +
              `🚫 **Hidden Modules:** ${currentExcluded.length}\n` +
              `👁️ **Visible Modules:** ${availableModules.length - currentExcluded.length}\n\n` +
              `*These settings will apply to all your timetable commands.*`
            )
            .setFooter({
              text: "Changes saved successfully",
            })
            .setTimestamp();

          if (currentExcluded.length > 0) {
            const hiddenModules = availableModules
              .filter(module => currentExcluded.includes(module.code))
              .map(module => `• **${module.code}** - ${module.name}`)
              .join("\n");
            successEmbed.addFields({
              name: "🚫 Hidden Modules",
              value: hiddenModules,
              inline: false,
            });
          }

          await i.update({
            embeds: [successEmbed],
            components: [],
          });
          
          collector.stop();
        } else if (i.customId === "reset_all") {
          // Reset to show all modules
          currentExcluded = [];
          
          // Update embed and select menu
          embed = createEmbed(currentExcluded);
          selectMenu = createSelectMenu(currentExcluded);
          selectRow = new ActionRowBuilder().addComponents(selectMenu);
          
          await i.update({
            embeds: [embed],
            components: [selectRow, buttonRow],
          });
        }
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time") {
          // Disable all components on timeout
          selectMenu.setDisabled(true);
          buttonRow.components.forEach(button => button.setDisabled(true));
          
          const timeoutEmbed = createEmbed(currentExcluded);
          timeoutEmbed.setColor(0xff9900);
          timeoutEmbed.setFooter({ text: "Session expired - no changes were saved" });
          
          interaction.editReply({
            embeds: [timeoutEmbed],
            components: [new ActionRowBuilder().addComponents(selectMenu), buttonRow],
          }).catch(console.error);
        }
      });

    } catch (error) {
      console.error("Error in manage-modules command:", {
        message: error.message,
        stack: error.stack,
        interaction: {
          user: interaction.user.tag,
          options: interaction.options.data,
        },
      });
      await interaction.editReply("An error occurred while managing your modules.");
    }
  },
};
