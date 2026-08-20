import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.mimetype.includes('webm') ? '.webm' :
                file.mimetype.includes('wav') ? '.wav' :
                file.mimetype.includes('mp4') ? '.mp4' :
                file.mimetype.includes('ogg') ? '.ogg' : '.m4a';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Allowlist of accepted audio MIME types.
// Rejects any file that does not match — prevents arbitrary file upload to disk.
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
  'video/webm', // Chrome records audio-only streams with this MIME type
]);

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // First check: declared MIME type allowlist
  if (!ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are accepted.`));
  }
  cb(null, true);
};

// 10MB limit per security requirements
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// Magic byte signatures for allowed audio formats
// We verify the actual file content matches an allowed format, not just the declared MIME type.
type AudioFormat = 'webm' | 'wav' | 'mp3' | 'mp4' | 'ogg' | 'aac';

const ALLOWED_FILE_TYPES: ReadonlySet<AudioFormat> = new Set([
  'webm',   // audio/webm, video/webm
  'wav',    // audio/wav, audio/wave, audio/x-wav
  'mp3',    // audio/mpeg
  'mp4',    // audio/mp4, audio/m4a, audio/x-m4a
  'ogg',    // audio/ogg
  'aac',    // audio/aac
]);

const MAGIC_BYTES_READ_LENGTH = 4100;

// Manual magic byte detection for allowed audio formats
function detectAudioFormat(buffer: Buffer): AudioFormat | null {
  if (buffer.length < 12) return null;

  // WebM: EBML header 0x1A45DFA3 at offset 0
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return 'webm';
  }

  // WAV: RIFF header "RIFF" at offset 0 + "WAVE" at offset 8
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer.length >= 12 && 
        buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
      return 'wav';
    }
  }

  // MP4/M4A: ftyp box at offset 4 (first 4 bytes = size)
  // Common brands: 'mp4', 'm4a', 'isom', 'iso2', 'avc1', 'qt'
  if (buffer.length >= 12) {
    const brandOffset = buffer.readUInt32BE(0) === buffer.length ? 8 : 4;
    if (buffer.length >= brandOffset + 4) {
      const brand = buffer.subarray(brandOffset, brandOffset + 4).toString('ascii');
      if (['mp4', 'm4a', 'isom', 'iso2', 'avc1', 'qt', 'M4A '].includes(brand)) {
        return 'mp4';
      }
    }
    // Also check at offset 4 (common position for ftyp)
    const brandAt4 = buffer.subarray(4, 8).toString('ascii');
    if (['mp4', 'm4a', 'isom', 'iso2', 'avc1', 'qt', 'M4A '].includes(brandAt4)) {
      return 'mp4';
    }
  }

  // OGG: "OggS" at offset 0
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return 'ogg';
  }

  // MP3: ID3 tag at offset 0 ("ID3")
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return 'mp3';
  }
  // MP3: MPEG frame sync (0xFFE0 - 0xFFFF) at offset 0
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return 'mp3';
  }

  // AAC: ADTS frame sync (0xFFF) at offset 0
  if (buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0) {
    return 'aac';
  }

  // MP4 can also start with 00 00 00 XX ftyp
  // Check for ftyp at various positions
  for (let i = 0; i < Math.min(buffer.length - 8, 100); i++) {
    if (buffer[i] === 0x66 && buffer[i+1] === 0x74 && buffer[i+2] === 0x79 && buffer[i+3] === 0x70) {
      const brand = buffer.subarray(i+4, i+8).toString('ascii');
      if (['mp4', 'm4a', 'isom', 'iso2', 'avc1', 'qt', 'M4A '].includes(brand)) {
        return 'mp4';
      }
    }
  }

  return null;
}

async function validateFileSignature(filePath: string): Promise<AudioFormat | null> {
  const buffer = Buffer.alloc(MAGIC_BYTES_READ_LENGTH);
  let fd: number | undefined;
  
  try {
    fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, MAGIC_BYTES_READ_LENGTH, 0);
    fs.closeSync(fd);
    fd = undefined;
    
    const actualBuffer = buffer.subarray(0, bytesRead);
    return detectAudioFormat(actualBuffer);
  } catch (err) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    throw err;
  }
}

async function validateUploadedAudioFile(filePath: string): Promise<void> {
  const detectedFormat = await validateFileSignature(filePath);
  
  if (!detectedFormat || !ALLOWED_FILE_TYPES.has(detectedFormat)) {
    // Clean up the uploaded file since it's invalid
    try { fs.unlinkSync(filePath); } catch {}
    throw new Error(`File content validation failed: uploaded file does not match declared audio format (detected: ${detectedFormat || 'unknown'}).`);
  }
}

export { validateUploadedAudioFile };