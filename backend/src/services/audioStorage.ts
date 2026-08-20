import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export interface AudioStorageUploadResult {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  provider: string;
}

export interface AudioStorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<AudioStorageUploadResult>;
  getBuffer(key: string): Promise<Buffer | null>;
  getStream(key: string): Promise<Readable | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  deleteByStudentId(studentId: string): Promise<number>;
  getMimeType(key: string): string;
}

/**
 * Local disk storage provider for development and testing.
 * Stores files under a base directory with studentId/sessionId structure.
 */
class LocalDiskStorage implements AudioStorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.AUDIO_STORAGE_PATH || path.join(process.cwd(), 'audio-storage');
    this.ensureBaseDir();
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFullPath(key: string): string {
    // Prevent path traversal attacks
    const normalizedKey = path.normalize(key);
    if (normalizedKey.startsWith('..') || path.isAbsolute(normalizedKey)) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return path.join(this.baseDir, normalizedKey);
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<AudioStorageUploadResult> {
    const fullPath = this.getFullPath(key);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);

    return {
      storageKey: key,
      mimeType,
      sizeBytes: buffer.length,
      provider: 'local',
    };
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    const fullPath = this.getFullPath(key);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath);
  }

  async getStream(key: string): Promise<Readable | null> {
    const fullPath = this.getFullPath(key);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.createReadStream(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    return fs.existsSync(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      // Clean up empty directories
      this.cleanupEmptyDirs(path.dirname(fullPath));
    }
  }

  private cleanupEmptyDirs(dir: string): void {
    if (dir === this.baseDir || dir === path.dirname(this.baseDir)) {
      return; // Don't delete base dir
    }
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        this.cleanupEmptyDirs(path.dirname(dir));
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  async deleteByStudentId(studentId: string): Promise<number> {
    const studentDir = path.join(this.baseDir, studentId);
    if (!fs.existsSync(studentDir)) {
      return 0;
    }
    let deletedCount = 0;
    const files = fs.readdirSync(studentDir);
    for (const file of files) {
      const filePath = path.join(studentDir, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    // Try to remove student directory if empty
    try {
      if (fs.readdirSync(studentDir).length === 0) {
        fs.rmdirSync(studentDir);
      }
    } catch {
      // Ignore
    }
    return deletedCount;
  }

  getMimeType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.webm': 'audio/webm',
      '.wav': 'audio/wav',
      '.mp4': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/m4a',
      '.aac': 'audio/aac',
      '.mpeg': 'audio/mpeg',
      '.mp3': 'audio/mpeg',
    };
    return mimeMap[ext] || 'audio/webm';
  }
}

/**
 * Supabase Storage provider for production.
 * Requires @supabase/supabase-js package and valid credentials.
 */
class SupabaseStorage implements AudioStorageProvider {
  private bucket: string;
  private client: any;

  constructor() {
    this.bucket = process.env.AUDIO_STORAGE_BUCKET || 'decodex-audio';
    this.initClient();
  }

  private async initClient(): Promise<void> {
    try {
      // Lazy require to avoid breaking dev without the package
      // @ts-ignore - @supabase/supabase-js is optional dependency
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured');
      }

      this.client = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      throw new Error(`Failed to initialize Supabase client: ${(error as Error).message}`);
    }
  }

  private async ensureClient(): Promise<void> {
    if (!this.client) {
      await this.initClient();
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<AudioStorageUploadResult> {
    await this.ensureClient();

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return {
      storageKey: key,
      mimeType,
      sizeBytes: buffer.length,
      provider: 'supabase',
    };
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    await this.ensureClient();

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(key);

    if (error) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return null;
      }
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async getStream(key: string): Promise<Readable | null> {
    await this.ensureClient();

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(key);

    if (error) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return null;
      }
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    // Convert blob to Readable stream
    return Readable.fromWeb(data as any);
  }

  async exists(key: string): Promise<boolean> {
    await this.ensureClient();

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(path.dirname(key), {
        search: path.basename(key),
      });

    if (error) {
      return false;
    }

    return data.some((file: any) => file.name === path.basename(key));
  }

  async delete(key: string): Promise<void> {
    await this.ensureClient();

    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      // Ignore not found errors
      if (!error.message.includes('not found') && !error.message.includes('404')) {
        throw new Error(`Supabase delete failed: ${error.message}`);
      }
    }
  }

  async deleteByStudentId(studentId: string): Promise<number> {
    await this.ensureClient();

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(studentId);

    if (error) {
      console.warn(`Failed to list files for student ${studentId}:`, error.message);
      return 0;
    }

    if (!data || data.length === 0) {
      return 0;
    }

    const filesToDelete = data.map((file: any) => `${studentId}/${file.name}`);
    const { error: deleteError } = await this.client.storage
      .from(this.bucket)
      .remove(filesToDelete);

    if (deleteError) {
      console.warn(`Failed to delete files for student ${studentId}:`, deleteError.message);
      return 0;
    }

    return filesToDelete.length;
  }

  getMimeType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.webm': 'audio/webm',
      '.wav': 'audio/wav',
      '.mp4': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/m4a',
      '.aac': 'audio/aac',
      '.mpeg': 'audio/mpeg',
      '.mp3': 'audio/mpeg',
    };
    return mimeMap[ext] || 'audio/webm';
  }
}

