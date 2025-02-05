# Training Integration Implementation Guide

## Current Status

We've implemented the backend training endpoint `/training/start` which accepts:
```json
{
  "steps": 1000,
  "is_style": false,
  "create_masks": true,
  "trigger_word": "TOK",
  "images_data_url": "URL_TO_ZIP_FILE"
}
```

## Issues to Fix

1. **413 Request Entity Too Large Error**
   - Problem: Nginx is limiting request size
   - Solution: Add to nginx config:
     ```nginx
     client_max_body_size 10M;  # Adjust size as needed
     ```

2. **Miniapp Update Required**
   - Repository: `luc-io/selfi-miniapp-v2`
   - Branch: `feature/fal-ai-training`
   - Changes needed:
     - Update training submission to use JSON instead of FormData
     - Update image upload flow to handle zip files
     - Add proper error handling

## Implementation Steps

1. **Update Nginx Configuration**
   - [ ] Add body size limit configuration
   - [ ] Reload Nginx

2. **Update Miniapp Code**
   - [ ] Locate training submission code
   - [ ] Update request format:
     ```typescript
     const trainingData = {
       steps: 1000,
       is_style: false,
       create_masks: true,
       trigger_word: name,
       images_data_url: zipUrl // URL to the uploaded zip
     };

     const response = await fetch('/training/start', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'x-telegram-user-id': userId
       },
       body: JSON.stringify(trainingData)
     });
     ```

3. **Testing Required**
   - [ ] Test image upload
   - [ ] Test training request
   - [ ] Verify training status updates
   - [ ] Test error handling

## API Reference

### Training Start Endpoint

- **URL**: `/training/start`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `x-telegram-user-id: string`
- **Body**:
  ```typescript
  interface TrainingStartRequest {
    steps: number;
    is_style: boolean;
    create_masks: boolean;
    trigger_word: string;
    images_data_url: string;
  }
  ```
- **Response**:
  ```typescript
  interface TrainingResponse {
    id: string;       // LoRA model ID
    trainingId: string;
  }
  ```

### Training Status Endpoint

- **URL**: `/training/:id/status`
- **Method**: `GET`
- **Response**:
  ```typescript
  interface TrainingStatus {
    status: 'PENDING' | 'TRAINING' | 'COMPLETED' | 'FAILED';
    metadata?: any;
    error?: string;
    completedAt?: string;
  }
  ```

## Next Steps

1. Get access to `selfi-miniapp-v2` repository
2. Locate and update the training submission code
3. Update Nginx configuration
4. Test the complete training flow

## Configuration Reference

### Backend Environment Variables
```env
PORT=3001
PUBLIC_URL=https://selfi-dev.blackiris.art
TELEGRAM_BOT_TOKEN=your_bot_token
```

### Database Schema Used
```typescript
model Training {
  databaseId      String       @id @default(cuid())
  loraId          String       @unique
  lora            LoraModel    @relation(fields: [loraId], references: [databaseId])
  baseModelId     String
  baseModel       BaseModel    @relation(fields: [baseModelId], references: [databaseId])
  userDatabaseId  String
  user            User         @relation(fields: [userDatabaseId], references: [databaseId])
  imageUrls       String[]
  instancePrompt  String
  classPrompt     String?
  steps           Int          @default(100)
  learningRate    Float        @default(0.0001)
  starsSpent      Int
  status          TrainStatus  @default(PENDING)
  error           String?
  startedAt       DateTime     @default(now())
  completedAt     DateTime?
  metadata        Json?
}
```