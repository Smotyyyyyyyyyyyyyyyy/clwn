const {
  ActionRowBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('../config');

// ===== Settings =====
// The ping role of each command (set the Railway variable, the first one found is used)
const PING_VARS = {
  announce: ['ANNOUNCEMENT_PING_ROLE_ID', 'ANNOUNCEMENTS_PING_ROLE_ID'],
  update: ['UPDATES_PING_ROLE_ID', 'UPDATE_PING_ROLE_ID'],
};
// Colored bar on the left of the card (null = no bar)
const ACCENT = { announce: config.brandColor, update: 0x3fa7ff };

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const pingRoleId = (type) => PING_VARS[type].map((v) => process.env[v]).find(Boolean) || '';
const reply = (interaction, content) => interaction.reply({ content, flags: EPHEMERAL });

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

// Each line becomes a bullet point (leading -, *, + or • is ignored)
function bullets(raw) {
  return raw
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•+]\s*/, ''))
    .filter(Boolean)
    .map((l) => `• ${l}`)
    .join('\n');
}

function modalInput(id, label, style, { required = true, max = 1000, placeholder } = {}) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
  if (placeholder) input.setPlaceholder(placeholder);
  return new ActionRowBuilder().addComponents(input);
}

const channelOption = (o) =>
  o
    .setName('channel')
    .setDescription('Where to post it (default: this channel)')
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
const pingOption = (o) => o.setName('ping').setDescription('Ping the role? (default: yes)');

// ---------- /announce and /update open a form ----------
function makeCommand(type) {
  const isUpdate = type === 'update';
  return {
    data: new SlashCommandBuilder()
      .setName(type)
      .setDescription(isUpdate ? 'Post an update (changelog) and ping the Updates role' : 'Post an announcement and ping the Announcements role')
      .addChannelOption(channelOption)
      .addBooleanOption(pingOption)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),

    async execute(interaction) {
      const channelId = (interaction.options.getChannel('channel') || interaction.channel).id;
      const ping = interaction.options.getBoolean('ping') ?? true;

      const modal = new ModalBuilder()
        .setCustomId(`${type}_modal:${channelId}:${ping ? 1 : 0}`)
        .setTitle(isUpdate ? 'New update' : 'New announcement');

      if (isUpdate) {
        modal.addComponents(
          modalInput('title', 'Title', TextInputStyle.Short, { max: 100, placeholder: 'e.g. Update 1.2' }),
          modalInput('added', 'Added (one per line)', TextInputStyle.Paragraph, { required: false }),
          modalInput('changed', 'Changed (one per line)', TextInputStyle.Paragraph, { required: false }),
          modalInput('fixed', 'Fixed (one per line)', TextInputStyle.Paragraph, { required: false })
        );
      } else {
        modal.addComponents(
          modalInput('title', 'Title', TextInputStyle.Short, { max: 100 }),
          modalInput('message', 'Message', TextInputStyle.Paragraph, { max: 3500, placeholder: 'You can use **bold**, links and new lines' })
        );
      }
      return interaction.showModal(modal);
    },
  };
}

// ---------- the card ----------
function buildCard(type, interaction) {
  const get = (id) => interaction.fields.getTextInputValue(id).trim();
  const title = get('title').replace(/\s+/g, ' ');
  const lines = [`## ${title}`];

  if (type === 'update') {
    const sections = [
      ['Added', get('added')],
      ['Changed', get('changed')],
      ['Fixed', get('fixed')],
    ].filter(([, value]) => value);
    if (!sections.length) return { error: 'Fill in at least one of Added, Changed or Fixed.' };
    for (const [name, value] of sections) lines.push(`### ${name}\n${bullets(value)}`);
  } else {
    lines.push(get('message'));
  }

  const body = lines.join('\n');
  if (body.length > 3800) return { error: 'That is too long (the limit is about 3800 characters).' };

  const c = new ContainerBuilder();
  if (ACCENT[type]) c.setAccentColor(ACCENT[type]);
  c.addTextDisplayComponents(text(body));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text(`-# Posted by <@${interaction.user.id}> · <t:${Math.floor(Date.now() / 1000)}:f>`));
  return { container: c };
}

// ---------- the form was sent ----------
async function handleModal(interaction) {
  const [kind, channelId, pingFlag] = interaction.customId.split(':');
  const type = kind === 'update_modal' ? 'update' : 'announce';

  if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return reply(interaction, 'You do not have permission to do this.');
  }
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.guildId !== interaction.guildId) {
    return reply(interaction, 'I could not find that channel.');
  }

  const { container, error } = buildCard(type, interaction);
  if (error) return reply(interaction, error);

  const roleId = pingRoleId(type);
  const wantsPing = pingFlag === '1';
  try {
    if (wantsPing && roleId) {
      await channel.send({ content: `<@&${roleId}>`, allowedMentions: { roles: [roleId] } });
    }
    const message = await channel.send({ components: [container], flags: V2, allowedMentions: { parse: [] } });
    const note = wantsPing && !roleId ? `\n-# No ping role is set (${PING_VARS[type][0]}), so nobody was pinged.` : '';
    return reply(interaction, `Posted  ${message.url}${note}`);
  } catch (err) {
    console.error('Announcement failed:', err.message);
    return reply(interaction, 'I could not post in that channel. Check that I can send messages there.');
  }
}

module.exports = [makeCommand('announce'), makeCommand('update')];
module.exports.handleModal = handleModal;
