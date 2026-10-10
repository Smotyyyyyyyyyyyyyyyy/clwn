const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} = require('discord.js');

// ===== Icons: normal emojis, or your own server emojis like <:name:123456789012345678> =====
const ICON = {
  prize: '<:giveaway_clwn:1558565526437892116>',
  time: '<:time_clwn:1558563813404704808>',
  winners: '<:medal_clwn:1558564882524274748>',
  entries: '<:member_clwn:1558562596288729129>',
  enter: '<:gift_clwn:1558562470363406356>',
};

const FILE = path.join(__dirname, '..', 'data', 'giveaways.json');
const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const endTimers = new Map();
const refreshTimers = new Map();

// ---------- storage ----------
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!raw.giveaways) return { counter: 0, giveaways: raw }; // old file format (before numbering)
    raw.counter = raw.counter || 0;
    return raw;
  } catch {
    return { counter: 0, giveaways: {} };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function nextNumber() {
  const data = load();
  data.counter += 1;
  save(data);
  return data.counter;
}

// ---------- helpers ----------
const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const small = (lines) => lines.map((l) => `-# ${l}`).join('\n');
const plural = (n, one, many) => (n === 1 ? one : many);

function pickWinners(entries, count) {
  const pool = [...entries];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// ---------- the giveaway card ----------
function buildContainer(g) {
  const c = new ContainerBuilder();
  const n = g.entries.length;
  const lines = [`## ${ICON.prize} ${g.prize}`];

  if (!g.ended) {
    const ts = Math.floor(g.endsAt / 1000);
    lines.push(`${ICON.time} Ends <t:${ts}:R> (<t:${ts}:f>)`);
    lines.push(`${ICON.winners} **${g.winners}** ${plural(g.winners, 'winner', 'winners')}`);
  } else {
    const ts = Math.floor((g.endedAt || g.endsAt) / 1000);
    const ids = g.winnerIds || [];
    lines.push(`${ICON.time} Ended <t:${ts}:R> (<t:${ts}:f>)`);
    lines.push(
      `${ICON.winners} ${plural(ids.length, 'Winner', 'Winners')}: ${ids.length ? ids.map((id) => `<@${id}>`).join(', ') : 'nobody'}`
    );
  }
  lines.push(`${ICON.entries} **${n}** ${plural(n, 'entry', 'entries')}`);

  c.addTextDisplayComponents(text(lines.join('\n')));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text(small([`Hosted by <@${g.hostId}>${g.number ? ` · #${g.number}` : ''}`])));
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_enter')
        .setLabel(g.ended ? 'Giveaway ended' : 'Enter giveaway')
        .setEmoji(ICON.enter)
        .setStyle(g.ended ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(Boolean(g.ended))
    )
  );
  return c;
}

async function refreshMessage(client, messageId) {
  const g = load().giveaways[messageId];
  if (!g) return;
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (message) {
    await message.edit({ components: [buildContainer(g)], flags: V2, allowedMentions: { parse: [] } });
  }
}

// Update the entry counter on the card, at most once every 2.5 seconds (Discord rate limits message edits)
function queueRefresh(client, messageId) {
  if (refreshTimers.has(messageId)) return;
  refreshTimers.set(
    messageId,
    setTimeout(() => {
      refreshTimers.delete(messageId);
      refreshMessage(client, messageId).catch(console.error);
    }, 2500)
  );
}

// ---------- start / end / reroll ----------
function schedule(client, messageId, endsAt) {
  const MAX_DELAY = 2 ** 31 - 1; // setTimeout limit (~24 days)
  const delay = Math.max(endsAt - Date.now(), 0);
  const timer = setTimeout(() => {
    if (endsAt - Date.now() > 1000) return schedule(client, messageId, endsAt);
    endGiveaway(client, messageId).catch(console.error);
  }, Math.min(delay, MAX_DELAY));
  endTimers.set(messageId, timer);
}

async function createGiveaway(interaction, { prize, durationMs, winners, ping }) {
  const number = nextNumber();
  const g = {
    number,
    channelId: interaction.channelId,
    prize,
    winners,
    endsAt: Date.now() + durationMs,
    hostId: interaction.user.id,
    entries: [],
    ended: false,
  };

  // 1) Ping the giveaway role (separate message above the card, like in the screenshot)
  const roleId = process.env.GIVEAWAY_ROLE_ID;
  if (ping && roleId) {
    await interaction.channel.send({ content: `<@&${roleId}>`, allowedMentions: { roles: [roleId] } });
  }

  // 2) The card
  const message = await interaction.channel.send({
    components: [buildContainer(g)],
    flags: V2,
    allowedMentions: { parse: [] },
  });

  const data = load();
  data.giveaways[message.id] = g;
  save(data);
  schedule(interaction.client, message.id, g.endsAt);
  return message;
}

async function announce(client, g, messageId, content, userIds = []) {
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return;
  await channel
    .send({
      content,
      allowedMentions: { users: userIds },
      reply: { messageReference: messageId, failIfNotExists: false },
    })
    .catch(() => {});
}

const mentionList = (ids) => ids.map((id) => `<@${id}>`).join(', ');

async function endGiveaway(client, messageId) {
  const data = load();
  const g = data.giveaways[messageId];
  if (!g || g.ended) return false;

  g.ended = true;
  g.endedAt = Date.now();
  g.winnerIds = pickWinners(g.entries, g.winners);
  save(data);

  clearTimeout(endTimers.get(messageId));
  endTimers.delete(messageId);

  await refreshMessage(client, messageId).catch(console.error);
  if (g.winnerIds.length) {
    await announce(client, g, messageId, `Congratulations ${mentionList(g.winnerIds)}! You won **${g.prize}**!`, g.winnerIds);
  } else {
    await announce(client, g, messageId, `Nobody entered the giveaway for **${g.prize}**.`);
  }
  return true;
}

async function rerollGiveaway(client, messageId) {
  const data = load();
  const g = data.giveaways[messageId];
  if (!g || !g.ended) return false;

  g.winnerIds = pickWinners(g.entries, g.winners);
  save(data);

  await refreshMessage(client, messageId).catch(console.error);
  if (g.winnerIds.length) {
    await announce(client, g, messageId, `New winner${g.winnerIds.length === 1 ? '' : 's'}: ${mentionList(g.winnerIds)}! You won **${g.prize}**!`, g.winnerIds);
  } else {
    await announce(client, g, messageId, `Nobody entered the giveaway for **${g.prize}**.`);
  }
  return true;
}

// ---------- buttons ----------
const leaveRow = (messageId) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway_leave:${messageId}`).setLabel('Leave giveaway').setStyle(ButtonStyle.Secondary)
  );

async function enter(interaction) {
  const messageId = interaction.message.id;
  const data = load();
  const g = data.giveaways[messageId];
  if (!g || g.ended || Date.now() > g.endsAt) {
    return interaction.reply({ content: 'This giveaway has ended.', flags: EPHEMERAL });
  }

  let title = "You're already in!";
  if (!g.entries.includes(interaction.user.id)) {
    g.entries.push(interaction.user.id);
    save(data);
    queueRefresh(interaction.client, messageId);
    title = "You're in! Good luck.";
  }
  const n = g.entries.length;
  return interaction.reply({
    content: `### ${title}\n-# ${n} ${plural(n, 'entry', 'entries')} · you can leave any time before it ends`,
    components: [leaveRow(messageId)],
    flags: EPHEMERAL,
  });
}

async function leave(interaction) {
  const messageId = interaction.customId.split(':')[1];
  const data = load();
  const g = data.giveaways[messageId];
  if (!g || g.ended) {
    return interaction.update({ content: 'This giveaway has ended.', components: [] });
  }

  const i = g.entries.indexOf(interaction.user.id);
  if (i !== -1) {
    g.entries.splice(i, 1);
    save(data);
    queueRefresh(interaction.client, messageId);
  }
  const n = g.entries.length;
  return interaction.update({
    content: `### You left the giveaway.\n-# ${n} ${plural(n, 'entry', 'entries')}`,
    components: [],
  });
}

async function handleGiveawayButton(interaction) {
  if (interaction.customId === 'giveaway_enter') return enter(interaction);
  if (interaction.customId.startsWith('giveaway_leave:')) return leave(interaction);
}

// After a restart, re-schedule giveaways that are still running.
function restoreGiveaways(client) {
  for (const [messageId, g] of Object.entries(load().giveaways)) {
    if (!g.ended) schedule(client, messageId, g.endsAt);
  }
}

module.exports = { createGiveaway, endGiveaway, rerollGiveaway, handleGiveawayButton, restoreGiveaways };
