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
const config = require('./config');

// ===== Ping roles =====
// Members press a button to turn a role on or off.
// Put each role ID in "id" below, or set the Railway variable listed in "vars" (the first one that is set is used).
// A role without an ID is hidden from the panel. Emojis can be normal or custom: <:name:123456789012345678>
const ROLES = [
  {
    key: 'announcements',
    label: 'Announcements',
    emoji: '<:announcement_clwn:1558565091580837988>',
    description: 'Important news about the server and the platform',
    vars: ['ANNOUNCEMENT_PING_ROLE_ID', 'ANNOUNCEMENTS_PING_ROLE_ID'],
    id: '',
  },
  {
    key: 'giveaways',
    label: 'Giveaways',
    emoji: '<:giveaway_clwn:1558565526437892116>',
    description: 'Get pinged when a giveaway starts',
    vars: ['GIVEAWAY_ROLE_ID', 'GIVEAWAY_PING_ROLE_ID'],
    id: '',
  },
  {
    key: 'updates',
    label: 'Updates',
    emoji: '<:announcement_clwn:1561439944881348749>',
    description: 'New features and changes on the site',
    vars: ['UPDATES_PING_ROLE_ID', 'UPDATE_PING_ROLE_ID'],
    id: '',
  },
];

const EPHEMERAL = MessageFlags.Ephemeral;
const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

// Only the roles that have an ID
function activeRoles() {
  return ROLES.map((r) => ({ ...r, roleId: r.id || r.vars.map((v) => process.env[v]).find(Boolean) || '' })).filter(
    (r) => r.roleId
  );
}

// ---------- the panel (posted automatically in the ping roles channel) ----------
function buildPanel() {
  const roles = activeRoles();
  const c = new ContainerBuilder();
  c.addTextDisplayComponents(
    text(`## ${config.brandName} Notification roles\nChoose which pings you want to get. Press a button to turn a role on or off.`)
  );
  c.addSeparatorComponents(divider());

  if (!roles.length) {
    c.addTextDisplayComponents(text('-# No ping roles are set up yet.'));
    return c;
  }

  c.addTextDisplayComponents(text(roles.map((r) => `${r.emoji} **${r.label}**\n-# ${r.description}`).join('\n\n')));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(text('-# You only get pinged for the roles you turn on. You can change them any time.'));

  // max 5 buttons per row
  for (let i = 0; i < roles.length; i += 5) {
    c.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        roles.slice(i, i + 5).map((r) =>
          new ButtonBuilder().setCustomId(`pingrole:${r.key}`).setLabel(r.label).setEmoji(r.emoji).setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }
  return c;
}

// ---------- button ----------
async function handleButton(interaction) {
  const key = interaction.customId.split(':')[1];
  const roles = activeRoles();
  const role = roles.find((r) => r.key === key);
  if (!role) return interaction.reply({ content: 'This role is not available.', flags: EPHEMERAL });

  const member = interaction.member;
  const had = member.roles.cache.has(role.roleId);
  try {
    if (had) await member.roles.remove(role.roleId, 'Turned off ping role');
    else await member.roles.add(role.roleId, 'Turned on ping role');
  } catch (err) {
    console.error('Ping roles: could not change the role:', err.message);
    return interaction.reply({
      content: 'I could not change your role. Please tell the staff (my role must be above the ping roles and I need Manage Roles).',
      flags: EPHEMERAL,
    });
  }

  // Status of all roles after the change
  const on = new Set(roles.filter((r) => member.roles.cache.has(r.roleId)).map((r) => r.key));
  if (had) on.delete(role.key);
  else on.add(role.key);
  const status = roles.map((r) => `${r.label}: ${on.has(r.key) ? 'on' : 'off'}`).join(' · ');

  const title = had ? `You will no longer get ${role.label} pings` : `You will now get ${role.label} pings`;
  return interaction.reply({ content: `### ${title}\n-# ${status}`, flags: EPHEMERAL });
}

module.exports = { buildPanel, handleButton };
