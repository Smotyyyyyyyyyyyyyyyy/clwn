const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../config');

const profile = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Get the link to a profile on the site')
    .addStringOption((o) => o.setName('username').setDescription('Username on the site').setRequired(true)),
  async execute(interaction) {
    const username = interaction.options.getString('username').trim();
    const url = `${config.siteUrl.replace(/\/$/, '')}/${encodeURIComponent(username)}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Open profile').setStyle(ButtonStyle.Link).setURL(url)
    );
    return interaction.reply({ content: `Profile of **${username}**:`, components: [row] });
  },
};

const stats = {
  data: new SlashCommandBuilder().setName('stats').setDescription('Show server statistics').setDMPermission(false),
  async execute(interaction) {
    const g = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor(config.brandColor)
      .setTitle(`📊 ${g.name}`)
      .addFields(
        { name: 'Members', value: String(g.memberCount), inline: true },
        { name: 'Boosts', value: String(g.premiumSubscriptionCount || 0), inline: true },
        { name: 'Created', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true }
      );
    return interaction.reply({ embeds: [embed] });
  },
};

const ping = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check if the bot is alive'),
  async execute(interaction) {
    return interaction.reply(`🏓 Pong! ${Math.round(interaction.client.ws.ping)} ms`);
  },
};

module.exports = [profile, stats, ping];
