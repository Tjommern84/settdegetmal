import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { BrregEnhet } from './types';

const BRREG_BULK_URL = 'https://data.brreg.no/enhetsregisteret/api/enheter/lastned';
const DOWNLOAD_DIR = join(process.cwd(), 'data', 'brreg');

export type DownloadProgress = {
  totalBytes: number;
  downloadedBytes: number;
  percentage: number;
};

export class BrregDownloader {
  private onProgress?: (progress: DownloadProgress) => void;

  constructor(options?: { onProgress?: (progress: DownloadProgress) => void }) {
    this.onProgress = options?.onProgress;
  }

  /**
   * Download the bulk file from Brønnøysundregisteret
   * Returns path to the downloaded file
   */
  async downloadBulkFile(): Promise<string> {
    await mkdir(DOWNLOAD_DIR, { recursive: true });

    const timestamp = new Date().toISOString().split('T')[0];
    const outputPath = join(DOWNLOAD_DIR, `enheter-${timestamp}.json`);

    console.log(`Downloading bulk file from ${BRREG_BULK_URL}...`);

    const response = await fetch(BRREG_BULK_URL);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;

    const body = response.body;
    if (!body) {
      throw new Error('Response body is null');
    }

    // Pipeline: fetch → gunzip → file
    const { Readable } = await import('stream');
    const fileStream = createWriteStream(outputPath);
    const gunzip = createGunzip();

    // Convert Web Stream to Node stream
    const nodeStream = Readable.fromWeb(body as any);

    // Track progress
    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (this.onProgress && totalBytes > 0) {
        this.onProgress({
          totalBytes,
          downloadedBytes,
          percentage: Math.round((downloadedBytes / totalBytes) * 100),
        });
      }
    });

    await pipeline(nodeStream, gunzip, fileStream);

    console.log(`✓ Downloaded to ${outputPath}`);
    return outputPath;
  }

  /**
   * Parse JSON file (streaming)
   * The bulk file is a JSON array with pretty-printed objects
   */
  async *parseJsonLines(filePath: string): AsyncGenerator<BrregEnhet> {
    const { createReadStream } = await import('fs');
    const StreamArray = (await import('stream-json/streamers/StreamArray.js')).default;

    const stream = createReadStream(filePath).pipe(StreamArray.withParser());

    let count = 0;
    for await (const { value } of stream) {
      count++;
      try {
        yield value as BrregEnhet;
      } catch (error) {
        console.warn(`Failed to parse entity ${count}: ${error}`);
        continue;
      }
    }
  }
}

/**
 * Helper to format bytes
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
