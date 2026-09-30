const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const config = require('../config');

// Run /setup-info inside your "information" channel. It posts the VIP plans + a "Go to site" button.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-info')
    .setDescription('Post the VIP plans and the "Go to site" button in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const header = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle('💎 VIP Plans')
      .setDescription(
        'Pick the plan that fits you. Every tier includes everything from the tier below.\n' +
          'Purchases are made **only on our website** and your role is given automatically.'
      );

    const planEmbeds = config.plans.map((p) =>
      new EmbedBuilder()
        .setColor(p.color)
        .setTitle(`${p.emoji} ${p.name} — ${p.price}`)
        .addFields(
          { name: 'On the platform', value: p.platform.map((x) => `• ${x}`).join('\n') },
          { name: 'On Discord', value: p.discord.map((x) => `• ${x}`).join('\n') }
        )
    );

    const footer = new EmbedBuilder()
      .setColor(config.brandColor)
      .setDescription('⚠️ Staff will **never** ask you to pay in DMs. Only buy from the official site.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Go to site').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(config.siteUrl)
    );

    await interaction.channel.send({ embeds: [header, ...planEmbeds, footer], components: [row] });
    return interaction.reply({ content: 'Posted ✅', flags: MessageFlags.Ephemeral });
  },
};
