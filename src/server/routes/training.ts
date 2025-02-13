import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { LoraStatus, TrainStatus, Prisma } from '@prisma/client';
import { trainingService } from '../../services/training.js';
import { StorageService } from '../../services/storage.js';
import { createTrainingArchive, type TrainingFile } from '../../lib/zip.js';
import type { MultipartFile } from '@fastify/multipart';