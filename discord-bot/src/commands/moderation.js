const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const ephemeral = MessageFlags.Ephemeral;

const ban = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({ content: "I can't ban this user (their role is higher than mine).", flags: ephemeral });
    }
    await interaction.guild.members.ban(user, { reason: `${interaction.user.tag}: ${reason}` });
    return interaction.reply(`🔨 **${user.tag}** was banned. Reason: ${reason}`);
  },
};

const kick = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user')
    .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in the server.', flags: ephemeral });
    if (!member.kickable) {
      return interaction.reply({ content: "I can't kick this user (their role is higher than mine).", flags: ephemeral });
    }
    await member.kick(`${interaction.user.tag}: ${reason}`);
    return interaction.reply(`👢 **${user.tag}** was kicked. Reason: ${reason}`);
  },
};

const timeout = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mute a user for a while')
    .addUserOption((o) => o.setName('user').setDescription('User to mute').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('minutes').setDescription('Duration in minutes (max 40320 = 28 days)').setMinValue(1).setMaxValue(40320).setRequired(true)
    )
    .addStringOption((o) => o.setName('reason').setDescription('Reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in the server.', flags: ephemeral });
    if (!member.moderatable) {
      return interaction.reply({ content: "I can't timeout this user (their role is higher than mine).", flags: ephemeral });
    }
    await member.timeout(minutes * 60 * 1000, `${interaction.user.tag}: ${reason}`);
    return interaction.reply(`🔇 **${user.tag}** was muted for ${minutes} min. Reason: ${reason}`);
  },
};

const untimeout = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a mute from a user')
    .addUserOption((o) => o.setName('user').setDescription('User to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in the server.', flags: ephemeral });
    await member.timeout(null, `Unmuted by ${interaction.user.tag}`);
    return interaction.reply(`🔊 **${user.tag}** was unmuted.`);
  },
};

const clear = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How many messages (1-100)').setMinValue(1).setMaxValue(100).setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const deleted = await interaction.channel.bulkDelete(amount, true); // skips messages older than 14 days
    return interaction.reply({ content: `🧹 Deleted ${deleted.size} messages.`, flags: ephemeral });
  },
};

module.exports = [ban, kick, timeout, untimeout, clear];
