import { query } from '../db';

export interface StudentAccessRequester {
  id?: string;
  role?: string;
}

export async function teacherHasStudentAccess(teacherId: string, studentId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM teacher_student_links tsl
     JOIN users t ON t.id = tsl.teacher_id
     JOIN users s ON s.id = tsl.student_id
     WHERE tsl.teacher_id = $1
       AND tsl.student_id = $2
       AND t.role = 'teacher'
       AND s.role = 'student'
       AND t.deleted_at IS NULL
       AND s.deleted_at IS NULL`,
    [teacherId, studentId]
  );

  if (result.rows.length > 0) {
    return true;
  }

  const fallbackResult = await query(
    `SELECT 1
     FROM users t
     JOIN users s ON t.school_id = s.school_id
     WHERE t.id = $1
       AND s.id = $2
       AND t.role = 'teacher'
       AND s.role = 'student'
       AND t.school_id IS NOT NULL
       AND t.deleted_at IS NULL
       AND s.deleted_at IS NULL`,
    [teacherId, studentId]
  );

  if (fallbackResult.rows.length > 0) {
    console.warn(
      `[ACCESS FALLBACK] Teacher ${teacherId} accessed student ${studentId} via school_id fallback. ` +
      `No explicit teacher_student_links relationship exists. ` +
      `This fallback will be removed in a future release.`
    );
    return true;
  }

  return false;
}

export async function parentHasStudentAccess(parentId: string, studentId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM parent_student_links
     WHERE parent_id = $1
       AND student_id = $2
       AND consent_granted = TRUE
       AND withdrawn_at IS NULL`,
    [parentId, studentId]
  );

  return result.rows.length > 0;
}

export async function canAccessStudent(studentId: string, requester: StudentAccessRequester): Promise<boolean> {
  if (!requester.id || !requester.role) return false;
  if (requester.role === 'admin') return true;
  if (requester.role === 'student') return requester.id === studentId;
  if (requester.role === 'teacher') return teacherHasStudentAccess(requester.id, studentId);
  if (requester.role === 'parent') return parentHasStudentAccess(requester.id, studentId);
  return false;
}
