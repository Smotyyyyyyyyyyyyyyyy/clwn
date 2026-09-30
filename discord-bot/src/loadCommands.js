const fs = require('fs');
const path = require('path');

// Reads every file in src/commands. A file can export one command or an array of commands.
function loadCommands() {
  const dir = path.join(__dirname, 'commands');
  const commands = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const exported = require(path.join(dir, file));
    for (const cmd of Array.isArray(exported) ? exported : [exported]) {
      if (cmd && cmd.data && cmd.execute) commands.push(cmd);
    }
  }
  return commands;
}

module.exports = { loadCommands };
