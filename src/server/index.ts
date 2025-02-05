import { Bot } from 'grammy';
import { Update } from '@grammyjs/types';

// ... rest of your server setup code ...

app.post('/webhook', async (request, reply) => {
  const update = request.body as Update;
  try {
    await bot.handleUpdate(update);
    return reply.status(200).send();
  } catch (error) {
    console.error('Error handling update:', error);
    return reply.status(500).send();
  }
});

// ... rest of your server code ...