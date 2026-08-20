import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, useApiQuery } from '../lib/api';
import DexAvatar from './DexAvatar';

type Scope = 'class' | 'selected';

interface Student {
  id: string;
  display_name: string;
  grade_level?: number | null;
  latest_health_score?: number | null;
  health_risk_level?: 'critical' | 'high' | 'medium' | 'good' | 'excellent' | null;
  health_score_date?: string | null;
  rev_count?: number | null;
  sub_count?: number | null;
  omi_count?: number | null;
  ins_count?: number | null;
  bld_count?: number | null;
  pac_count?: number | null;
  uncertain_count?: number | null;
  learning_path_status?: string | null;
  learning_path_week?: number | null;
}

const ERROR_CATEGORY_STYLES: Record<string, string> = {
  rev_count: 'cat-rev',
  sub_count: 'cat-sub',
  omi_count: 'cat-omi',
  ins_count: 'cat-ins',
  bld_count: 'cat-bld',
  pac_count: 'cat-pac',
  uncertain_count: 'cat-unc',
};

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  rev_count: 'Reversals',
  sub_count: 'Substitutions',
  omi_count: 'Omissions',
  ins_count: 'Insertions',
  bld_count: 'Blends',
  pac_count: 'Pacing',
  uncertain_count: 'Uncertain',
};

const ERROR_CATEGORY_ICONS: Record<string, string> = {
  rev_count: 'swap_horiz',
  sub_count: 'find_replace',
  omi_count: 'playlist_remove',
  ins_count: 'playlist_add',
  bld_count: 'blend',
  pac_count: 'pace',
  uncertain_count: 'help',
};

function getTopErrorCategory(student: Student): { key: string; label: string; count: number; style: string; icon: string } | null {
  const errors = [
    { key: 'rev_count', count: student.rev_count ?? 0 },
    { key: 'sub_count', count: student.sub_count ?? 0 },
    { key: 'omi_count', count: student.omi_count ?? 0 },
    { key: 'ins_count', count: student.ins_count ?? 0 },
    { key: 'bld_count', count: student.bld_count ?? 0 },
    { key: 'pac_count', count: student.pac_count ?? 0 },
    { key: 'uncertain_count', count: student.uncertain_count ?? 0 },
  ].filter(e => e.count > 0);

  if (errors.length === 0) return null;

  errors.sort((a, b) => b.count - a.count);
  const top = errors[0];
  return { 
    ...top, 
    label: ERROR_CATEGORY_LABELS[top.key] || top.key, 
    style: ERROR_CATEGORY_STYLES[top.key] || 'cat-unc',
    icon: ERROR_CATEGORY_ICONS[top.key] || 'psychology',
  };
}

function getRiskLevelConfig(riskLevel: string | null | undefined): { badge: string; dot: string; label: string; border: string } {
  switch (riskLevel) {
    case 'excellent': return { badge: 'risk-excellent', dot: 'risk-dot-excellent', label: 'Excellent', border: 'var(--risk-excellent-border)' };
    case 'good': return { badge: 'risk-good', dot: 'risk-dot-good', label: 'Good', border: 'var(--risk-good-border)' };
    case 'medium': return { badge: 'risk-medium', dot: 'risk-dot-medium', label: 'Medium', border: 'var(--risk-medium-border)' };
    case 'high': return { badge: 'risk-high', dot: 'risk-dot-high', label: 'High Risk', border: 'var(--risk-high-border)' };
    case 'critical': return { badge: 'risk-critical', dot: 'risk-dot-critical', label: 'Critical', border: 'var(--risk-critical-border)' };
    default: return { badge: 'bg-surface-container-high text-on-surface-variant', dot: '', label: 'No data', border: 'var(--color-border)' };
  }
}

interface Passage {
  id: string;
  title: string;
  grade_level?: number | null;
  word_count?: number | null;
}

interface Assignment {
  id: string;
  title: string;
  instructions?: string | null;
  due_date?: string | null;
  passage_title: string;
  assigned_count: number;
  completed_count: number;
  average_score?: number | null;
  status: 'draft' | 'active' | 'archived';
}

interface AssignmentStudent {
  id: string;
  student_id: string;
  display_name: string;
  grade_level?: number | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'late';
  score?: number | null;
  session_id?: string | null;
  completed_at?: string | null;
  reward_xp?: number;
}

interface AssignmentDetail {
  assignment: Assignment;
  students: AssignmentStudent[];
}

function formatDueDate(value?: string | null): string {
  if (!value) return 'No due date';
  return `Due ${new Date(value).toLocaleDateString()}`; 
}

