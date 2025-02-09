export const config = {
  adminUserId: '2061615306',
  bot: {
    token: process.env.BOT_TOKEN!,
    webhookUrl: process.env.BOT_WEBHOOK_URL,
    webhookPath: process.env.BOT_WEBHOOK_PATH,
  },
  fal: {
    key: process.env.FAL_KEY!,
  },
  spaces: {
    key: process.env.SPACES_KEY!,
    secret: process.env.SPACES_SECRET!,
    bucket: process.env.SPACES_BUCKET!,
    endpoint: process.env.SPACES_ENDPOINT!,
  },
};