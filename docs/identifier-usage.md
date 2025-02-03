# Identifier Usage in Selfi Bot

This document outlines the conventions for handling different types of identifiers in the Selfi Bot codebase.

## Types of Identifiers

### Telegram ID (`telegramId`)
- The external identifier provided by Telegram
- Always stored as a string type
- Used when interacting with Telegram's API
- Always named `telegramId` in code and logs
- Example: "2061615306"

### Database ID (`databaseId`)
- Internal unique identifier used for database relationships
- Generated using CUID for uniqueness
- Used for foreign key relationships between tables
- Always named `databaseId` in code and logs
- Example: "cm6nyy1qr000016bts9zay1pd"

## Usage Guidelines

### In Code
```typescript
// Correct usage:
const user = await prisma.user.findUnique({
  where: { telegramId: ctx.from.id.toString() }
});

// For database relationships:
const userModels = await prisma.loraModel.findMany({
  where: { userDatabaseId: user.databaseId }
});
```

### In Logging
When logging user-related information:
```typescript
logger.info({
  telegramId: user.telegramId,  // External ID
  databaseId: user.databaseId,  // Internal ID
  action: 'purchase_stars'
}, 'User purchased stars');
```

### In Database Queries
- Use `telegramId` when looking up users from external sources
- Use `databaseId` for all internal relationships and joins

## Common Pitfalls

1. **Don't mix identifiers**
   ```typescript
   // WRONG:
   const userId = ctx.from.id;  // Unclear which ID type this is
   
   // CORRECT:
   const telegramId = ctx.from.id.toString();
   ```

2. **Always convert Telegram IDs to strings**
   ```typescript
   // WRONG:
   const telegramId = ctx.from.id;  // Might be a number
   
   // CORRECT:
   const telegramId = ctx.from.id.toString();
   ```

3. **Be explicit in function parameters**
   ```typescript
   // WRONG:
   async function getUserStars(id: string)
   
   // CORRECT:
   async function getUserStarsByTelegramId(telegramId: string)
   // or
   async function getUserStarsByDatabaseId(databaseId: string)
   ```