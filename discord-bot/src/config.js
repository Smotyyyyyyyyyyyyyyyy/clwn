// ===== Edit this file to change what /setup-info posts =====
module.exports = {
  brandName: process.env.BRAND_NAME || 'Information', // shown in the title: "YourName Pricing"
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

  // ===== Ticket system (/setup-tickets) =====
  tickets: {
    // Role that gets pinged and can claim/close tickets (right click role > Copy Role ID)
    staffRoleId: process.env.STAFF_ROLE_ID || '',
    // Optional channel where a transcript (.txt) is posted when a ticket is closed
    logChannelId: process.env.TICKET_LOG_CHANNEL_ID || '',
    panelText: 'Need help? Pick a category below and a private ticket will be opened just for you.',
    // Max 5 categories. Each one becomes a button on the panel and a form (max 5 fields, label max 45 chars).
    categories: [
      {
        key: 'purchases',
        emoji: '🛍️',
        name: 'Purchases',
        description: 'Payments, refunds, gifts or giveaways',
        fields: [
          { id: 'username', label: 'Your username on the site', style: 'short', placeholder: 'e.g. john' },
          { id: 'order', label: 'Order ID or receipt email', style: 'short', placeholder: 'From your receipt' },
          { id: 'issue', label: 'What happened?', style: 'paragraph', placeholder: 'Tell us what went wrong' },
        ],
      },
      {
        key: 'support',
        emoji: '🛠️',
        name: 'Support',
        description: 'Help with your profile, domains or settings',
        fields: [
          { id: 'username', label: 'Your username on the site', style: 'short', required: false },
          { id: 'issue', label: 'How can we help?', style: 'paragraph' },
        ],
      },
      {
        key: 'bug',
        emoji: '🐛',
        name: 'Bug report',
        description: 'Something is broken on the site',
        fields: [
          { id: 'issue', label: 'What happened?', style: 'paragraph' },
          { id: 'steps', label: 'How can we reproduce it?', style: 'paragraph', required: false },
        ],
      },
    ],
  },
};
