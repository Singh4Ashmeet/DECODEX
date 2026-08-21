/**
 * Audit Logging Middleware — V1 Requirement
 * 
 * Logs all data access for compliance and security monitoring
 */
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { logger } from '../lib/logger';

export interface AuditLogEntry {
  timestamp: string;
  userId: string;
  role: string;
  ip: string;
  method: string;
  path: string;
  resource: string;
  resourceId?: string;
  action: 'read' | 'write' | 'delete';
  statusCode: number;
  userAgent?: string;
}

// Resource patterns for automatic classification
const RESOURCE_PATTERNS: Array<{ pattern: RegExp; resource: string; action: 'read' | 'write' | 'delete' }> = [
  // Sessions
  { pattern: /^\/api\/v1\/sessions$/, resource: 'session', action: 'write' },
  { pattern: /^\/api\/v1\/sessions\/[^/]+$/, resource: 'session', action: 'read' },
  { pattern: /^\/api\/v1\/sessions\/[^/]+\/audio$/, resource: 'session_audio', action: 'read' },
  { pattern: /^\/api\/v1\/sessions\/[^/]+\/results$/, resource: 'session_results', action: 'read' },
  { pattern: /^\/api\/v1\/sessions\/[^/]+\/status/, resource: 'session_status', action: 'read' },
  { pattern: /^\/api\/v1\/sessions\/[^/]+\/classifications/, resource: 'error_classifications', action: 'read' },
  { pattern: /^\/api\/v1\/sessions\/drills\/[^/]+\/complete$/, resource: 'drill', action: 'write' },
  
  // Analytics
  { pattern: /^\/api\/v1\/analytics/, resource: 'analytics', action: 'read' },
  
  // Teacher
  { pattern: /^\/api\/v1\/teacher\/students/, resource: 'student_roster', action: 'read' },
  { pattern: /^\/api\/v1\/teacher\/student\/[^/]+\/trends/, resource: 'student_trends', action: 'read' },
  { pattern: /^\/api\/v1\/teacher\/student\/[^/]+\/sessions/, resource: 'student_sessions', action: 'read' },
  
  // Parent
  { pattern: /^\/api\/v1\/parent\/children/, resource: 'children_list', action: 'read' },
  { pattern: /^\/api\/v1\/parent\/student\/[^/]+\/sessions/, resource: 'child_sessions', action: 'read' },
  { pattern: /^\/api\/v1\/parent\/student\/[^/]+\/progress/, resource: 'child_progress', action: 'read' },
  { pattern: /^\/api\/v1\/parent\/student\/[^/]+\/audio/, resource: 'child_audio', action: 'read' },
  
  // Consent
  { pattern: /^\/api\/v1\/consent\/link$/, resource: 'parent_student_link', action: 'write' },
  { pattern: /^\/api\/v1\/consent\/request/, resource: 'consent_request', action: 'write' },
  { pattern: /^\/api\/v1\/consent\/children/, resource: 'consent_status', action: 'read' },
  { pattern: /^\/api\/v1\/consent\/withdraw/, resource: 'consent_withdrawal', action: 'write' },
  { pattern: /^\/api\/v1\/consent\/[^/]+\/confirm/, resource: 'consent_confirmation', action: 'write' },
  
  // Error profiles & drills
  { pattern: /^\/api\/v1\/error-profiles/, resource: 'error_profile', action: 'read' },
  { pattern: /^\/api\/v1\/drills/, resource: 'drill', action: 'read' },
  
  // Health score & copilot
  { pattern: /^\/api\/v1\/health-score/, resource: 'health_score', action: 'read' },
  { pattern: /^\/api\/v1\/copilot/, resource: 'copilot_strategy', action: 'read' },
  
  // Classroom analytics
  { pattern: /^\/api\/v1\/classroom/, resource: 'classroom_analytics', action: 'read' },
  
  // Assignments
  { pattern: /^\/api\/v1\/assignments/, resource: 'assignment', action: 'read' },
  
  // Stories & learning paths
  { pattern: /^\/api\/v1\/stories/, resource: 'story', action: 'read' },
  { pattern: /^\/api\/v1\/learning-paths/, resource: 'learning_path', action: 'read' },
  
  // Gamification
  { pattern: /^\/api\/v1\/gamification/, resource: 'gamification', action: 'read' },
  
  // Risk screening
  { pattern: /^\/api\/v1\/risk-screening/, resource: 'risk_screening', action: 'read' },
  
  // Dex
  { pattern: /^\/api\/v1\/dex\/transcribe/, resource: 'transcription', action: 'write' },
  { pattern: /^\/api\/v1\/dex\/grade/, resource: 'grading', action: 'write' },
  { pattern: /^\/api\/v1\/dex\/chat/, resource: 'dex_chat', action: 'write' },
  
  // TTS
  { pattern: /^\/api\/v1\/tts/, resource: 'tts', action: 'write' },
];

function classifyRequest(method: string, path: string): { resource: string; action: 'read' | 'write' | 'delete' } {
  // Check explicit patterns first
  for (const { pattern, resource, action } of RESOURCE_PATTERNS) {
    if (pattern.test(path)) {
      return { resource, action };
    }
  }
  
  // Fallback based on HTTP method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { resource: 'unknown', action: 'read' };
  }
  if (method === 'DELETE') {
    return { resource: 'unknown', action: 'delete' };
  }
  return { resource: 'unknown', action: 'write' };
}

function extractResourceId(path: string): string | undefined {
  // Extract UUID from path
  const uuidMatch = path.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  return uuidMatch?.[1];
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const authReq = req as AuthRequest;
  const userId = authReq.user?.id || 'anonymous';
  const role = authReq.user?.role || 'unknown';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent');
  const method = req.method;
  const path = req.path;
  
  const { resource, action } = classifyRequest(method, path);
  const resourceId = extractResourceId(path);
  
  // Capture response status
  const originalSend = res.send;
  let statusCode = 200;
  
  res.send = function (body?: any): Response {
    statusCode = res.statusCode;
    return originalSend.call(this, body);
  };
  
  // Log after response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const auditEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      role,
      ip,
      method,
      path,
      resource,
      resourceId,
      action,
      statusCode,
      userAgent,
    };
    
    // Log as structured JSON for SIEM ingestion
    logger.info({ audit: auditEntry, durationMs: duration }, 'Data access audit');
  });
  
  next();
}

// Helper to manually log audit events (for non-HTTP operations)
export function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  logger.info({ 
    audit: { ...entry, timestamp: new Date().toISOString() } 
  }, 'Manual audit event');
}

// Admin endpoint to query audit logs (would need audit_logs table)
export async function getAuditLogs(filters: {
  userId?: string;
  resource?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  // This would query the audit_logs table
  // For now, return empty - implement when audit_logs table is created
  return [];
}