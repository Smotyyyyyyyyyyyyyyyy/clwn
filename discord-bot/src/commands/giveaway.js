const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createGiveaway, endGiveaway } = require('../giveaways');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('Start a giveaway in this channel')
        .addStringOption((o) => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('minutes').setDescription('Duration in minutes').setMinValue(1).setMaxValue(43200).setRequired(true)
        )
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20))
    )
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the giveaway message').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      await createGiveaway(interaction, {
        prize: interaction.options.getString('prize'),
        minutes: interaction.options.getInteger('minutes'),
        winners: interaction.options.getInteger('winners') || 1,
      });
      return interaction.reply({ content: 'Giveaway started ✅', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'end') {
      const ok = await endGiveaway(interaction.client, interaction.options.getString('message_id'));
      return interaction.reply({
        content: ok ? 'Giveaway ended ✅' : 'No active giveaway found with that message ID.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
