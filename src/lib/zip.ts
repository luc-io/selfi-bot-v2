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

/**
 * Creates a zip archive for training with fal.ai
 * Each image will be added along with its caption in a .txt file
 */
export async function createTrainingArchive(params: CreateArchiveParams): Promise<Buffer> {
  try {
    const zip = new JSZip();
    
    // Add each file and its caption
    for (const file of params.files) {
      // Get base filename without extension
      const baseName = file.filename.replace(/\.[^/.]+$/, '');
      
      // Add image file
      zip.file(file.filename, file.buffer);
      
      // Get caption for this file
      const caption = params.captions[file.filename] || '';
      
      // Add caption file if we have one
      if (caption) {
        zip.file(`${baseName}.txt`, caption);
      }

      logger.info({
        filename: file.filename,
        hasCaption: !!caption
      }, 'Added file to training archive');
    }

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6 // Balanced compression
      }
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