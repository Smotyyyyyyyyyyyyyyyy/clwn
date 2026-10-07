const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildPanel } = require('../tickets');

// Run /setup-tickets in the channel where members should open tickets (e.g. #open-ticket).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Post the ticket panel in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.channel.send({
      components: [buildPanel()],
      flags: MessageFlags.IsComponentsV2,
    });
    return interaction.reply({ content: 'Ticket panel posted ✅', flags: MessageFlags.Ephemeral });
  },
};
