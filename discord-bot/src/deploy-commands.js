require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./loadCommands');

async function registerCommands() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error('Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID');
  }
  const body = loadCommands().map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log(`Registered ${body.length} slash commands.`);
}

module.exports = { registerCommands };

// "npm run deploy" still works if you want to register commands manually
if (require.main === module) {
  registerCommands().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
