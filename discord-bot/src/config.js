// Edit prices and perks here. The /setup-info command posts them in a channel.
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://your-site.com',
  brandColor: 0xc1121f,
  plans: [
    {
      name: 'Plus',
      emoji: '🔹',
      color: 0x8fd3ff,
      price: 'X €/month',
      platform: [
        'Plus badge on your profile',
        'Hide the watermark',
        'More links and uploads',
        'Premium effects and fonts',
      ],
      discord: ['Plus role', 'Access to #vip-chat'],
    },
    {
      name: 'Pro',
      emoji: '🔷',
      color: 0x3fa7ff,
      price: 'Y €/month',
      platform: [
        'Everything in Plus',
        'Premium domains of your choice',
        'Extra alias',
        'Detailed analytics',
        'Animated / video background',
      ],
      discord: ['Pro role', '#pro-lounge and #early-access', 'VIP giveaways and polls'],
    },
    {
      name: 'Ultra',
      emoji: '🔵',
      color: 0x1f6feb,
      price: 'Z €/month',
      platform: [
        'Everything in Pro',
        'All available domains',
        'Unique animated badge',
        'Priority on rare usernames',
        'Featured profile on the site',
        'Beta access to new features',
      ],
      discord: ['Ultra role with custom name and color', 'Private channel with the team', 'Priority support'],
    },
  ],
};
