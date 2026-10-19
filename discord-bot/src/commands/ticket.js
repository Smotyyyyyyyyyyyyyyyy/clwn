const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getTicket, isStaff } = require('../tickets');

const reply = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

// /ticket add and /ticket remove: used by staff inside a ticket
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket tools for staff')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add someone to this ticket')
        .addUserOption((o) => o.setName('user').setDescription('Who to add').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove someone from this ticket')
        .addUserOption((o) => o.setName('user').setDescription('Who to remove').setRequired(true))
    )
    .setDMPermission(false),

  async execute(interaction) {
    const t = getTicket(interaction.channelId);
    if (!t || t.status !== 'open') return reply(interaction, 'Use this command inside an open ticket.');
    if (!isStaff(interaction.member)) return reply(interaction, 'Only staff can use this command.');

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    if (user.id === interaction.client.user.id) return reply(interaction, 'I am already part of every ticket.');

    try {
      if (sub === 'add') {
        await interaction.channel.members.add(user.id);
        return interaction.reply({
          content: `<:approuved_clwn:1558577655723593748> ${user} was added to this ticket by ${interaction.user}.`,
          allowedMentions: { users: [user.id] },
        });
      }

      if (user.id === t.userId) return reply(interaction, 'You cannot remove the person who opened the ticket.');
      await interaction.channel.members.remove(user.id);
      return interaction.reply({
        content: `<:rejected_clwn:1558577590569017454> ${user} was removed from this ticket by ${interaction.user}.`,
        allowedMentions: { parse: [] },
      });
    } catch (err) {
      console.error('Ticket add/remove failed:', err.message);
      return reply(interaction, 'I could not do that. Check that I have the Manage Threads permission.');
    }
  },
};
