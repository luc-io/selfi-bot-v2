import JSZip from 'jszip';
import { logger } from './logger.js';

export interface TrainingFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface CreateArchiveParams {
  files: TrainingFile[];
  captions: Record<string, string>;
}

const COMPRESSION_LEVEL = 3; // Lower compression to save memory
const MAX_FILES_PER_BATCH = 5; // Process files in batches

/**
 * Creates a zip archive for training with fal.ai
 * Each image will be added along with its caption in a .txt file
 * Optimized for memory usage by processing files in batches
 */
export async function createTrainingArchive(params: CreateArchiveParams): Promise<Buffer> {
  try {
    const zip = new JSZip();
    
    // Process files in batches to avoid memory issues
    for (let i = 0; i < params.files.length; i += MAX_FILES_PER_BATCH) {
      const batch = params.files.slice(i, i + MAX_FILES_PER_BATCH);
      
      // Add each file in the batch
      for (const file of batch) {
        // Get base filename without extension
        const baseName = file.filename.replace(/\.[^/.]+$/, '');
        
        // Add image file with compression
        zip.file(file.filename, file.buffer, {
          compression: 'DEFLATE',
          compressionOptions: {
            level: COMPRESSION_LEVEL
          }
        });
        
        // Get caption for this file
        const caption = params.captions[file.filename] || '';
        
        // Add caption file if we have one
        if (caption) {
          zip.file(`${baseName}.txt`, caption);
        }

        // Clear file buffer reference to help GC
        file.buffer = Buffer.alloc(0);

        logger.info({
          filename: file.filename,
          hasCaption: !!caption,
          batchIndex: Math.floor(i / MAX_FILES_PER_BATCH)
        }, 'Added file to training archive');
      }

      // Force garbage collection between batches
      if (global.gc) {
        global.gc();
      }
    }

    // Generate zip buffer with streaming
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: COMPRESSION_LEVEL
      },
      streamFiles: true
    });

    logger.info({
      fileCount: params.files.length,
      zipSize: zipBuffer.length
    }, 'Created training archive');

    return zipBuffer;
  } catch (error) {
    logger.error({ error }, 'Failed to create training archive');
    throw error;
  }
}