// Singleton instance
let audioStorageInstance: AudioStorageProvider | null = null;

/**
 * Factory function to get the appropriate audio storage provider.
 * Priority:
 * 1. Explicit AUDIO_STORAGE_PROVIDER=supabase with valid Supabase credentials
 * 2. Auto-detect Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * 3. Local disk storage (default)
 *
 * Falls back to LocalDiskStorage on any initialization failure.
 */
export async function getAudioStorage(): Promise<AudioStorageProvider> {
  if (audioStorageInstance) {
    return audioStorageInstance;
  }

  const explicitProvider = process.env.AUDIO_STORAGE_PROVIDER?.toLowerCase();
  const hasSupabaseCreds = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (explicitProvider === 'supabase' && hasSupabaseCreds) {
      console.log('[AudioStorage] Using Supabase Storage provider');
      audioStorageInstance = new SupabaseStorage();
      // Test the connection
      await audioStorageInstance.exists('__health_check__');
      return audioStorageInstance;
    } else if (explicitProvider === 'local') {
      console.log('[AudioStorage] Using Local Disk Storage provider (explicit)');
      audioStorageInstance = new LocalDiskStorage();
      return audioStorageInstance;
    } else if (hasSupabaseCreds) {
      console.log('[AudioStorage] Supabase credentials detected, attempting Supabase Storage...');
      try {
        const supabaseStorage = new SupabaseStorage();
        await supabaseStorage.exists('__health_check__');
        console.log('[AudioStorage] Using Supabase Storage provider (auto-detected)');
        audioStorageInstance = supabaseStorage;
        return audioStorageInstance;
      } catch (supabaseError) {
        console.warn('[AudioStorage] Supabase Storage unavailable, falling back to Local Disk:', (supabaseError as Error).message);
        audioStorageInstance = new LocalDiskStorage();
        return audioStorageInstance;
      }
    } else {
      console.log('[AudioStorage] Using Local Disk Storage provider (default)');
      audioStorageInstance = new LocalDiskStorage();
      return audioStorageInstance;
    }
  } catch (error) {
    console.warn('[AudioStorage] Storage initialization failed, falling back to Local Disk:', (error as Error).message);
    audioStorageInstance = new LocalDiskStorage();
    return audioStorageInstance;
  }
}

/**
 * Generate a storage key for an audio file.
 * Format: {studentId}/{sessionId}.{ext}
 * Extension derived from MIME type (webm default).
 */
export function generateStorageKey(studentId: string, sessionId: string, mimeType: string): string {
  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'video/webm': 'webm',
  };
  const ext = extMap[mimeType.toLowerCase()] || 'webm';
  return `${studentId}/${sessionId}.${ext}`;
}

/**
 * Check if a string is a base64 data URI.
 */
export function isBase64DataUri(str: string | null | undefined): boolean {
  if (!str) return false;
  return str.startsWith('data:audio/') && str.includes(';base64,');
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetAudioStorage(): void {
  audioStorageInstance = null;
}