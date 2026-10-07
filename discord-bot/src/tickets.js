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

const FILE = path.join(__dirname, '..', 'data', 'tickets.json');
const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;

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

// ---------- helpers ----------
const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const small = (lines) => lines.map((l) => `-# ${l}`).join('\n');
const pad = (n) => String(n).padStart(4, '0');
const fmt = (n) => `#${pad(n)}`;
const categoryOf = (key) => config.tickets.categories.find((c) => c.key === key);

function isStaff(member) {
  if (!member) return false;
  const roleId = config.tickets.staffRoleId;
  if (roleId && member.roles && member.roles.cache && member.roles.cache.has(roleId)) return true;
  return Boolean(member.permissions && member.permissions.has(PermissionFlagsBits.ManageThreads));
}

// ---------- the panel (posted by /setup-tickets) ----------
function buildPanel() {
  const c = new ContainerBuilder();
  c.addTextDisplayComponents(text(`## 🎫 ${config.brandName} Support\n${config.tickets.panelText}`));
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
  const cat = categoryOf(t.category) || { emoji: '🎫', name: t.category };
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
  if (closed) footer.push(`Closed by <@${t.closedBy}>`);
  c.addTextDisplayComponents(text(small(footer)));

  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel(t.claimedBy ? 'Claimed' : 'Claim')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(closed || Boolean(t.claimedBy)),
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
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
  t.status = 'closed';
  save(data);
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
      name: `${cat.key}-${pad(number)}`,
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

    return interaction.editReply(`✅ Your ticket was created: ${thread}`);
  } catch (err) {
    console.error('Ticket creation failed:', err);
    return interaction.editReply(
      "I couldn't create the ticket. An admin needs to give my role the permissions: Create Private Threads, Send Messages in Threads and Manage Threads."
    );
  }
}

// ---------- claim / close ----------
async function claim(interaction) {
  const data = load();
  const t = data.tickets[interaction.channelId];
  if (!t || t.status !== 'open') {
    return interaction.reply({ content: 'This ticket is not open.', flags: EPHEMERAL });
  }
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Only staff can claim tickets.', flags: EPHEMERAL });
  }
  if (t.claimedBy) {
    return interaction.reply({ content: `Already claimed by <@${t.claimedBy}>.`, flags: EPHEMERAL });
  }

  t.claimedBy = interaction.user.id;
  save(data);
  await interaction.deferUpdate();
  await interaction.message.edit({ components: [buildTicketContainer(t)], flags: V2 });
  await interaction.channel
    .send({ content: `✅ ${interaction.user} claimed this ticket.`, allowedMentions: { parse: [] } })
    .catch(() => {});
}

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

  await log.send({
    content: `📁 Ticket **${fmt(t.number)}** (${t.category}) closed by <@${t.closedBy}> · opened by <@${t.userId}>`,
    files: [new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `ticket-${pad(t.number)}.txt` })],
    allowedMentions: { parse: [] },
  });
}

async function close(interaction) {
  const data = load();
  const t = data.tickets[interaction.channelId];
  if (!t || t.status !== 'open') {
    return interaction.reply({ content: 'This ticket is already closed.', flags: EPHEMERAL });
  }
  if (!isStaff(interaction.member) && interaction.user.id !== t.userId) {
    return interaction.reply({ content: 'Only the ticket owner or staff can close this ticket.', flags: EPHEMERAL });
  }

  t.status = 'closed';
  t.closedBy = interaction.user.id;
  t.closedAt = Date.now();
  save(data);

  await interaction.deferUpdate();
  await interaction.message.edit({ components: [buildTicketContainer(t)], flags: V2 }).catch(() => {});
  await interaction.channel
    .send({ content: `🔒 Ticket closed by ${interaction.user}. Thanks for contacting us!`, allowedMentions: { parse: [] } })
    .catch(() => {});
  await sendTranscript(interaction.client, interaction.channel, t).catch(console.error);

  // Lock first, then archive (an archived thread cannot be changed)
  await interaction.channel.setLocked(true).catch(() => {});
  await interaction.channel.setArchived(true).catch(() => {});
}

// ---------- routers used by index.js ----------
async function handleButton(interaction) {
  const id = interaction.customId;
  if (id.startsWith('ticket_open:')) return openModal(interaction, id.split(':')[1]);
  if (id === 'ticket_claim') return claim(interaction);
  if (id === 'ticket_close') return close(interaction);
}

module.exports = { buildPanel, buildTicketContainer, handleButton, handleModal };
