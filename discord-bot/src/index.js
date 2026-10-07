require('dotenv').config();
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const { loadCommands } = require('./loadCommands');
const { handleAutomod } = require('./automod');
const { handleGiveawayButton, restoreGiveaways } = require('./giveaways');
const { startApi } = require('./api');
const tickets = require('./tickets');
const { registerCommands } = require('./deploy-commands');

if (!process.env.DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // needed to read message text for automod
  ],
});

client.commands = new Collection();
for (const cmd of loadCommands()) client.commands.set(cmd.data.name, cmd);

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  registerCommands().catch((err) => console.error('Command registration failed:', err.message));
  restoreGiveaways(client);
  startApi(client);
});

client.on(Events.MessageCreate, (message) => {
  handleAutomod(message).catch(console.error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) await cmd.execute(interaction);
    } else if (interaction.isButton()) {
      if (interaction.customId === 'giveaway_enter') await handleGiveawayButton(interaction);
      else if (interaction.customId.startsWith('ticket_')) await tickets.handleButton(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal:')) {
      await tickets.handleModal(interaction);
    }
  } catch (err) {
    console.error(err);
    const payload = { content: 'Something went wrong.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
