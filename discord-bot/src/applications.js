const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
} = require('discord.js');
const config = require('./config');
const { isStaff, threadName } = require('./tickets');

// ===== Settings =====
// When the applications are closed, the button is turned off and shows this emoji and "Staff applications are closed".
// Put your emoji here (normal like '🔒' or custom like '<:closed:123456789012345678>'). Leave '' for no emoji.
const CLOSED_EMOJI = '<:rejected_clwn:1558577590569017454>';
const COOLDOWN_DAYS = 7; // days someone has to wait after a denied application
// Role pinged for every new application (default: the ticket staff role)
const REVIEWER_ROLE_ID = process.env.APPLICATION_REVIEWER_ROLE_ID || config.tickets.staffRoleId || '1554811408758083615, 1554811587649347604';
// Optional: role given automatically when an application is accepted (for example "Trial staff")
const ACCEPT_ROLE_ID = process.env.APPLICATION_ACCEPT_ROLE_ID || '';
// Where decisions are logged (default: the ticket log channel)
const LOG_CHANNEL_ID = process.env.APPLICATION_LOG_CHANNEL_ID || config.tickets.logChannelId || '1561831580492632094';

// Shown on the panel
const REQUIREMENTS = [
  'Be active on the server and in the community',
  'Be respectful, patient and fair with everyone',
  'Be able to follow the rules and work with the team',
];

// The form (max 5 questions, label max 45 characters)
const QUESTIONS = [
  { id: 'position', label: 'Position you apply for', style: 'short', placeholder: 'e.g. Moderator or Support' },
  { id: 'why', label: 'Why do you want to join the staff?', style: 'paragraph' },
  { id: 'experience', label: 'Do you have any experience?', style: 'paragraph' },
  { id: 'availability', label: 'Timezone and hours per week', style: 'short', placeholder: 'e.g. UTC+2, about 10 hours' },
  { id: 'extra', label: 'Anything else we should know?', style: 'paragraph', required: false },
];

const FILE = path.join(__dirname, '..', 'data', 'applications.json');
const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const DAY = 24 * 60 * 60 * 1000;

// ---------- storage ----------
function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    d.counter = d.counter || 0;
    d.apps = d.apps || {};
    d.cooldowns = d.cooldowns || {};
    return d;
  } catch {
    return { counter: 0, apps: {}, cooldowns: {} };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Open / closed switch, changed with /applications open and /applications close
const isOpen = () => load().open !== false;
function setOpen(value) {
  const data = load();
  data.open = value;
  save(data);
}

function nextNumber() {
  const data = load();
  data.counter += 1;
  save(data);
  return data.counter;
}

const getApp = (threadId) => load().apps[threadId] || null;

function patchApp(threadId, changes) {
  const data = load();
  const a = data.apps[threadId];
  if (!a) return null;
  Object.assign(a, changes);
  save(data);
  return a;
}

function setCooldown(userId, until) {
  const data = load();
  data.cooldowns[userId] = until;
  save(data);
}

// ---------- helpers ----------
const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const small = (lines) => lines.map((l) => `-# ${l}`).join('\n');
const pad = (n) => String(n).padStart(4, '0');
const reply = (interaction, content) => interaction.reply({ content, flags: EPHEMERAL });

// ---------- the panel (posted automatically in the applications channel) ----------
function buildPanel() {
  const open = isOpen();
  const c = new ContainerBuilder();
  const intro = open
    ? 'Want to help run the community? Fill in the form and the team will review your application.'
    : 'Staff applications are closed.';
  c.addTextDisplayComponents(text(`## ${config.brandName} Staff applications\n${intro}`));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text(`**What we look for**\n${small(REQUIREMENTS)}`));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(
    text(small([`Only you and the staff can see your application. If it is denied you can apply again after ${COOLDOWN_DAYS} days.`]))
  );

  const button = new ButtonBuilder().setCustomId('apply_start').setStyle(ButtonStyle.Secondary);
  if (open) {
    button.setLabel('Apply');
  } else {
    button.setLabel('Staff applications are closed').setDisabled(true);
    if (CLOSED_EMOJI) button.setEmoji(CLOSED_EMOJI);
  }
  c.addActionRowComponents(new ActionRowBuilder().addComponents(button));
  return c;
}

