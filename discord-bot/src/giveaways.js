const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('./config');

const FILE = path.join(__dirname, '..', 'data', 'giveaways.json');
const timers = new Map();

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function pickWinners(entries, count) {
  const pool = [...entries];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function buildEmbed(g, ended = false) {
  const embed = new EmbedBuilder().setColor(config.brandColor).setTitle(`🎁 ${g.prize}`);
  if (!ended) {
    const ts = Math.floor(g.endsAt / 1000);
    embed.setDescription(
      `Click the button below to enter!\n\n**Ends:** <t:${ts}:R>\n**Winners:** ${g.winners}\n**Hosted by:** <@${g.hostId}>`
    );
  } else {
    const list = g.winnerIds && g.winnerIds.length ? g.winnerIds.map((id) => `<@${id}>`).join(', ') : 'nobody (no entries)';
    embed.setDescription(`**Giveaway ended.**\n\n**Winners:** ${list}\n**Hosted by:** <@${g.hostId}>`);
  }
  return embed;
}

function schedule(client, messageId, endsAt) {
  const MAX_DELAY = 2 ** 31 - 1; // setTimeout limit (~24 days)
  const delay = Math.max(endsAt - Date.now(), 0);
  const timer = setTimeout(() => {
    if (endsAt - Date.now() > 1000) return schedule(client, messageId, endsAt);
    endGiveaway(client, messageId).catch(console.error);
  }, Math.min(delay, MAX_DELAY));
  timers.set(messageId, timer);
}

async function createGiveaway(interaction, { prize, minutes, winners }) {
  const g = {
    channelId: interaction.channelId,
    prize,
    winners,
    endsAt: Date.now() + minutes * 60 * 1000,
    hostId: interaction.user.id,
    entries: [],
    ended: false,
  };
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter').setEmoji('🎉').setStyle(ButtonStyle.Danger)
  );
  const message = await interaction.channel.send({ embeds: [buildEmbed(g)], components: [row] });
  const data = load();
  data[message.id] = g;
  save(data);
  schedule(interaction.client, message.id, g.endsAt);
  return message;
}

async function endGiveaway(client, messageId) {
  const data = load();
  const g = data[messageId];
  if (!g || g.ended) return false;

  g.ended = true;
  g.winnerIds = pickWinners(g.entries, g.winners);
  save(data);
  clearTimeout(timers.get(messageId));
  timers.delete(messageId);

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return true;
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (message) await message.edit({ embeds: [buildEmbed(g, true)], components: [] }).catch(() => {});

  const text = g.winnerIds.length
    ? `🎉 Congratulations ${g.winnerIds.map((id) => `<@${id}>`).join(', ')}! You won **${g.prize}**!`
    : `Nobody entered the giveaway for **${g.prize}**.`;
  await channel.send(text).catch(() => {});
  return true;
}

async function handleGiveawayButton(interaction) {
  const data = load();
  const g = data[interaction.message.id];
  if (!g || g.ended || Date.now() > g.endsAt) {
    return interaction.reply({ content: 'This giveaway has ended.', flags: MessageFlags.Ephemeral });
  }
  const index = g.entries.indexOf(interaction.user.id);
  let reply;
  if (index === -1) {
    g.entries.push(interaction.user.id);
    reply = "You're in! Good luck 🎉";
  } else {
    g.entries.splice(index, 1);
    reply = 'You left the giveaway.';
  }
  save(data);
  return interaction.reply({ content: reply, flags: MessageFlags.Ephemeral });
}

// After a restart, re-schedule giveaways that are still running.
function restoreGiveaways(client) {
  const data = load();
  for (const [messageId, g] of Object.entries(data)) {
    if (!g.ended) schedule(client, messageId, g.endsAt);
  }
}

module.exports = { createGiveaway, endGiveaway, handleGiveawayButton, restoreGiveaways };
