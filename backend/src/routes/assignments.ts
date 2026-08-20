import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { canAccessStudent } from '../services/studentAccess';

const router = Router();
const requireTeacher = requireRole(['teacher', 'admin']);
const VALID_ASSIGNMENT_STATUSES = new Set(['draft', 'active', 'archived']);

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseDueDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw Object.assign(new Error('due_date must be an ISO date string'), { status: 400, code: 'VALIDATION_ERROR' });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error('due_date must be a valid date'), { status: 400, code: 'VALIDATION_ERROR' });
  }

  return parsed;
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw Object.assign(new Error('Assignment title is required'), { status: 400, code: 'VALIDATION_ERROR' });
  }

  const title = value.trim();
  if (title.length < 3 || title.length > 255) {
    throw Object.assign(new Error('Assignment title must be between 3 and 255 characters'), { status: 400, code: 'VALIDATION_ERROR' });
  }

  return title;
}

function normalizeInstructions(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw Object.assign(new Error('instructions must be a string'), { status: 400, code: 'VALIDATION_ERROR' });
  }

  const instructions = value.trim();
  return instructions.length > 0 ? instructions : null;
}

async function getVisibleStudentIds(req: AuthRequest, requestedIds: string[] | null): Promise<string[]> {
  if (requestedIds && requestedIds.length > 0) {
    const uniqueIds = [...new Set(requestedIds)];

    for (const studentId of uniqueIds) {
      if (!isUuid(studentId)) {
        throw Object.assign(new Error('Invalid student id'), { status: 400, code: 'VALIDATION_ERROR' });
      }
    }

    if (req.user?.role === 'admin') {
      const students = await query(
        `SELECT id
         FROM users
         WHERE id = ANY($1::uuid[])
           AND role = 'student'
           AND deleted_at IS NULL`,
        [uniqueIds]
      );

      if (students.rows.length !== uniqueIds.length) {
        throw Object.assign(new Error('Cannot assign one or more selected students'), { status: 403, code: 'FORBIDDEN' });
      }

      return uniqueIds;
    }

    for (const studentId of uniqueIds) {
      const allowed = await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role });
      if (!allowed) {
        throw Object.assign(new Error('Cannot assign one or more selected students'), { status: 403, code: 'FORBIDDEN' });
      }
    }
    return uniqueIds;
  }

  const roster = await query(
    `SELECT u.id
     FROM users u
     WHERE u.role = 'student'
       AND u.deleted_at IS NULL
       AND (
         $1 = 'admin'
         OR EXISTS (
           SELECT 1 FROM teacher_student_links tsl
           WHERE tsl.teacher_id = $2
             AND tsl.student_id = u.id
         )
       )
     ORDER BY u.display_name ASC`,
    [req.user?.role, req.user?.id]
  );

  // Safety net: warn if teacher has zero linked students
  if (req.user?.role === 'teacher' && roster.rows.length === 0) {
    console.warn(
      `[EMPTY ROSTER] Teacher ${req.user?.id} has no students linked via teacher_student_links for assignment creation.`
    );
  }

  return roster.rows.map((row: any) => row.id);
}

// POST /api/v1/assignments
router.post('/', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  const { title, instructions, due_date, passage_id, scope = 'selected', student_ids } = req.body || {};

  if (!isUuid(passage_id)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid passage_id is required' } });
  }
  if (scope !== 'class' && scope !== 'selected') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'scope must be class or selected' } });
  }
  if (scope === 'selected' && (!Array.isArray(student_ids) || student_ids.length === 0)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Select at least one student' } });
  }

  try {
    const normalizedTitle = normalizeTitle(title);
    const normalizedInstructions = normalizeInstructions(instructions);
    const normalizedDueDate = parseDueDate(due_date);

    const passage = await query('SELECT id FROM passages WHERE id = $1', [passage_id]);
    if (passage.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Passage not found' } });
    }

    const targetStudentIds = await getVisibleStudentIds(
      req,
      scope === 'class' ? null : student_ids
    );

    if (targetStudentIds.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No students available for this assignment' } });
    }

    const assignment = await query(
      `INSERT INTO assignments (teacher_id, title, instructions, due_date, passage_id, scope, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [
        req.user?.id,
        normalizedTitle,
        normalizedInstructions,
        normalizedDueDate,
        passage_id,
        scope,
      ]
    );

    const assignmentId = assignment.rows[0].id;
    for (const studentId of targetStudentIds) {
      await query(
        `INSERT INTO assignment_students (assignment_id, student_id)
         VALUES ($1, $2)
         ON CONFLICT (assignment_id, student_id) DO NOTHING`,
        [assignmentId, studentId]
      );
    }

    res.status(201).json({
      assignment: assignment.rows[0],
      assignedStudentCount: targetStudentIds.length,
    });
  } catch (error: any) {
    const status = error.status || 500;
    const code = status === 500 ? 'INTERNAL_ERROR' : error.code || 'REQUEST_ERROR';
    const message = status === 500 ? 'Failed to create assignment' : error.message;
    if (status === 500) console.error('Error creating assignment:', error);
    res.status(status).json({ error: { code, message } });
  }
});

// GET /api/v1/assignments/teacher
router.get('/teacher', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT
         a.*,
         p.title as passage_title,
         COUNT(ast.id)::int as assigned_count,
         COUNT(ast.id) FILTER (WHERE ast.status IN ('completed', 'late'))::int as completed_count,
         ROUND(AVG(ast.score) FILTER (WHERE ast.score IS NOT NULL))::int as average_score
       FROM assignments a
       JOIN passages p ON p.id = a.passage_id
       LEFT JOIN assignment_students ast ON ast.assignment_id = a.id
       WHERE a.deleted_at IS NULL
         AND ($1 = 'admin' OR a.teacher_id = $2)
       GROUP BY a.id, p.title
       ORDER BY a.created_at DESC`,
      [req.user?.role, req.user?.id]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assignments' } });
  }
});

