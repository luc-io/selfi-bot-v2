# Selfi Bot V2

Telegram bot and API for generating images with Flux and training LoRA models.

## Features

- Image generation with Flux
- LoRA model training
- Telegram bot commands
- REST API for mini app
- Star system for payments
- Image storage with DO Spaces

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Digital Ocean Spaces account
- Telegram bot token
- FAL AI account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/luc-io/selfi-bot-v2.git
cd selfi-bot-v2
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment file:
```bash
cp .env.example .env
```

4. Configure environment variables:
```env
# Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_PAYMENT_TOKEN=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/selfi_bot

# Storage
SPACES_BUCKET=
SPACES_ENDPOINT=
SPACES_KEY=
SPACES_SECRET=

# FAL
FAL_KEY=
FAL_KEY_SECRET=
```

5. Initialize database:
```bash
pnpm prisma generate
pnpm prisma db push
```

### Development

Start the bot in development mode:
```bash
pnpm dev
```

### Production

Build and start:
```bash
pnpm build
pnpm start
```

## Bot Commands

- `/start` - Start bot and create user
- `/gen` - Generate an image with optional LoRA
- `/balance` - Check stars balance

## API Endpoints

### Authentication
All API requests require `x-user-id` header with Telegram user ID.

### Generation
- `POST /generate` - Generate image
- `GET /generations` - List user's generations

### Models
- `GET /models/public` - List public LoRA models
- `GET /models/me` - List user's models

### Training
- `POST /training/start` - Start LoRA training
- `GET /training/:modelId/status` - Get training status

## Project Structure

```
.
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── bot/              # Bot command handlers
│   ├── server/           # API routes
│   ├── services/         # Business logic
│   ├── lib/             # Shared utilities
│   └── types/           # TypeScript types
└── scripts/             # Utility scripts
```

## Testing

Run tests:
```bash
pnpm test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT