const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
} = require('discord.js');
const config = require('./config');

// ===== Auto-close settings =====
const WARN_AFTER_HOURS = 48; // warn the user when nobody wrote in the ticket for this long
const CLOSE_AFTER_WARN_HOURS = 24; // close the ticket if nobody replies this long after the warning
const CHECK_EVERY_MINUTES = 30; // how often the bot checks the open tickets

const FILE = path.join(__dirname, '..', 'data', 'tickets.json');
const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const HOUR = 60 * 60 * 1000;

// ---------- storage ----------
function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    d.counter = d.counter || 0;
    d.tickets = d.tickets || {};
    return d;
  } catch {
    return { counter: 0, tickets: {} };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Reserve the next number right away so two people opening a ticket at once never get the same one.
function nextNumber() {
  const data = load();
  data.counter += 1;
  save(data);
  return data.counter;
}

const getTicket = (threadId) => load().tickets[threadId] || null;

// Change fields of one ticket and save right away (no waiting in between, so nothing gets overwritten)
function patchTicket(threadId, changes) {
  const data = load();
  const t = data.tickets[threadId];
  if (!t) return null;
  Object.assign(t, changes);
  save(data);
  return t;
}

// ---------- helpers ----------
const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const small = (lines) => lines.map((l) => `-# ${l}`).join('\n');
const pad = (n) => String(n).padStart(4, '0');
const fmt = (n) => `#${pad(n)}`;
const categoryOf = (key) => config.tickets.categories.find((c) => c.key === key);
// Name of the private thread, for example "support-smoty" or "purchase-indigo"
function threadName(slug, user) {
        name: threadName(cat.slug || cat.key, interaction.user),
  const name = String(user.username || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'user';
  return `${slug}-${name}`;
}

function isStaff(member) {
  if (!member) return false;
  const roleId = config.tickets.staffRoleId;
  if (roleId && member.roles && member.roles.cache && member.roles.cache.has(roleId)) return true;
  return Boolean(member.permissions && member.permissions.has(PermissionFlagsBits.ManageThreads));
}

// Time of a Discord ID (used to know when the last message in a ticket was written)
const DISCORD_EPOCH = 1420070400000n;
const snowflakeTime = (id) => Number((BigInt(id) >> 22n) + DISCORD_EPOCH);

// ---------- the panel (posted by /setup-tickets or the channel sync) ----------
function buildPanel() {
  const c = new ContainerBuilder();
  c.addTextDisplayComponents(text(`##  ${config.brandName} Support\n${config.tickets.panelText}`));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(
    text(config.tickets.categories.map((cat) => `${cat.emoji} **${cat.name}**\n${small([cat.description])}`).join('\n\n'))
  );
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text(small(['Only you and the staff can see your ticket.'])));
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      config.tickets.categories.map((cat) =>
        new ButtonBuilder()
          .setCustomId(`ticket_open:${cat.key}`)
          .setLabel(cat.name)
          .setEmoji(cat.emoji)
          .setStyle(ButtonStyle.Secondary)
      )
    )
  );
  return c;
}

// ---------- the message inside every ticket thread ----------
function buildTicketContainer(t) {
  const cat = categoryOf(t.category) || { emoji: '<:ticket_clwn:1558564782607568907>', name: t.category };
  const closed = t.status === 'closed';
  const c = new ContainerBuilder();

  c.addTextDisplayComponents(text(`## ${cat.emoji} ${cat.name} · ${fmt(t.number)}`));
  c.addTextDisplayComponents(
    text(`<@${t.userId}> opened this ticket <t:${Math.floor(t.openedAt / 1000)}:R>. The staff will reply here soon.`)
  );
  c.addSeparatorComponents(divider());

  for (const f of t.fields) c.addTextDisplayComponents(text(`### ${f.label}\n${f.value}`));

  c.addSeparatorComponents(divider());
  const footer = ['Only you and the admins can see this thread.'];
  if (t.claimedBy) footer.push(`Claimed by <@${t.claimedBy}>`);
  if (closed) footer.push(t.autoClosed ? 'Closed automatically (nobody replied)' : `Closed by <@${t.closedBy}>`);
  c.addTextDisplayComponents(text(small(footer)));

  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel(t.claimedBy ? 'Claimed' : 'Claim')
        .setEmoji('<:approuved_clwn:1558577655723593748>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(closed || Boolean(t.claimedBy)),
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close ticket')
        .setEmoji('<:rejected_clwn:1558577590569017454>')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(closed)
    )
  );
  return c;
}

// ---------- opening a ticket ----------
async function findOpenTicket(client, userId) {
  const data = load();
  const t = Object.values(data.tickets).find((x) => x.userId === userId && x.status === 'open');
  if (!t) return null;
  const thread = await client.channels.fetch(t.threadId).catch(() => null);
  if (thread && !thread.archived) return t;
  // The thread was deleted or archived: close the stale record so the user can open a new ticket
  patchTicket(t.threadId, { status: 'closed', closedAt: Date.now() });
  return null;
}

async function openModal(interaction, key) {
  const cat = categoryOf(key);
  if (!cat) return interaction.reply({ content: 'Unknown category.', flags: EPHEMERAL });

  const existing = await findOpenTicket(interaction.client, interaction.user.id);
  if (existing) {
    return interaction.reply({ content: `You already have an open ticket: <#${existing.threadId}>`, flags: EPHEMERAL });
  }

  const modal = new ModalBuilder().setCustomId(`ticket_modal:${key}`).setTitle(`${cat.name} ticket`);
  for (const f of cat.fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(f.label)
      .setStyle(f.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(f.required !== false)
      .setMaxLength(1000);
    if (f.placeholder) input.setPlaceholder(f.placeholder);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return interaction.showModal(modal);
}

async function handleModal(interaction) {
  const key = interaction.customId.split(':')[1];
  const cat = categoryOf(key);
  if (!cat) return interaction.reply({ content: 'Unknown category.', flags: EPHEMERAL });

  await interaction.deferReply({ flags: EPHEMERAL });

  const existing = await findOpenTicket(interaction.client, interaction.user.id);
  if (existing) return interaction.editReply(`You already have an open ticket: <#${existing.threadId}>`);

  try {
    const number = nextNumber();
    const fields = cat.fields.map((f) => ({
      label: f.label,
      value: interaction.fields.getTextInputValue(f.id).trim() || '—',
    }));

    // Private thread, only people added to it can see it
    const thread = await interaction.channel.threads.create({
      name: threadName(cat.slug || cat.key, interaction.user),
      type: ChannelType.PrivateThread,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      invitable: false,
      reason: `Ticket opened by ${interaction.user.tag}`,
    });
    await thread.members.add(interaction.user.id);

    const ticket = {
      number,
      category: cat.key,
      userId: interaction.user.id,
      threadId: thread.id,
      openedAt: Date.now(),
      status: 'open',
      claimedBy: null,
      fields,
    };

    // Mentioning the staff role in a private thread adds its members to it
    const staffRoleId = config.tickets.staffRoleId;
    if (staffRoleId) {
      await thread.send({ content: `<@&${staffRoleId}>`, allowedMentions: { roles: [staffRoleId] } });
    }
    const message = await thread.send({
      components: [buildTicketContainer(ticket)],
      flags: V2,
      allowedMentions: { parse: [] }, // text typed by the user can never ping anyone
    });
    ticket.messageId = message.id;

    const data = load();
    data.tickets[thread.id] = ticket;
    save(data);

    return interaction.editReply(`Your ticket was created: ${thread}`);
  } catch (err) {
    console.error('Ticket creation failed:', err);
    return interaction.editReply(
      "I couldn't create the ticket. An admin needs to give my role the permissions: Create Private Threads, Send Messages in Threads and Manage Threads."
    );
  }
}

// ---------- closing ----------
async function sendTranscript(client, thread, t) {
  const logId = config.tickets.logChannelId;
  if (!logId) return;
  const log = await client.channels.fetch(logId).catch(() => null);
  if (!log) return;

  const messages = await thread.messages.fetch({ limit: 100 });
  const lines = [...messages.values()]
    .reverse()
    .filter((m) => m.content || m.attachments.size)
    .map((m) => {
      const time = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
      const files = m.attachments.size ? ` ${[...m.attachments.values()].map((a) => a.url).join(' ')}` : '';
      return `[${time}] ${m.author.tag}: ${m.content}${files}`;
    });

  const body = [
    `Ticket ${fmt(t.number)} (${t.category})`,
    `Opened by user ID ${t.userId} on ${new Date(t.openedAt).toISOString()}`,
    ...t.fields.map((f) => `${f.label}: ${f.value}`),
    '',
    '--- conversation (last 100 messages) ---',
    ...lines,
  ].join('\n');

  const closedBy = t.autoClosed ? 'automatically (nobody replied)' : `by <@${t.closedBy}>`;
  await log.send({
    content: `Ticket **${fmt(t.number)}** (${t.category}) closed ${closedBy} · opened by <@${t.userId}>`,
    files: [new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `ticket-${pad(t.number)}.txt` })],
    allowedMentions: { parse: [] },
  });
}

