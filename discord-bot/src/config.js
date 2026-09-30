// ===== Edit this file to change what /setup-info posts =====
module.exports = {
  brandName: process.env.BRAND_NAME || 'Clwn.wtf', // shown in the title: "YourName Pricing"
  siteUrl: process.env.SITE_URL || 'https://clwn.wtf',

  // Optional wide banner image shown at the top (a direct image link, ~1200x400 works well).
  // Leave empty to post without a banner.
  bannerUrl: process.env.BANNER_URL || '',

  // Optional: ID of your support channel, adds "Questions? Ask in #channel" to the footer.
  supportChannelId: process.env.SUPPORT_CHANNEL_ID || '1554818454534619136',

  // Set to a color like 0xc1121f to show a colored bar on the left of the message.
  accentColor: null,

  // Still used by giveaways and /stats
  brandColor: 0xc1121f,

  tagline:
    'Every tier includes everything from the tier below. Purchases are made only on our website and your role is given automatically.',

  // Emojis can be normal (💎) or custom server emojis like <:name:123456789012345678>
  plans: [
    {
      name: 'Plus',
      emoji: '',
      price: '3.99€',
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
      emoji: '',
      price: '6.99€',
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
      emoji: '',
      price: '9.99€',
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

  // Optional "Extras" section (leave the list empty to hide it). Example:
  // { emoji: '🏷️', name: 'Extra alias', price: 'X € one time', description: 'A second name, like yoursite.com/nickname' }
  extras: [],

  footer: 'Buy only on our website · Staff will never ask you to pay in DMs',
};
