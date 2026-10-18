const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { makeCaptcha } = require('./captcha');
const config = require('./config');

// ===== Settings =====
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID || '1554812191792832612'; // role given after verifying (paste the ID here or set the Railway variable)
const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID || ''; // optional: role removed after verifying
const ICON = ''; // normal emoji or custom <:name:123456789012345678>
const CODE_TTL_MS = 3 * 60 * 1000; // a captcha is valid for 3 minutes
const MAX_WRONG = 3; // wrong answers allowed...
const LOCK_MS = 10 * 60 * 1000; // ...before the user must wait this long
const MAX_CAPTCHAS = 6; // new captchas allowed per 10 minutes

const EPHEMERAL = MessageFlags.Ephemeral;
const pending = new Map(); // userId -> { code, expires }
const wrong = new Map(); // userId -> number of wrong answers
const locked = new Map(); // userId -> timestamp until which they are locked
const issued = new Map(); // userId -> timestamps of recent captchas

// Clean old entries now and then
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
  for (const [k, v] of locked) if (v < now) locked.delete(k);
  for (const [k, v] of issued) if (!v.some((t) => now - t < LOCK_MS)) issued.delete(k);
}, 60 * 1000).unref();

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

// ---------- the panel (posted automatically in the verify channel) ----------
function buildPanel() {
  const c = new ContainerBuilder();
  c.addTextDisplayComponents(
    text(`## ${config.brandName} Verification\nPress the button below and solve a short captcha to get access to the server.`)
  );
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text('-# This keeps bots and raiders out.'));
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_start').setLabel('Verify').setEmoji(ICON).setStyle(ButtonStyle.Primary)
    )
  );
  return c;
}

// ---------- helpers ----------
const ts = (ms) => `<t:${Math.ceil(ms / 1000)}:R>`;

// Answers by editing the captcha message if the click came from it, otherwise with a new private reply
function respond(interaction, content) {
  if (typeof interaction.isFromMessage === 'function' && interaction.isFromMessage()) {
    return interaction.update({ content, components: [], attachments: [] });
  }
  return interaction.reply({ content, flags: EPHEMERAL });
}

function captchaPayload() {
  const { code, png } = makeCaptcha();
  return {
    code,
    payload: {
      content: '### Solve the captcha\n-# Type the 6 digits you see in the image. It expires in 3 minutes.',
      files: [new AttachmentBuilder(png, { name: 'captcha.png' })],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('verify_enter').setLabel('Enter code').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('verify_new').setLabel('New image').setStyle(ButtonStyle.Secondary)
        ),
      ],
    },
  };
}

// ---------- buttons ----------
async function sendCaptcha(interaction, isRefresh) {
  const uid = interaction.user.id;
  const now = Date.now();

  if (!MEMBER_ROLE_ID) {
    console.error('Verification: MEMBER_ROLE_ID is not set');
    return interaction.reply({ content: 'Verification is not set up yet. Please tell the staff.', flags: EPHEMERAL });
  }
  if (interaction.member && interaction.member.roles.cache.has(MEMBER_ROLE_ID)) {
    return interaction.reply({ content: `${ICON} You are already verified.`, flags: EPHEMERAL });
  }
  if ((locked.get(uid) || 0) > now) {
    return interaction.reply({ content: `Too many tries. You can try again ${ts(locked.get(uid))}.`, flags: EPHEMERAL });
  }

  const recent = (issued.get(uid) || []).filter((t) => now - t < LOCK_MS);
  if (recent.length >= MAX_CAPTCHAS) {
    return interaction.reply({ content: 'You asked for too many captchas. Please wait a few minutes and try again.', flags: EPHEMERAL });
  }
  recent.push(now);
  issued.set(uid, recent);

  const { code, payload } = captchaPayload();
  pending.set(uid, { code, expires: now + CODE_TTL_MS });

  if (isRefresh) return interaction.update({ ...payload, attachments: [] });
  return interaction.reply({ ...payload, flags: EPHEMERAL });
}

async function openModal(interaction) {
  const p = pending.get(interaction.user.id);
  if (!p || p.expires < Date.now()) {
    pending.delete(interaction.user.id);
    return respond(interaction, 'This captcha expired. Press **Verify** again to get a new one.');
  }
  const modal = new ModalBuilder().setCustomId('verify_modal').setTitle('Enter the code');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('code')
        .setLabel('The 6 digits from the image')
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setRequired(true)
        .setPlaceholder('123456')
    )
  );
  return interaction.showModal(modal);
}

async function handleButton(interaction) {
  if (interaction.customId === 'verify_start') return sendCaptcha(interaction, false);
  if (interaction.customId === 'verify_new') return sendCaptcha(interaction, true);
  if (interaction.customId === 'verify_enter') return openModal(interaction);
}

// ---------- answer ----------
async function handleModal(interaction) {
  const uid = interaction.user.id;
  const p = pending.get(uid);
  if (!p || p.expires < Date.now()) {
    pending.delete(uid);
    return respond(interaction, 'This captcha expired. Press **Verify** again to get a new one.');
  }

  const answer = interaction.fields.getTextInputValue('code').replace(/\s/g, '');
  pending.delete(uid); // every captcha can be tried only once

  if (answer === p.code) {
    wrong.delete(uid);
    try {
      await interaction.member.roles.add(MEMBER_ROLE_ID, 'Passed the captcha');
      if (UNVERIFIED_ROLE_ID) await interaction.member.roles.remove(UNVERIFIED_ROLE_ID, 'Passed the captcha').catch(() => {});
    } catch (err) {
      console.error('Verification: could not give the role:', err.message);
      return respond(interaction, 'I could not give you the role. Please tell the staff (my role must be above the Member role and I need Manage Roles).');
    }
    return respond(interaction, `${ICON} You are verified. Welcome!`);
  }

  const count = (wrong.get(uid) || 0) + 1;
  if (count >= MAX_WRONG) {
    wrong.delete(uid);
    const until = Date.now() + LOCK_MS;
    locked.set(uid, until);
    return respond(interaction, `Wrong code. Too many tries, you can try again ${ts(until)}.`);
  }
  wrong.set(uid, count);
  return respond(interaction, `Wrong code. You have ${MAX_WRONG - count} ${MAX_WRONG - count === 1 ? 'try' : 'tries'} left. Press **Verify** again for a new image.`);
}

module.exports = { buildPanel, handleButton, handleModal };
