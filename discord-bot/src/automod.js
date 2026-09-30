const { PermissionFlagsBits } = require('discord.js');

const recent = new Map(); // userId -> timestamps of recent messages
const INVITE = /(discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;

const SPAM_MESSAGES = 6; // this many messages...
const SPAM_WINDOW_MS = 5000; // ...within this window = spam
const MAX_MENTIONS = 5;
const TIMEOUT_MS = 5 * 60 * 1000;

async function handleAutomod(message) {
  if (!message.guild || message.author.bot || !message.member) return;
  // Staff are never checked
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  // 1) Invites to other servers
  if (INVITE.test(message.content)) {
    await message.delete().catch(() => {});
    const warn = await message.channel
      .send(`${message.author}, invite links are not allowed here.`)
      .catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  // 2) Message flood and mass mentions
  const now = Date.now();
  const times = (recent.get(message.author.id) || []).filter((t) => now - t < SPAM_WINDOW_MS);
  times.push(now);
  recent.set(message.author.id, times);

  if (times.length >= SPAM_MESSAGES || message.mentions.users.size >= MAX_MENTIONS) {
    recent.delete(message.author.id);
    await message.delete().catch(() => {});
    if (message.member.moderatable) {
      await message.member.timeout(TIMEOUT_MS, 'Automod: spam').catch(() => {});
    }
    const warn = await message.channel
      .send(`${message.author} was timed out for 5 minutes (spam).`)
      .catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => {}), 8000);
  }
}

module.exports = { handleAutomod };
