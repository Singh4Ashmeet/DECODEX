import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

vi.mock('../services/gamification', () => ({
  awardXP: vi.fn().mockResolvedValue(undefined),
  checkAchievements: vi.fn().mockResolvedValue(['Assignment Ace']),
  recordDrillCompletion: vi.fn().mockResolvedValue(undefined),
}));

import { awardXP } from '../services/gamification';
import { completeAssignmentForSession } from '../services/assignments';

const passageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const assignmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const assignmentStudentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('Teacher assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an assignment for an accessible student', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: passageId }] })
      .mockResolvedValueOnce({ rows: [{ allowed: true }] })
      .mockResolvedValueOnce({ rows: [{ id: assignmentId, title: 'Fluency check' }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`)
      .send({
        title: 'Fluency check',
        passage_id: passageId,
        scope: 'selected',
        student_ids: [TEST_USERS.studentA.id],
      });

    expect(response.status).toBe(201);
    expect(response.body.assignedStudentCount).toBe(1);
  });

  it('does not let a teacher assign a student outside their access scope', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: passageId }] })
      // First query: teacher_student_links returns no rows
      .mockResolvedValueOnce({ rows: [] })
      // Second query: school_id fallback returns no rows
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`)
      .send({
        title: 'Fluency check',
        passage_id: passageId,
        scope: 'selected',
        student_ids: [TEST_USERS.studentB.id],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid assignment due dates before writing rows', async () => {
    const response = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`)
      .send({
        title: 'Fluency check',
        passage_id: passageId,
        due_date: 'not-a-date',
        scope: 'selected',
        student_ids: [TEST_USERS.studentA.id],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('validates selected students for admin-created assignments', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: passageId }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/v1/assignments')
      .set('Cookie', `token=${generateTestToken(TEST_USERS.admin)}`)
      .send({
        title: 'Fluency check',
        passage_id: passageId,
        scope: 'selected',
        student_ids: [TEST_USERS.teacher.id],
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('does not let a student start someone else\'s assignment', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/start`)
      .set('Cookie', `token=${generateTestToken(TEST_USERS.studentA)}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 500 when the teacher assignment query hits a database schema error', async () => {
    mockQuery.mockRejectedValueOnce(Object.assign(
      new Error('relation "assignments" does not exist'),
      { code: '42P01' }
    ));

    const response = await request(app)
      .get('/api/v1/assignments/teacher')
      .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Failed to fetch assignments');
  });

  it('links a started assignment to a reading session', async () => {
    const sessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ assignment_student_id: assignmentStudentId, session_id: null, passage_id: passageId }] })
      .mockResolvedValueOnce({ rows: [{ id: sessionId, passage_id: passageId }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post(`/api/v1/assignments/${assignmentId}/start`)
      .set('Cookie', `token=${generateTestToken(TEST_USERS.studentA)}`);

    expect(response.status).toBe(201);
    expect(response.body.session.id).toBe(sessionId);
  });

  it('completes a linked assignment and awards score XP only once', async () => {
    const sessionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: assignmentStudentId, student_id: TEST_USERS.studentA.id, rewards_awarded: false, reward_xp: 0, due_date: null }] })
      .mockResolvedValueOnce({ rows: [{ score: 92 }] })
      .mockResolvedValueOnce({ rows: [{ reward_xp: 65 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await completeAssignmentForSession(sessionId);

    expect(result).toMatchObject({ assignmentStudentId, score: 92, rewardXp: 65 });
    expect(awardXP).toHaveBeenCalledWith(TEST_USERS.studentA.id, 65, `assignment_completed:${assignmentStudentId}`);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: assignmentStudentId, student_id: TEST_USERS.studentA.id, rewards_awarded: true, reward_xp: 65, due_date: null }] })
      .mockResolvedValueOnce({ rows: [{ score: 92 }] })
      .mockResolvedValueOnce({ rows: [] });

    await completeAssignmentForSession(sessionId);
    expect(awardXP).toHaveBeenCalledTimes(1);
  });

  it('does not award XP when another worker already claimed the assignment reward', async () => {
    const sessionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: assignmentStudentId, student_id: TEST_USERS.studentA.id, rewards_awarded: false, reward_xp: 0, due_date: null }] })
      .mockResolvedValueOnce({ rows: [{ score: 92 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ reward_xp: 65 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await completeAssignmentForSession(sessionId);

    expect(result).toMatchObject({ assignmentStudentId, score: 92, rewardXp: 65 });
    expect(awardXP).not.toHaveBeenCalled();
  });
});

describe('Assignment detail access control (GET /:id, PATCH /:id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const otherTeacherId = '88888888-8888-8888-8888-888888888888';
  const assignmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const nonexistentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  describe('GET /api/v1/assignments/:id', () => {
    it('returns 200 for the owning teacher', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: assignmentId, teacher_id: TEST_USERS.teacher.id }] }) // exists check
        .mockResolvedValueOnce({ rows: [{ id: assignmentId, title: 'Test Assignment', passage_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }] }) // full details
        .mockResolvedValueOnce({ rows: [] }); // students

      const response = await request(app)
        .get(`/api/v1/assignments/${assignmentId}`)
        .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`);

      expect(response.status).toBe(200);
      expect(response.body.assignment.id).toBe(assignmentId);
    });

    it('returns 403 for a different teacher (not 404)', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: assignmentId, teacher_id: TEST_USERS.teacher.id }] }); // exists but owned by different teacher

      const response = await request(app)
        .get(`/api/v1/assignments/${assignmentId}`)
        .set('Cookie', `token=${generateTestToken({ id: otherTeacherId, role: 'teacher' })}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toBe('You do not have access to this assignment');
    });

    it('returns 404 for a well-formed but nonexistent UUID', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // does not exist

      const response = await request(app)
        .get(`/api/v1/assignments/${nonexistentId}`)
        .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/assignments/:id', () => {
    it('returns 200 for the owning teacher updating title', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: assignmentId, teacher_id: TEST_USERS.teacher.id }] }) // exists check
        .mockResolvedValueOnce({ rows: [{ id: assignmentId, title: 'Updated Title' }] }); // update result

      const response = await request(app)
        .patch(`/api/v1/assignments/${assignmentId}`)
        .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.assignment.title).toBe('Updated Title');
    });

    it('returns 403 for a different teacher (not 404)', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: assignmentId, teacher_id: TEST_USERS.teacher.id }] }); // exists but owned by different teacher

      const response = await request(app)
        .patch(`/api/v1/assignments/${assignmentId}`)
        .set('Cookie', `token=${generateTestToken({ id: otherTeacherId, role: 'teacher' })}`)
        .send({ title: 'Hacked Title' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toBe('You do not have access to this assignment');
    });

    it('returns 404 for a well-formed but nonexistent UUID', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // does not exist

      const response = await request(app)
        .patch(`/api/v1/assignments/${nonexistentId}`)
        .set('Cookie', `token=${generateTestToken(TEST_USERS.teacher)}`)
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
