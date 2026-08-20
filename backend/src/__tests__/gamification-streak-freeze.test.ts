/**
 * Gamification Streak Freeze tests — verifies the streak freeze mechanism
 * that allows up to 2 missed days per calendar month before streak resets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module BEFORE any imports
vi.mock('../db', () => {
  const mockQuery = vi.fn();
  return {
    query: mockQuery,
    pool: {
      query: mockQuery,
      connect: vi.fn().mockResolvedValue({
        query: mockQuery,
        release: vi.fn(),
      }),
      on: vi.fn(),
    },
  };
});

// Now import - this should get the mocked version
import { query as dbQuery } from '../db';
import * as gamificationModule from '../services/gamification';

const mockedQuery = vi.mocked(dbQuery);

describe('Gamification Streak Freeze', () => {
  const studentId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create a mock profile response
  const createMockProfile = (overrides = {}) => ({
    rows: [{
      xp: 0,
      level: 1,
      current_streak: 5,
      longest_streak: 5,
      last_activity_date: '2026-01-10',
      total_sessions: 5,
      total_drills_completed: 0,
      total_stories_read: 0,
      freeze_count: 0,
      freeze_month: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    }],
  });

  // Helper to set up all the mock responses for a full recordSessionCompletion call
  // Captures the UPDATE profile call arguments directly
  const setupRecordSessionMocks = (profileOverrides = {}, xpOverrides = {}) => {
    const profile = createMockProfile(profileOverrides);
    const prevXP = xpOverrides.prevXP || 0;
    const newXP = prevXP + 25 + (xpOverrides.streakBonus ? 10 : 0);
    const leveledUp = xpOverrides.leveledUp || false;

    // Store captured UPDATE call args
    let capturedUpdateArgs: any[] = [];

    let callCount = 0;
    mockedQuery.mockImplementation((sql: string, params?: any[]) => {
      callCount++;
      // Call 1: ensureProfile (INSERT) in recordSessionCompletion
      // Call 2: SELECT profile for streak calculation
      // Call 3: UPDATE profile (streak, freeze, etc.)
      // Call 4: ensureProfile (INSERT) in awardXP
      // Call 5: SELECT xp in awardXP
      // Call 6: UPDATE xp in awardXP
      // Call 7: UPDATE level in awardXP (if leveled up)
      // Call 8: SELECT profile in checkAchievements
      // Call 9: SELECT all achievements
      // Call 10: SELECT earned achievements

      // Match by call order since SQL strings have formatting differences
      if (callCount === 1 || callCount === 4) {
        // ensureProfile INSERT calls
        return Promise.resolve({ rows: [] });
      }
      if (callCount === 2) {
        // SELECT profile for streak calculation
        return Promise.resolve(profile);
      }
      if (callCount === 3) {
        // UPDATE profile (streak, freeze, etc.) - CAPTURE THESE ARGS
        capturedUpdateArgs = params || [];
        return Promise.resolve({ rows: [] });
      }
      if (callCount === 5) {
        // SELECT xp in awardXP
        return Promise.resolve({ rows: [{ xp: prevXP }] });
      }
      if (callCount === 6) {
        // UPDATE xp in awardXP
        return Promise.resolve({ rows: [] });
      }
      if (callCount === 7 && leveledUp) {
        // UPDATE level in awardXP
        return Promise.resolve({ rows: [] });
      }
      if (callCount === (leveledUp ? 8 : 7)) {
        // SELECT profile in checkAchievements
        return Promise.resolve(profile);
      }
      if (callCount === (leveledUp ? 9 : 8)) {
        // SELECT all achievements
        return Promise.resolve({ rows: [] });
      }
      if (callCount === (leveledUp ? 10 : 9)) {
        // SELECT earned achievements
        return Promise.resolve({ rows: [] });
      }
      // Default for any extra calls
      return Promise.resolve({ rows: [] });
    });

    // Return a function to get the captured args
    return () => capturedUpdateArgs;
  };

  it('getProfile returns freeze fields', async () => {
    const mockResult = createMockProfile({
      freeze_count: 1,
      freeze_month: '2026-01',
    });
    // First call: ensureProfile (INSERT), second call: SELECT profile
    mockedQuery
      .mockResolvedValueOnce({ rows: [] }) // ensureProfile
      .mockResolvedValueOnce(mockResult);

    const profile = await gamificationModule.getProfile(studentId);

    expect(profile.freezeCount).toBe(1);
    expect(profile.freezeMonth).toBe('2026-01');
  });

  // --- recordSessionCompletion streak freeze tests ---

  it('1 missed day uses a freeze day and streak continues', async () => {
    // Last activity was 2026-01-10, today is 2026-01-12 (1 missed day = gap of 2)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-12T10:00:00Z'));

    const getUpdateArgs = setupRecordSessionMocks({
      last_activity_date: '2026-01-10',
      current_streak: 5,
      freeze_count: 0,
      freeze_month: null,
    }, { prevXP: 100 });

    await gamificationModule.recordSessionCompletion(studentId);

    // Get captured UPDATE args: [studentId, newStreak, newLongest, today, newTotalSessions, freeze_count, freeze_month]
    const updateArgs = getUpdateArgs();
    expect(updateArgs[1]).toBe(6); // newStreak (5 -> 6)
    expect(updateArgs[5]).toBe(1); // freeze_count
    expect(updateArgs[6]).toBe('2026-01'); // freeze_month

    vi.useRealTimers();
  });

  it('2 missed days in same month uses second freeze day and streak continues', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-13T10:00:00Z'));

    const getUpdateArgs = setupRecordSessionMocks({
      last_activity_date: '2026-01-10',
      current_streak: 5,
      freeze_count: 1,
      freeze_month: '2026-01',
    }, { prevXP: 100 });

    await gamificationModule.recordSessionCompletion(studentId);

    const updateArgs = getUpdateArgs();
    expect(updateArgs[1]).toBe(6); // newStreak continues
    expect(updateArgs[5]).toBe(2); // freeze_count incremented to 2

    vi.useRealTimers();
  });

  it('3rd missed day in same month breaks streak (resets to 1)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-14T10:00:00Z'));

    const getUpdateArgs = setupRecordSessionMocks({
      last_activity_date: '2026-01-10',
      current_streak: 5,
      freeze_count: 2,
      freeze_month: '2026-01',
    }, { prevXP: 100 });

    await gamificationModule.recordSessionCompletion(studentId);

    const updateArgs = getUpdateArgs();
    expect(updateArgs[1]).toBe(1); // streak reset to 1
    expect(updateArgs[5]).toBe(2); // freeze_count stays at 2

    vi.useRealTimers();
  });

  it('freeze count resets at start of new calendar month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z')); // New month!

    const getUpdateArgs = setupRecordSessionMocks({
      last_activity_date: '2026-01-28',
      current_streak: 5,
      freeze_count: 2, // Used up in January
      freeze_month: '2026-01',
    }, { prevXP: 100 });

    await gamificationModule.recordSessionCompletion(studentId);

    // Gap is 4 days (Jan 28 -> Feb 1), but freeze should reset for February
    // So first freeze day in February is used
    const updateArgs = getUpdateArgs();
    expect(updateArgs[1]).toBe(6); // streak continues (5 -> 6)
    expect(updateArgs[5]).toBe(1); // freeze_count reset to 1 for new month
    expect(updateArgs[6]).toBe('2026-02'); // freeze_month updated to February

    vi.useRealTimers();
  });
});