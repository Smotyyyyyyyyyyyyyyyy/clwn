const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { MessageFlags } = require('discord.js');

const FILE = path.join(__dirname, '..', 'data', 'synced-messages.json');
const V2 = MessageFlags.IsComponentsV2;

// ===== Channel IDs =====
// Paste the channel ID between the quotes (right click channel > Copy Channel ID),
// or set the matching variable on Railway. Leave empty to skip that message.
const CHANNELS = {
  rules: process.env.RULES_CHANNEL_ID || '1554810624956170252',
  info: process.env.INFO_CHANNEL_ID || '1554818925408157707',
  tickets: process.env.TICKET_PANEL_CHANNEL_ID || '1554818454534619136',
  verify: process.env.VERIFY_CHANNEL_ID || '1561434000827092992',
};

// Which message goes in which channel. The cards are built from the code, so when you edit the
// code on GitHub and Railway redeploys, the message in the channel is edited to match.
const MESSAGES = [
  { key: 'rules', channelId: CHANNELS.rules, build: () => require('./commands/rules').buildRules() },
  { key: 'info', channelId: CHANNELS.info, build: () => require('./commands/setup').buildPricingContainer() },
  { key: 'tickets', channelId: CHANNELS.tickets, build: () => require('./tickets').buildPanel() },
  { key: 'verify', channelId: CHANNELS.verify, build: () => require('./verify').buildPanel() },
];

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function save(store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

async function syncOne(client, item, store) {
  if (!item.channelId) return;

  const channel = await client.channels.fetch(item.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.warn(`[sync] ${item.key}: channel ${item.channelId} not found (check the ID and my permissions)`);
    return;
  }

  const container = item.build();
  const payload = { components: [container], flags: V2, allowedMentions: { parse: [] } };
  const hash = crypto.createHash('sha1').update(JSON.stringify(container.toJSON())).digest('hex');
  const saved = store[item.key];

  let message = null;
  if (saved && saved.channelId === item.channelId) {
    message = await channel.messages.fetch(saved.messageId).catch(() => null);
    if (message && saved.hash === hash) {
      console.log(`[sync] ${item.key}: up to date`);
      return;
    }
  } else if (saved) {
    // The channel ID was changed: remove the old message from the old channel
    const oldChannel = await client.channels.fetch(saved.channelId).catch(() => null);
    const old = oldChannel ? await oldChannel.messages.fetch(saved.messageId).catch(() => null) : null;
    if (old) await old.delete().catch(() => {});
  }

  // If the data file was lost, reuse the bot's latest card in this channel instead of posting a duplicate
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    message = recent ? recent.find((m) => m.author.id === client.user.id && m.flags.has(V2)) || null : null;
  }

  if (message) {
    await message.edit(payload);
    console.log(`[sync] ${item.key}: updated`);
  } else {
    message = await channel.send(payload);
    console.log(`[sync] ${item.key}: posted`);
  }
  store[item.key] = { channelId: item.channelId, messageId: message.id, hash };
}

async function syncMessages(client) {
  const store = load();
  for (const item of MESSAGES) {
    try {
      await syncOne(client, item, store);
    } catch (err) {
      console.error(`[sync] ${item.key} failed:`, err.message);
    }
  }
  save(store);
}

module.exports = { syncMessages };
