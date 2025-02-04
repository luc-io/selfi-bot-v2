# Debugging Guide

## Log Messages

The bot uses structured logging. Important log messages to watch for:

### Generation Command Flow
```typescript
// Start of command
{ msg: "Starting generation command", messageId, chatId, command }

// Generation completed
{ msg: "Generation command completed successfully", messageId, chatId, imagesCount }

// Duplicate prevention
{ msg: "Skipping duplicate command", chatId, messageId, lastMsgId, timeDiff }

// Command rate limiting
{ msg: "Command too soon after last one", chatId, messageId, lastMsgId, timeDiff }
```

### Parameters
```typescript
// When parameters are saved
{ msg: "Parameters saved successfully", telegramId, params }

// Full generation parameters
"Generation params: { ... }"

// FAL API request
"FAL request params: { ... }"

// FAL API response
"FAL raw response: { ... }"
```

## Common Issues

### Multiple Generation Issue
If the bot starts generating images in a loop:
1. Check the message IDs in logs
2. Look for "Skipping duplicate command" messages
3. Verify the timeDiff values
4. Check if lastProcessed map is being cleaned properly

### Telegram Media Group Issues
When sending multiple images:
1. Telegram splits them into multiple updates
2. Each update has the same message_id
3. Our command handler uses `${chatId}:${messageId}:${Date.now()}` to differentiate them
4. Look for "lastMsgId" in logs to track message processing

### FAL API Issues
Common FAL API errors and their meanings:
- 403 with "Exhausted balance": Need to top up API credits
- 400 with "Invalid prompt": The prompt contains forbidden content
- 500 with any message: FAL API internal error, usually temporary

## Debugging Strategy

1. Enable detailed logging:
```typescript
logger.info({
  messageId,
  chatId,
  command: ctx.message.text
}, "Starting generation command");
```

2. Track message flow:
- Command received → Parameters loaded → Generation started → Images received → Images sent

3. Monitor duplicates:
- Check time between commands
- Verify message IDs
- Look for skipped commands in logs

4. Check error handling:
- All errors should be logged
- User should receive friendly error messages
- Error details should be preserved in logs