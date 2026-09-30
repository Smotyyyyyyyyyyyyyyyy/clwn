const crypto = require('crypto');
const express = require('express');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Your website calls this after a successful payment (or when a plan expires):
//   POST /vip   headers: x-api-secret: <API_SECRET>
//   body: { "discordId": "123456789012345678", "plan": "plus" | "pro" | "ultra" | "none" }
function startApi(client) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  const roles = {
    plus: process.env.ROLE_PLUS_ID,
    pro: process.env.ROLE_PRO_ID,
    ultra: process.env.ROLE_ULTRA_ID,
  };

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.post('/vip', async (req, res) => {
    const secret = process.env.API_SECRET;
    if (!secret || !safeEqual(req.get('x-api-secret') || '', secret)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { discordId, plan } = req.body || {};
    if (!/^\d{17,20}$/.test(String(discordId || ''))) {
      return res.status(400).json({ error: 'invalid discordId' });
    }
    if (!['plus', 'pro', 'ultra', 'none'].includes(plan)) {
      return res.status(400).json({ error: 'invalid plan' });
    }

    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const member = await guild.members.fetch(discordId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'user is not in the server' });

      const allTierRoles = Object.values(roles).filter(Boolean);
      const toRemove = allTierRoles.filter((id) => id !== roles[plan] && member.roles.cache.has(id));
      if (toRemove.length) await member.roles.remove(toRemove, 'VIP plan changed');
      if (plan !== 'none' && roles[plan]) await member.roles.add(roles[plan], `VIP plan: ${plan}`);

      return res.json({ ok: true, plan });
    } catch (err) {
      console.error('VIP endpoint error:', err);
      return res.status(500).json({ error: 'internal error' });
    }
  });

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`API listening on port ${port}`));
}

module.exports = { startApi };
