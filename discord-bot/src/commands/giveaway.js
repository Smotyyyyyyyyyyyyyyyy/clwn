const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createGiveaway, endGiveaway, rerollGiveaway } = require('../giveaways');

// "30m", "12h", "3d", "1w" -> milliseconds (between 1 minute and 30 days)
function parseDuration(input) {
  const m = /^(\d+)\s*(m|h|d|w)$/i.exec(input.trim());
  if (!m) return null;
  const unit = { m: 60e3, h: 3600e3, d: 86400e3, w: 604800e3 }[m[2].toLowerCase()];
  const ms = Number(m[1]) * unit;
  if (ms < 60e3 || ms > 30 * 86400e3) return null;
  return ms;
}

const reply = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('Start a giveaway in this channel')
        .addStringOption((o) => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addStringOption((o) =>
          o.setName('duration').setDescription('How long? Examples: 30m, 12h, 3d, 1w').setRequired(true)
        )
        .addIntegerOption((o) =>
          o.setName('winners').setDescription('Number of winners (default 1)').setMinValue(1).setMaxValue(20)
        )
        .addBooleanOption((o) => o.setName('ping').setDescription('Ping the giveaway role? (default: yes)'))
    )
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the giveaway message').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('reroll')
        .setDescription('Pick new winners for a finished giveaway')
        .addStringOption((o) => o.setName('message_id').setDescription('ID of the giveaway message').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const durationMs = parseDuration(interaction.options.getString('duration'));
      if (!durationMs) {
        return reply(interaction, 'Invalid duration. Use a number and m/h/d/w, for example `30m`, `12h`, `3d` or `1w` (1 minute to 30 days).');
      }
      await createGiveaway(interaction, {
        prize: interaction.options.getString('prize'),
        durationMs,
        winners: interaction.options.getInteger('winners') || 1,
        ping: interaction.options.getBoolean('ping') ?? true,
      });
      return reply(interaction, 'Giveaway started');
    }

    const messageId = interaction.options.getString('message_id').trim();

    if (sub === 'end') {
      const ok = await endGiveaway(interaction.client, messageId);
      return reply(interaction, ok ? 'Giveaway ended' : 'No active giveaway found with that message ID.');
    }

    if (sub === 'reroll') {
      const ok = await rerollGiveaway(interaction.client, messageId);
      return reply(interaction, ok ? 'Rerolled' : 'No finished giveaway found with that message ID.');
    }
  },
};