// ---------- the card inside every application thread ----------
function buildApplicationContainer(a) {
  const c = new ContainerBuilder();
  const decided = a.status !== 'pending';

  c.addTextDisplayComponents(text(`## Staff application · #${pad(a.number)}`));
  c.addTextDisplayComponents(
    text(`<@${a.userId}> applied <t:${Math.floor(a.openedAt / 1000)}:R>. The team will review it soon.`)
  );
  const info = [`Account created <t:${Math.floor(a.accountCreated / 1000)}:R>`];
  if (a.joinedServer) info.push(`joined the server <t:${Math.floor(a.joinedServer / 1000)}:R>`);
  c.addTextDisplayComponents(text(small([info.join(' · ')])));
  c.addSeparatorComponents(divider());

  for (const f of a.fields) c.addTextDisplayComponents(text(`### ${f.label}\n${f.value}`));

  c.addSeparatorComponents(divider());
  const footer = ['Only you and the admins can see this thread.'];
  if (a.status === 'accepted') footer.push(`Accepted by <@${a.decidedBy}>`);
  if (a.status === 'denied') footer.push(`Denied by <@${a.decidedBy}>`);
  if (decided && a.reason) footer.push(`Reason: ${a.reason}`);
  c.addTextDisplayComponents(text(small(footer)));

  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('apply_accept').setLabel('Accept').setStyle(ButtonStyle.Secondary).setDisabled(decided),
      new ButtonBuilder().setCustomId('apply_deny').setLabel('Deny').setStyle(ButtonStyle.Secondary).setDisabled(decided)
    )
  );
  return c;
}

// ---------- applying ----------
async function findPending(client, userId) {
  const a = Object.values(load().apps).find((x) => x.userId === userId && x.status === 'pending');
  if (!a) return null;
  const thread = await client.channels.fetch(a.threadId).catch(() => null);
  if (thread && !thread.archived) return a;
  patchApp(a.threadId, { status: 'closed' }); // the thread was deleted or archived
  return null;
}

async function checkCanApply(interaction) {
  if (!isOpen()) return 'Staff applications are closed.';
  const until = load().cooldowns[interaction.user.id] || 0;
  if (until > Date.now()) return `You can apply again <t:${Math.ceil(until / 1000)}:R>.`;
  const pending = await findPending(interaction.client, interaction.user.id);
  if (pending) return `You already have an open application: <#${pending.threadId}>`;
  return null;
}

async function startApplication(interaction) {
  const problem = await checkCanApply(interaction);
  if (problem) return reply(interaction, problem);

  const modal = new ModalBuilder().setCustomId('apply_modal').setTitle('Staff application');
  for (const q of QUESTIONS) {
    const input = new TextInputBuilder()
      .setCustomId(q.id)
      .setLabel(q.label)
      .setStyle(q.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required !== false)
      .setMaxLength(1000);
    if (q.placeholder) input.setPlaceholder(q.placeholder);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return interaction.showModal(modal);
}

async function submitApplication(interaction) {
  await interaction.deferReply({ flags: EPHEMERAL });

  const problem = await checkCanApply(interaction);
  if (problem) return interaction.editReply(problem);

  try {
    const number = nextNumber();
    const fields = QUESTIONS.map((q) => ({
      label: q.label,
      value: interaction.fields.getTextInputValue(q.id).trim() || '—',
    }));

    const thread = await interaction.channel.threads.create({
      name: threadName('application', interaction.user),
      type: ChannelType.PrivateThread,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      invitable: false,
      reason: `Staff application from ${interaction.user.tag}`,
    });
    await thread.members.add(interaction.user.id);

    const app = {
      number,
      userId: interaction.user.id,
      threadId: thread.id,
      openedAt: Date.now(),
      accountCreated: interaction.user.createdTimestamp,
      joinedServer: interaction.member ? interaction.member.joinedTimestamp : null,
      status: 'pending',
      fields,
    };

    if (REVIEWER_ROLE_ID) {
      await thread.send({ content: `<@&${REVIEWER_ROLE_ID}>`, allowedMentions: { roles: [REVIEWER_ROLE_ID] } });
    }
    const message = await thread.send({
      components: [buildApplicationContainer(app)],
      flags: V2,
      allowedMentions: { parse: [] }, // text typed by the applicant can never ping anyone
    });
    app.messageId = message.id;

    const data = load();
    data.apps[thread.id] = app;
    save(data);

    return interaction.editReply(`Your application was sent: ${thread}`);
  } catch (err) {
    console.error('Application failed:', err);
    return interaction.editReply(
      "I couldn't create your application. An admin needs to give my role the permissions: Create Private Threads, Send Messages in Threads and Manage Threads."
    );
  }
}

// ---------- accepting / denying ----------
async function openDecisionModal(interaction, verdict) {
  const a = getApp(interaction.channelId);
  if (!a || a.status !== 'pending') return reply(interaction, 'This application is already decided.');
  if (!isStaff(interaction.member)) return reply(interaction, 'Only staff can decide on applications.');

  const modal = new ModalBuilder()
    .setCustomId(`apply_decision:${verdict}`)
    .setTitle(verdict === 'accept' ? 'Accept this application' : 'Deny this application');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Message for the applicant (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500)
    )
  );
  return interaction.showModal(modal);
}