export default function AssignmentManager() {
  const { data: assignmentData, loading, error, refetch } = useApiQuery<{ assignments: Assignment[] }>('/assignments/teacher');
  const { data: studentData } = useApiQuery<{ students: Student[] }>('/teacher/students');
  const { data: passageData } = useApiQuery<{ passages: Passage[] }>('/passages');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [passageId, setPassageId] = useState('');
  const [scope, setScope] = useState<Scope>('class');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const students = studentData?.students ?? [];
  const passages = passageData?.passages ?? [];
  const assignments = assignmentData?.assignments ?? [];

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(current => current.includes(studentId)
      ? current.filter(id => id !== studentId)
      : [...current, studentId]);
  };

  const createAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      await apiFetch('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title,
          instructions,
          due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null,
          passage_id: passageId,
          scope,
          student_ids: scope === 'selected' ? selectedStudentIds : undefined,
        }),
      });
      setTitle('');
      setInstructions('');
      setDueDate('');
      setPassageId('');
      setSelectedStudentIds([]);
      setMessage('Assignment created and shared with students.');
      refetch();
    } catch (createError: any) {
      setMessage(createError.message || 'Could not create the assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const showProgress = async (assignmentId: string) => {
    if (detail?.assignment.id === assignmentId) {
      setDetail(null);
      return;
    }

    setDetailLoading(assignmentId);
    try {
      const result = await apiFetch<AssignmentDetail>(`/assignments/${assignmentId}`);
      setDetail(result);
    } catch (detailError: any) {
      setMessage(detailError.message || 'Could not load assignment progress.');
    } finally {
      setDetailLoading(null);
    }
  };

  if (loading) return <div className="stat-card p-6 text-on-surface-variant student-text">Loading assignments...</div>;
  if (error) return <div className="stat-card p-6 border-l-4 border-red-500 text-red-800 student-text">Could not load assignments: {error.message}</div>;

  return (
    <div className="space-y-6">
      <section className="stat-card stat-card-hover p-6 md:p-8 shadow-sm" style={{ borderLeftColor: 'var(--color-primary)' }}>
        <div className="mb-6">
          <h2 className="font-display text-xl font-bold text-on-surface">Create assignment</h2>
          <p className="font-body text-sm text-on-surface-variant mt-1 student-text">Give the class a focused reading exercise without interrupting free practice.</p>
        </div>
        <form onSubmit={createAssignment} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="block">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">Title</span>
            <input required minLength={3} value={title} onChange={event => setTitle(event.target.value)} placeholder="Week 3 fluency check" className="mt-2 w-full glass-input px-4 py-3 rounded-xl student-text" />
          </label>
          <label className="block">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reading passage</span>
            <select required value={passageId} onChange={event => setPassageId(event.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl student-text">
              <option value="">Choose a passage</option>
              {passages.map(passage => <option key={passage.id} value={passage.id}>{passage.title}{passage.grade_level ? ` (Grade ${passage.grade_level})` : ''}</option>)}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">Instructions</span>
            <textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={3} placeholder="What should students focus on while they read?" className="mt-2 w-full glass-input px-4 py-3 rounded-xl resize-y student-text" />
          </label>
          <label className="block">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">Due date</span>
            <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="mt-2 w-full glass-input px-4 py-3 rounded-xl student-text" />
          </label>
          <fieldset className="block">
            <legend className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">Assign to</legend>
            <div className="mt-2 flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-on-surface student-text"><input type="radio" checked={scope === 'class'} onChange={() => setScope('class')} /> Whole class</label>
              <label className="inline-flex items-center gap-2 text-sm text-on-surface student-text"><input type="radio" checked={scope === 'selected'} onChange={() => setScope('selected')} /> Selected students</label>
            </div>
          </fieldset>
          {scope === 'selected' && (
            <div className="md:col-span-2 border border-surface-variant/50 rounded-xl p-4 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant">Students</p>
                <span className="font-body text-xs text-on-surface-variant student-text">{students.length} available</span>
              </div>
              <div className="space-y-2">
                {students.map(student => {
                  const topError = getTopErrorCategory(student);
                  const riskConfig = getRiskLevelConfig(student.health_risk_level);
                  const hasLearningPath = student.learning_path_status === 'active';
                  return (
                    <label key={student.id} className="stat-card-hover p-3 rounded-xl bg-white/50 hover:bg-white/70 border border-surface-variant/50 transition-colors cursor-pointer flex items-center gap-3">
                      <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} className="mt-0.5 accent-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="relative">
                            <span className="font-body font-medium text-on-surface truncate">{student.display_name}{student.grade_level ? ` (Grade ${student.grade_level})` : ''}</span>
                            {student.latest_health_score != null && (
                              <span className="absolute -top-1 -right-1">
                                <span className={`risk-dot ${riskConfig.dot}`} />
                              </span>
                            )}
                          </div>
                          {student.latest_health_score != null && (
                            <span className={`badge-risk ${riskConfig.badge}`}>
                              {riskConfig.label} ({student.latest_health_score})
                            </span>
                          )}
                          {hasLearningPath && (
                            <span className="px-2 py-0.5 rounded-full font-display text-[10px] font-bold uppercase tracking-wider bg-primary-container/30 text-primary">
                              Learning Path (Wk {student.learning_path_week})
                            </span>
                          )}
                        </div>
                        {topError && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-on-surface-variant student-text">
                            <span className="material-symbols-outlined text-[12px]">{topError.icon}</span>
                            <span>Top need: </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium badge-cat ${topError.style}`}>
                              {topError.label} ({topError.count})
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              {students.length === 0 && (
                <p className="font-body text-sm text-on-surface-variant text-center py-4 student-text">No students available in your class.</p>
              )}
            </div>
          )}
          <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-center">
            <button type="submit" disabled={submitting || (scope === 'selected' && selectedStudentIds.length === 0)} className="inline-flex items-center justify-center gap-2 btn-clay px-5 py-3 rounded-xl font-display text-sm font-bold disabled:opacity-50 cursor-pointer">
              <span className="material-symbols-outlined text-lg">assignment_add</span>
              {submitting ? 'Creating...' : 'Create assignment'}
            </button>
            {message && <p role="status" className="font-body text-sm text-on-surface-variant student-text">{message}</p>}
          </div>
        </form>
      </section>

      <section className="stat-card stat-card-hover p-6 md:p-8 shadow-sm" style={{ borderLeftColor: 'var(--color-secondary)' }}>
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-xl font-bold text-on-surface">Assignments</h2>
            <p className="font-body text-sm text-on-surface-variant mt-1 student-text">Completion and score progress for each activity.</p>
          </div>
          <span className="font-display text-sm font-bold text-primary">{assignments.length}</span>
        </div>
        {assignments.length === 0 ? (
          <div className="stat-card p-6 text-center bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/10">
            <DexAvatar state="idle" size="md" showCaptionBubble={true} caption="Create your first assignment to get started!" />
            <p className="font-body text-on-surface-variant mt-2 student-text">No assignments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(assignment => (
              <article key={assignment.id} className="stat-card stat-card-hover p-4 border border-white/80 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-shadow" style={{ borderLeftColor: 'var(--color-secondary)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary shrink-0 mt-0.5 shadow-inner">
                    <span className="material-symbols-outlined text-lg">assignment</span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-on-surface">{assignment.title}</h3>
                    <p className="font-body text-sm text-on-surface-variant mt-0.5 student-text">{assignment.passage_title} · {formatDueDate(assignment.due_date)}</p>
                    {assignment.instructions && <p className="font-body text-sm text-on-surface-variant mt-1 student-text">"{assignment.instructions}"</p>}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="font-display font-bold text-primary teacher-mono">{assignment.assigned_count}</p><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Assigned</p></div>
                    <div><p className="font-display font-bold text-primary teacher-mono">{assignment.completed_count}</p><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Finished</p></div>
                    <div><p className="font-display font-bold text-primary teacher-mono">{assignment.average_score ?? '-'}</p><p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Avg score</p></div>
                  </div>
                  <button onClick={() => showProgress(assignment.id)} className="inline-flex items-center gap-1 border border-primary/30 text-primary px-3 py-2 rounded-xl font-display text-xs font-bold whitespace-nowrap hover:bg-primary/5 transition-colors">
                    {detail?.assignment.id === assignment.id ? 'Hide progress' : 'View progress'}
                    <span className="material-symbols-outlined text-base">visibility</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {detailLoading && <p className="font-body text-sm text-on-surface-variant mt-5 student-text">Loading student progress...</p>}
        {detail && (
          <div className="mt-6 border-t border-surface-variant/50 pt-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-on-surface">{detail.assignment.title} progress</h3>
                <p className="font-body text-sm text-on-surface-variant student-text">Student scores and follow-up actions.</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-2 text-on-surface-variant hover:text-primary" aria-label="Close assignment progress">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-variant/50">
                    <th className="py-3 pr-3 font-display text-xs uppercase tracking-wider text-on-surface-variant">Student</th>
                    <th className="py-3 px-3 font-display text-xs uppercase tracking-wider text-on-surface-variant">Status</th>
                    <th className="py-3 px-3 font-display text-xs uppercase tracking-wider text-on-surface-variant">Score</th>
                    <th className="py-3 px-3 font-display text-xs uppercase tracking-wider text-on-surface-variant">Completed</th>
                    <th className="py-3 pl-3 font-display text-xs uppercase tracking-wider text-on-surface-variant text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.students.map(student => (
                    <tr key={student.id} className="border-b border-surface-variant/30 table-row-hover">
                      <td className="py-3 pr-3 font-body font-medium text-on-surface student-text">{student.display_name}{student.grade_level ? ` (Grade ${student.grade_level})` : ''}</td>
                      <td className="py-3 px-3 font-body text-sm text-on-surface-variant capitalize student-text">{student.status.replace('_', ' ')}</td>
                      <td className="py-3 px-3 font-display font-bold text-primary teacher-mono">{student.score != null ? `${student.score}/100` : '-'}</td>
                      <td className="py-3 px-3 font-body text-sm text-on-surface-variant student-text">{student.completed_at ? new Date(student.completed_at).toLocaleDateString() : '-'}</td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link to={`/copilot/${student.student_id}`} className="text-secondary font-display text-xs font-bold">Copilot</Link>
                          {student.session_id && <Link to={`/sessions/${student.session_id}/results`} className="text-primary font-display text-xs font-bold">Results</Link>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}