const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../config');

// ===== Edit your rules here. Emojis can be normal or custom: <:name:123456789012345678> =====
const RULES = [
  { emoji: '', title: 'Be respectful', text: 'Treat everyone with respect. No harassment, hate speech, discrimination or threats.' },
  { emoji: '', title: 'No illegal or NSFW content', text: 'Nothing illegal, sexual, graphic or shocking, in chat or on profiles. Zero tolerance for anything involving minors.' },
  { emoji: '', title: 'No spam or advertising', text: 'No spam, mass pings, invite links or promoting other services, including in DMs.' },
  { emoji: '', title: 'No scams or impersonation', text: 'Do not pretend to be staff or the platform. Staff will never ask you to pay in DMs.' },
  { emoji: '', title: 'Protect privacy', text: "Do not share other people's personal information (doxxing) or leak private conversations." },
  { emoji: '', title: 'Keep profiles clean', text: 'No phishing, malware or scam links on your profile. Abusing the platform can get your profile removed.' },
  { emoji: '', title: 'Use channels properly', text: 'Keep topics in the right channel and open a ticket for help instead of pinging staff.' },
  { emoji: '', title: 'Follow the Discord rules', text: "You must follow Discord's Terms of Service and Community Guidelines (13+ only)." },
];

const TAGLINE = 'By staying in this server you agree to follow the rules below. Staff decisions are final.';
const FOOTER = 'Breaking the rules can lead to a warning, mute, kick or ban.';

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function buildRules() {
  const c = new ContainerBuilder();
  const banner = process.env.RULES_BANNER_URL || config.bannerUrl;
  if (banner) {
    c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner)));
  }

  c.addTextDisplayComponents(text(`##  ${config.brandName} Rules\n${TAGLINE}`));
  c.addSeparatorComponents(divider());
  c.addTextDisplayComponents(
    text(RULES.map((r, i) => `${r.emoji} **${i + 1}. ${r.title}**\n-# ${r.text}`).join('\n\n'))
  );
  c.addSeparatorComponents(divider());

  const footer = [`-# ${FOOTER}`];
  if (config.supportChannelId) footer.push(`-# Questions? Ask in <#${config.supportChannelId}>`);
  c.addTextDisplayComponents(text(footer.join('\n')));

  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Discord Terms').setStyle(ButtonStyle.Link).setURL('https://discord.com/terms'),
      new ButtonBuilder().setLabel('Community Guidelines').setStyle(ButtonStyle.Link).setURL('https://discord.com/guidelines')
    )
  );
  return c;
}

// Run /setup-rules in your #rules channel.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-rules')
    .setDescription('Post the server rules in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.channel.send({ components: [buildRules()], flags: MessageFlags.IsComponentsV2 });
    return interaction.reply({ content: 'Rules posted', flags: MessageFlags.Ephemeral });
  },

  buildRules,
};