async function decide(interaction, verdict) {
  const a = getApp(interaction.channelId);
  if (!a || a.status !== 'pending') return reply(interaction, 'This application is already decided.');
  if (!isStaff(interaction.member)) return reply(interaction, 'Only staff can decide on applications.');
  await interaction.deferReply({ flags: EPHEMERAL });

  const accepted = verdict === 'accept';
  const reason = interaction.fields.getTextInputValue('reason').trim();
  const done = patchApp(a.threadId, {
    status: accepted ? 'accepted' : 'denied',
    decidedBy: interaction.user.id,
    decidedAt: Date.now(),
    reason,
  });
  const until = Date.now() + COOLDOWN_DAYS * DAY;
  if (!accepted) setCooldown(a.userId, until);

  const thread = interaction.channel;

  // 1) update the card (buttons off, status shown)
  const card = a.messageId ? await thread.messages.fetch(a.messageId).catch(() => null) : null;
  if (card) await card.edit({ components: [buildApplicationContainer(done)], flags: V2, allowedMentions: { parse: [] } }).catch(() => {});

  // 2) give the role when accepted
  let note = '';
  if (accepted && ACCEPT_ROLE_ID) {
    try {
      const member = await interaction.guild.members.fetch(a.userId);
      await member.roles.add(ACCEPT_ROLE_ID, 'Staff application accepted');
    } catch (err) {
      console.error('Application: could not give the role:', err.message);
      note = ' I could not give the role (my role must be above it and I need Manage Roles).';
    }
  }

  // 3) tell the applicant
  try {
    const user = await interaction.client.users.fetch(a.userId);
    const body = accepted
      ? '### Your staff application was accepted\n-# Congratulations! A member of the team will contact you soon.'
      : `### Your staff application was not accepted this time\n-# You can apply again <t:${Math.ceil(until / 1000)}:R>.`;
    await user.send({ content: reason ? `${body}\n\n${reason}` : body });
  } catch {
    // private messages are closed, the thread message below still tells them
  }

  // 4) message in the thread and in the log channel
  await thread
    .send({
      content: `${accepted ? 'Accepted' : 'Denied'} by ${interaction.user}.${reason ? `\n${reason}` : ''}`,
      allowedMentions: { parse: [] },
    })
    .catch(() => {});
  const log = LOG_CHANNEL_ID ? await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null) : null;
  if (log) {
    await log
      .send({
        content: `Staff application **#${pad(a.number)}** from <@${a.userId}> was **${accepted ? 'accepted' : 'denied'}** by <@${interaction.user.id}>${reason ? `\n> ${reason}` : ''}`,
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  }

  await interaction.editReply(`Done, the application was ${accepted ? 'accepted' : 'denied'}.${note}`);

  // 5) close the thread
  await thread.setLocked(true).catch(() => {});
  await thread.setArchived(true).catch(() => {});
}

// ---------- routers used by index.js ----------
async function handleButton(interaction) {
  const id = interaction.customId;
  if (id === 'apply_start') return startApplication(interaction);
  if (id === 'apply_accept') return openDecisionModal(interaction, 'accept');
  if (id === 'apply_deny') return openDecisionModal(interaction, 'deny');
}

async function handleModal(interaction) {
  const id = interaction.customId;
  if (id === 'apply_modal') return submitApplication(interaction);
  if (id.startsWith('apply_decision:')) return decide(interaction, id.split(':')[1]);
}

module.exports = { buildPanel, buildApplicationContainer, handleButton, handleModal, isOpen, setOpen };