// Private message to the person who opened the ticket, asking for a rating from 1 to 5
async function askForRating(client, t) {
  try {
    const user = await client.users.fetch(t.userId);
    const cat = categoryOf(t.category) || { name: t.category };
    const row = new ActionRowBuilder().addComponents(
      [1, 2, 3, 4, 5].map((n) =>
        new ButtonBuilder().setCustomId(`ticket_rate:${t.threadId}:${n}`).setLabel(String(n)).setStyle(ButtonStyle.Secondary)
      )
    );
    await user.send({
      content: `### How was your support?\n-# Your ticket ${fmt(t.number)} (${cat.name}) was closed. Press a number from 1 (bad) to 5 (great).`,
      components: [row],
    });
  } catch {
    // The user has private messages turned off: no rating, nothing else to do
  }
}

async function handleRating(interaction) {
  const [, threadId, n] = interaction.customId.split(':');
  const rating = Number(n);
  const t = getTicket(threadId);
  if (!t || interaction.user.id !== t.userId || !(rating >= 1 && rating <= 5)) {
    return interaction.reply({ content: 'This rating is not valid.', flags: EPHEMERAL });
  }
  if (t.rating) {
    return interaction.update({ content: `### Thank you!\n-# You already rated this ticket ${t.rating}/5.`, components: [] });
  }

  patchTicket(threadId, { rating, ratedAt: Date.now() });
  await interaction.update({ content: `### Thank you for your feedback!\n-# You rated this ticket ${rating}/5.`, components: [] });

  // Tell the staff
  const logId = config.tickets.logChannelId;
  const log = logId ? await interaction.client.channels.fetch(logId).catch(() => null) : null;
  if (log) {
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    await log
      .send({
        content: `${stars} Ticket **${fmt(t.number)}** (${t.category}) rated **${rating}/5** by <@${t.userId}>`,
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  }
}

// Everything that happens when a ticket is closed, manually or automatically
async function finalizeTicket(client, thread, t, { auto = false } = {}) {
  const card = t.messageId ? await thread.messages.fetch(t.messageId).catch(() => null) : null;
  if (card) await card.edit({ components: [buildTicketContainer(t)], flags: V2 }).catch(() => {});

  const note = auto
    ? 'This ticket was closed automatically because nobody replied.'
    : `Ticket closed by <@${t.closedBy}>. Thanks for contacting us!`;
  await thread.send({ content: note, allowedMentions: { parse: [] } }).catch(() => {});

  await sendTranscript(client, thread, t).catch(console.error);
  if (!auto) await askForRating(client, t);

  // Lock first, then archive (an archived thread cannot be changed)
  await thread.setLocked(true).catch(() => {});
  await thread.setArchived(true).catch(() => {});
}

// ---------- claim / close buttons ----------
async function claim(interaction) {
  const t = getTicket(interaction.channelId);
  if (!t || t.status !== 'open') {
    return interaction.reply({ content: 'This ticket is not open.', flags: EPHEMERAL });
  }
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can claim tickets.', flags: EPHEMERAL });
  }
  if (t.claimedBy) {
    return interaction.reply({ content: `Already claimed by <@${t.claimedBy}>.`, flags: EPHEMERAL });
  }

  const updated = patchTicket(t.threadId, { claimedBy: interaction.user.id });
  await interaction.deferUpdate();
  await interaction.message.edit({ components: [buildTicketContainer(updated)], flags: V2 });
  await interaction.channel
    .send({ content: ` ${interaction.user} claimed this ticket.`, allowedMentions: { parse: [] } })
    .catch(() => {});
}

async function close(interaction) {
  const t = getTicket(interaction.channelId);
  if (!t || t.status !== 'open') {
    return interaction.reply({ content: 'This ticket is already closed.', flags: EPHEMERAL });
  }
  if (!isStaff(interaction.member) && interaction.user.id !== t.userId) {
    return interaction.reply({ content: 'Only the ticket owner or staff can close this ticket.', flags: EPHEMERAL });
  }

  const closed = patchTicket(t.threadId, { status: 'closed', closedBy: interaction.user.id, closedAt: Date.now() });
  await interaction.deferUpdate();
  await finalizeTicket(interaction.client, interaction.channel, closed);
}

// ---------- closing tickets nobody answers ----------
async function checkInactivity(client) {
  const open = Object.values(load().tickets).filter((t) => t.status === 'open');
  for (const t of open) {
    try {
      const thread = await client.channels.fetch(t.threadId).catch(() => null);
      if (!thread || thread.archived) {
        patchTicket(t.threadId, { status: 'closed', closedAt: Date.now() });
        continue;
      }

      const now = Date.now();
      const lastId = thread.lastMessageId;
      const lastActivity = lastId ? snowflakeTime(lastId) : t.openedAt;

      if (t.warnMessageId) {
        if (lastId === t.warnMessageId) {
          // Still nobody replied after the warning
          if (now - t.warnedAt >= CLOSE_AFTER_WARN_HOURS * HOUR) {
            const closed = patchTicket(t.threadId, {
              status: 'closed',
              closedBy: client.user.id,
              closedAt: now,
              autoClosed: true,
            });
            await finalizeTicket(client, thread, closed, { auto: true });
          }
        } else {
          // Somebody replied, the countdown starts again
          patchTicket(t.threadId, { warnMessageId: null, warnedAt: null });
        }
      } else if (now - lastActivity >= WARN_AFTER_HOURS * HOUR) {
        const warning = await thread.send({
          content: `<@${t.userId}> nobody wrote in this ticket for ${WARN_AFTER_HOURS} hours. It will be closed automatically in ${CLOSE_AFTER_WARN_HOURS} hours if nobody replies.`,
          allowedMentions: { users: [t.userId] },
        });
        patchTicket(t.threadId, { warnMessageId: warning.id, warnedAt: now });
      }
    } catch (err) {
      console.error(`Ticket check failed for ${t.threadId}:`, err.message);
    }
  }
}

function startMaintenance(client) {
  const run = () => checkInactivity(client).catch(console.error);
  setTimeout(run, 30 * 1000).unref(); // first check shortly after the bot starts
  setInterval(run, CHECK_EVERY_MINUTES * 60 * 1000).unref();
}

// ---------- routers used by index.js ----------
async function handleButton(interaction) {
  const id = interaction.customId;
  if (id.startsWith('ticket_open:')) return openModal(interaction, id.split(':')[1]);
  if (id.startsWith('ticket_rate:')) return handleRating(interaction);
  if (id === 'ticket_claim') return claim(interaction);
  if (id === 'ticket_close') return close(interaction);
}

module.exports = {
  buildPanel,
  buildTicketContainer,
  handleButton,
  handleModal,
  getTicket,
  isStaff,
  threadName,
  startMaintenance,
  checkInactivity, // exported for testing
};
