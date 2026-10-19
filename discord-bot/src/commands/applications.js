const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const applications = require('../applications');
const { syncMessages } = require('../sync');

// /applications open and /applications close: no need to edit code or restart the bot
module.exports = {
  data: new SlashCommandBuilder()
    .setName('applications')
    .setDescription('Open or close the staff applications')
    .addSubcommand((s) => s.setName('open').setDescription('Allow new staff applications'))
    .addSubcommand((s) =>
      s.setName('close').setDescription('Stop new staff applications (open ones can still be reviewed)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    const open = interaction.options.getSubcommand() === 'open';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    applications.setOpen(open);
    // Edit the panel in the applications channel right away
    await syncMessages(interaction.client).catch(console.error);

    return interaction.editReply(
      open
        ? 'Staff applications are now open. The panel was updated.'
        : 'Staff applications are now closed. The panel was updated. Applications that are already open can still be reviewed.'
    );
  },
};
