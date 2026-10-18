// ===== Edit this file to change what /setup-info posts =====

// Accepts only full http(s) links. Anything else is ignored (with a warning) instead of crashing the message.
function cleanUrl(name) {
  const raw = (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || u.protocol === 'http:') return raw;
  } catch {}
  console.warn(`[config] ${name} is not a valid link (it must start with https://), ignoring it`);
  return '';
}

module.exports = {
  brandName: 'clwn.wtf', // shown in the titles: "clwn.wtf Pricing", "clwn.wtf Rules", "clwn.wtf Support"
  siteUrl: 'https://clwn.wtf', // fixed on purpose, the SITE_URL variable on the bot is not used anymore

  // Optional wide banner image shown at the top (a direct image link, ~1200x400 works well).
  // Leave empty to post without a banner.
  bannerUrl: cleanUrl('BANNER_URL') || '',

  // Optional: ID of your support channel, adds "Questions? Ask in #channel" to the footer.
  supportChannelId: process.env.SUPPORT_CHANNEL_ID || '1554818454534619136',

  // Set to a color like 0xc1121f to show a colored bar on the left of the message.
  accentColor: null,

  // Still used by giveaways and /stats
  brandColor: 0xc1121f,

  tagline:
    'Pick what you need. Purchases are made only on our website and your Discord role is given automatically.',

  // Emojis can be normal (💎) or custom server emojis like <:name:123456789012345678>
  plans: [
    {
      name: 'Premium',
      emoji: '<:premium_clwn:1558580511952085113>',
      price: '$4.99',
      platform: [
        'Everything in Free',
        'Premium fonts and cursor effects',
        'Your own domain on your profile',
        'Referral link to invite friends',
        'Detailed profile analytics',
        'Up to 3 custom badges',
      ],
      discord: ['Premium role', 'Priority support'],
    },
    {
      name: 'Verified Badge',
      emoji: '<:verified_clwn:1558578058296955051>',
      price: '$7.99',
      platform: ['Verified badge next to your name', 'Shows visitors that your profile is trusted', 'Increased credibility'],
      discord: ['Verified badge role'],
    },
    {
      name: 'Media Host',
      emoji: '<:member_clwn:1558562596288729129>',
      price: '$4.99',
      platform: [
        'Upload images and files and share them from your own link',
        'Up to 25 MB per file',
        '5 GB of storage',
        'Media Host badge',
      ],
    },
    {
      name: 'Extra Alias',
      emoji: '<:alias_clwn:1558580636107677696>',
      price: '$0.99',
      platform: ['A second username that opens the same profile'],
      discord: [],
    },
  ],

  // Optional "Extras" section (leave the list empty to hide it). Example:
  // { emoji: '🏷️', name: 'Extra alias', price: 'X € one time', description: 'A second name, like yoursite.com/nickname' }
  extras: [],

  footer: 'Buy only on our website · Staff will never ask you to pay in DMs',

  // ===== Ticket system (/setup-tickets) =====
  tickets: {
    // Role that gets pinged and can claim/close tickets (right click role > Copy Role ID)
    staffRoleId: process.env.STAFF_ROLE_ID || '1558569041373700126',
    // Optional channel where a transcript (.txt) is posted when a ticket is closed
    logChannelId: process.env.TICKET_LOG_CHANNEL_ID || '1558568949761704007',
    panelText: 'Need help? Pick a category below and a private ticket will be opened just for you.',
    // Max 5 categories. Each one becomes a button on the panel and a form (max 5 fields, label max 45 chars).
    categories: [
      {
        key: 'purchases',
        emoji: '<:purchase_clwn:1558564715091722241>',
        name: 'Purchases',
        description: 'Problems with a payment, gifts or giveaways',
        fields: [
          { id: 'username', label: 'Your username on the site', style: 'short', placeholder: 'e.g. john' },
          { id: 'order', label: 'Order ID or receipt email', style: 'short', placeholder: 'From your receipt' },
          { id: 'issue', label: 'What happened?', style: 'paragraph', placeholder: 'Tell us what went wrong' },
        ],
      },
      {
        key: 'support',
        emoji: '<:support_clwn:1558568751656607904>',
        name: 'Support',
        description: 'Help with your profile and account or staff applications',
        fields: [
          { id: 'username', label: 'Your username on the site', style: 'short', required: false },
          { id: 'issue', label: 'How can we help?', style: 'paragraph' },
        ],
      },
      {
        key: 'bug',
        emoji: '<:bug_clwn:1558568167209566298>',
        name: 'Bug report',
        description: 'Something does not work on the website or discord server',
        fields: [
          { id: 'issue', label: 'What happened?', style: 'paragraph' },
          { id: 'steps', label: 'How can we reproduce it?', style: 'paragraph', required: false },
        ],
      },
    ],
  },
};
