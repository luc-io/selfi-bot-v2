# Known Issues and Solutions

## Multi-Image Generation Loop (Fixed)

### Issue Description
When generating multiple images (especially with num_images=4), the bot would enter an infinite loop, continuously generating new images.

### Root Cause
The issue was caused by Telegram's media group handling:
1. When sending multiple images, Telegram sends multiple updates
2. Each update was triggering the command handler again
3. With 4 images (maximum), this created a loop because:
   - Send 4 images → Receive 4 updates
   - Each update triggered new generation
   - Each generation produced 4 more images
   - Loop continued indefinitely

### Solution
Fixed in PR #11 with several key changes:

1. Added per-chat command tracking:
```typescript
const lastProcessed = new Map<number, { msgId: number; timestamp: number }>();
```

2. Implemented multiple validation checks:
   - Check for exact duplicate messages (same ID)
   - Check for commands too close together (within 5 seconds)
   - Auto-cleanup of tracking data after 60 seconds

3. Added unique processing keys:
```typescript
const processingKey = `${chatId}:${messageId}:${Date.now()}`;
```

4. Added response validation and better error handling:
```typescript
if (last) {
  if (messageId === last.msgId) {
    logger.info("Skipping duplicate command");
    return;
  }
  if (now - last.timestamp < 5000) {
    logger.info("Command too soon after last one");
    return;
  }
}
```

### Prevention
The fix prevents duplicate processing by:
1. Tracking the last command processed per chat
2. Adding a cooldown period between commands
3. Using unique timestamps to differentiate between real commands and Telegram's update events
4. Maintaining a processing cache that auto-cleans

### Testing
To verify the fix:
1. Set num_images to 4 (maximum)
2. Send a generation command
3. Verify that only one set of images is generated
4. Check logs for "Skipping duplicate command" messages

## Other Notable Issues

### FAL API Balance Exhaustion
When the FAL API balance is exhausted, the bot now shows a user-friendly error message:
```typescript
if (apiError.status === 403 && apiError.body?.detail?.includes('Exhausted balance')) {
  await ctx.reply('⚠️ The service is temporarily unavailable. Please try again later or contact @lvc_io');
  return;
}
```