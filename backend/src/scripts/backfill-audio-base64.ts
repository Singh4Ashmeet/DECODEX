import dotenv from 'dotenv';
dotenv.config();

import { query, pool } from '../db';
import { getAudioStorage, generateStorageKey, isBase64DataUri } from '../services/audioStorage';

interface SessionRow {
  id: string;
  student_id: string;
  audio_base64: string;
  audio_file_path: string | null;
  audio_mime_type: string | null;
}

const run = async () => {
  console.log('Starting audio_base64 backfill to object storage...');

  try {
    // Select all reading_sessions rows where audio_base64 IS NOT NULL AND audio_storage_key IS NULL
    const result = await query(
      `SELECT id, student_id, audio_base64, audio_file_path, audio_mime_type
       FROM reading_sessions
       WHERE audio_base64 IS NOT NULL
         AND audio_storage_key IS NULL`
    );

    const rows = result.rows as SessionRow[];
    console.log(`Found ${rows.length} sessions with audio_base64 to backfill.`);

    if (rows.length === 0) {
      console.log('No rows to backfill. Exiting.');
      process.exit(0);
    }

    const storage = await getAudioStorage();
    let successCount = 0;
    let failedCount = 0;
    const failedSessionIds: string[] = [];

    for (const row of rows) {
      try {
        console.log(`Processing session ${row.id} (student: ${row.student_id})...`);

        // Decode the base64 payload using existing isBase64DataUri and regex
        if (!isBase64DataUri(row.audio_base64)) {
          console.warn(`  Skipping: audio_base64 is not a valid data URI`);
          failedCount++;
          failedSessionIds.push(row.id);
          continue;
        }

        const matches = row.audio_base64.match(/^data:(audio\/[a-zA-Z0-9-]+);base64,(.+)$/);
        if (!matches) {
          console.warn(`  Skipping: failed to parse data URI`);
          failedCount++;
          failedSessionIds.push(row.id);
          continue;
        }

        const mimeType = matches[1] || row.audio_mime_type || 'audio/webm';
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate storage key using existing function
        const key = generateStorageKey(row.student_id, row.id, mimeType);

        // Upload to object storage
        const uploadResult = await storage.upload(key, buffer, mimeType);

        // Update the row with storage info and NULL out legacy columns
        await query(
          `UPDATE reading_sessions
           SET audio_storage_key = $1,
               audio_mime_type = $2,
               audio_size_bytes = $3,
               audio_storage_provider = $4,
               audio_base64 = NULL,
               audio_file_path = NULL
           WHERE id = $5`,
          [
            uploadResult.storageKey,
            uploadResult.mimeType,
            uploadResult.sizeBytes,
            uploadResult.provider,
            row.id,
          ]
        );

        console.log(`  Success: uploaded to ${uploadResult.provider} as ${key} (${uploadResult.sizeBytes} bytes)`);
        successCount++;
      } catch (error) {
        console.error(`  Failed for session ${row.id}:`, (error as Error).message);
        failedCount++;
        failedSessionIds.push(row.id);
        // Leave audio_base64 as-is for retry
      }
    }

    console.log('\n=== Backfill Summary ===');
    console.log(`Total processed: ${rows.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failedCount}`);

    if (failedCount > 0) {
      console.log('\nFailed session IDs (safe to re-run):');
      failedSessionIds.forEach(id => console.log(`  ${id}`));
      process.exit(1);
    } else {
      console.log('\nAll sessions backfilled successfully!');
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal error during backfill:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

run();