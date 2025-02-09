export const config = {
  // Admin configuration
  adminUserId: '2061615306',

  // Environment & App Config
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '3000',
  PUBLIC_URL: process.env.PUBLIC_URL || 'https://selfi-dev.blackiris.art',
  MINIAPP_URL: process.env.MINIAPP_URL || 'https://mini.selfi.blackiris.art',

  // Bot Configuration
  TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN!,

  // Legacy config structure (keeping for compatibility)
  bot: {
    token: process.env.BOT_TOKEN!,
    webhookUrl: process.env.BOT_WEBHOOK_URL,
    webhookPath: process.env.BOT_WEBHOOK_PATH,
  },

  // Third Party Services
  fal: {
    key: process.env.FAL_KEY!,
  },

  // Storage Configuration
  spaces: {
    key: process.env.SPACES_KEY!,
    secret: process.env.SPACES_SECRET!,
    bucket: process.env.SPACES_BUCKET!,
    endpoint: process.env.SPACES_ENDPOINT!,
  },
};