// GET /api/v1/assignments/student/me
router.get('/student/me', authenticate, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'student' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only students can view assigned practice' } });
  }

  try {
    const result = await query(
      `SELECT
         ast.*,
         a.title,
         a.instructions,
         a.due_date,
         a.passage_id,
         a.status as assignment_status,
         p.title as passage_title,
         p.grade_level,
         p.word_count
       FROM assignment_students ast
       JOIN assignments a ON a.id = ast.assignment_id
       JOIN passages p ON p.id = a.passage_id
       WHERE ast.student_id = $1
         AND a.deleted_at IS NULL
         AND a.status = 'active'
       ORDER BY
         CASE WHEN ast.status IN ('completed', 'late') THEN 1 ELSE 0 END,
         a.due_date ASC NULLS LAST,
         ast.created_at DESC`,
      [req.user?.id]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assigned practice' } });
  }
});

// POST /api/v1/assignments/:id/start
router.post('/:id/start', authenticate, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'student') {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only students can start assignments' } });
  }
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment ID' } });
  }

  try {
    const assignment = await query(
      `SELECT
         ast.id as assignment_student_id,
         ast.status,
         ast.session_id,
         a.passage_id
       FROM assignment_students ast
       JOIN assignments a ON a.id = ast.assignment_id
       WHERE a.id = $1
         AND ast.student_id = $2
         AND a.deleted_at IS NULL
         AND a.status = 'active'`,
      [req.params.id, req.user?.id]
    );

    if (assignment.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    const row = assignment.rows[0];
    if (row.session_id) {
      return res.json({
        session: { id: row.session_id, passage_id: row.passage_id },
        assignmentStudentId: row.assignment_student_id,
      });
    }

    const session = await query(
      `INSERT INTO reading_sessions (student_id, passage_id, assignment_student_id, status)
       VALUES ($1, $2, $3, 'in_progress')
       RETURNING *`,
      [req.user?.id, row.passage_id, row.assignment_student_id]
    );

    await query(
      `UPDATE assignment_students
       SET status = 'in_progress',
           session_id = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [row.assignment_student_id, session.rows[0].id]
    );

    res.status(201).json({
      session: session.rows[0],
      assignmentStudentId: row.assignment_student_id,
    });
  } catch (error) {
    console.error('Error starting assignment:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to start assignment' } });
  }
});

// GET /api/v1/assignments/:id
router.get('/:id', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment ID' } });
  }

  try {
    // First, check if the assignment exists (regardless of ownership)
    const exists = await query(
      `SELECT id, teacher_id
       FROM assignments
       WHERE id = $1
         AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    // Check ownership: admin bypasses, otherwise teacher_id must match
    const assignmentOwnerId = exists.rows[0].teacher_id;
    if (req.user?.role !== 'admin' && assignmentOwnerId !== req.user?.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this assignment' } });
    }

    // Fetch full assignment details with passage info
    const assignment = await query(
      `SELECT a.*, p.title as passage_title, p.grade_level, p.word_count
       FROM assignments a
       JOIN passages p ON p.id = a.passage_id
       WHERE a.id = $1
         AND a.deleted_at IS NULL`,
      [req.params.id]
    );

    const students = await query(
      `SELECT
         ast.*,
         u.display_name,
         u.grade_level
       FROM assignment_students ast
       JOIN users u ON u.id = ast.student_id
       WHERE ast.assignment_id = $1
       ORDER BY u.display_name ASC`,
      [req.params.id]
    );

    res.json({ assignment: assignment.rows[0], students: students.rows });
  } catch (error) {
    console.error('Error fetching assignment detail:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assignment' } });
  }
});

// PATCH /api/v1/assignments/:id
router.patch('/:id', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  const { title, instructions, due_date, status } = req.body || {};
  const hasStatus = Object.prototype.hasOwnProperty.call(req.body || {}, 'status');

  if (!isUuid(req.params.id)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment ID' } });
  }
  if (hasStatus && (typeof status !== 'string' || !VALID_ASSIGNMENT_STATUSES.has(status))) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment status' } });
  }

  try {
    // First, check if the assignment exists (regardless of ownership)
    const exists = await query(
      `SELECT id, teacher_id
       FROM assignments
       WHERE id = $1
         AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    // Check ownership: admin bypasses, otherwise teacher_id must match
    const assignmentOwnerId = exists.rows[0].teacher_id;
    if (req.user?.role !== 'admin' && assignmentOwnerId !== req.user?.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this assignment' } });
    }

    const values: any[] = [req.params.id];
    const updates: string[] = [];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
      values.push(normalizeTitle(title));
      updates.push(`title = $${values.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'instructions')) {
      values.push(normalizeInstructions(instructions));
      updates.push(`instructions = $${values.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'due_date')) {
      values.push(parseDueDate(due_date));
      updates.push(`due_date = $${values.length}`);
    }
    if (hasStatus) {
      values.push(status);
      updates.push(`status = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No assignment updates provided' } });
    }

    values.push(new Date());
    updates.push(`updated_at = $${values.length}`);

    const result = await query(
      `UPDATE assignments
       SET ${updates.join(', ')}
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      // This should not happen since we already verified existence, but handle race condition
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    res.json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update assignment' } });
  }
});

export default router;
