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

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

// "-# " makes Discord show a line as small grey text
const small = (lines) => lines.map((l) => `-# ${l}`).join('\n');

function buildPricingContainer() {
  const container = new ContainerBuilder();
  if (config.accentColor) container.setAccentColor(config.accentColor);

  // 1) Banner (optional)
  if (config.bannerUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.bannerUrl))
    );
  }

  // 2) Title + tagline
  container.addTextDisplayComponents(text(`## ${config.brandName} Pricing\n${config.tagline}`));
  container.addSeparatorComponents(divider());

  // 3) Plans
  const plans = config.plans
    .map((p) => `${p.emoji} **${p.name}** · ${p.price}\n${small([...p.platform, ...p.discord])}`)
    .join('\n\n');
  container.addTextDisplayComponents(text(plans));

  // 4) Extras (optional)
  if (config.extras.length) {
    container.addSeparatorComponents(divider());
    const extras = config.extras
      .map((e) => `${e.emoji} **${e.name}** · ${e.price}\n${small([e.description])}`)
      .join('\n\n');
    container.addTextDisplayComponents(text(`### Extras\n${extras}`));
  }

  // 5) Footer + button
  container.addSeparatorComponents(divider());
  const footerLines = [config.footer];
  if (config.supportChannelId) footerLines.push(`Questions? Ask in <#${config.supportChannelId}>`);
  container.addTextDisplayComponents(text(small(footerLines)));

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Go to site').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(config.siteUrl)
    )
  );

  return container;
}

// Run /setup-info inside your "information" channel.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-info')
    .setDescription('Post the VIP pricing message with the "Go to site" button in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.channel.send({
      components: [buildPricingContainer()],
      flags: MessageFlags.IsComponentsV2,
    });
    return interaction.reply({ content: 'Posted ✅', flags: MessageFlags.Ephemeral });
  },

  buildPricingContainer, // exported for testing
};
