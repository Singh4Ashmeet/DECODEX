import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApiQuery } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import DexAvatar from '../components/DexAvatar';

export default function StudentDetail() {
  const { id } = useParams();
  const { data: trendsData, loading } = useApiQuery<any>(`/teacher/students/${id}/trends`);
  const { data: studentData } = useApiQuery<any>(`/teacher/students/${id}`);

  const student = studentData?.student;

  if (loading) return <div className="p-8 text-center text-on-surface-variant font-body student-text">Loading student data...</div>;
  if (!student) return <div className="p-8 text-center text-error font-body student-text">Student not found.</div>;

  const riskLevel = student.health_risk_level || 'medium';
  const riskBadgeClasses = {
    excellent: 'risk-excellent',
    good: 'risk-good',
    medium: 'risk-medium',
    high: 'risk-high',
    critical: 'risk-critical',
  };
  const riskBadgeClass = riskBadgeClasses[riskLevel as keyof typeof riskBadgeClasses] || 'risk-medium';
  const riskDotClasses = {
    excellent: 'risk-dot-excellent',
    good: 'risk-dot-good',
    medium: 'risk-dot-medium',
    high: 'risk-dot-high',
    critical: 'risk-dot-critical',
  };
  const riskDotClass = riskDotClasses[riskLevel as keyof typeof riskDotClasses] || 'risk-dot-medium';

  return (
    <main className="flex-grow w-full max-w-max-content-width mx-auto px-container-padding py-8 sm:py-12 text-on-surface">
      <Link to="/teacher/dashboard" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary font-display text-sm font-bold tracking-[0.08em] uppercase transition-all group mb-6">
        <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
        Back to Classroom
      </Link>

      {/* Student Header */}
      <div className="stat-card stat-card-hover rounded-3xl p-6 sm:p-8 border border-white/80 shadow-sm mb-8 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0">
          <div className="w-24 h-24 rounded-2xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center font-bold font-display text-2xl shadow-inner">
            {student.display_name?.substring(0, 2).toUpperCase() || 'ST'}
          </div>
          <span className={`risk-dot absolute -bottom-1 -right-1 ${riskDotClass}`} title={`Risk: ${riskLevel}`} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-primary">{student.display_name}</h1>
            <span className={`badge-risk ${riskBadgeClass}`}>{riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}</span>
          </div>
          <p className="font-body text-base text-on-surface-variant student-text">
            Grade {student.grade_level ?? '—'} • {student.session_count ?? 0} sessions • Avg WPM: {student.avg_wpm ? Math.round(student.avg_wpm) : '—'}
          </p>
        </div>
        <DexAvatar state="idle" size="sm" showCaptionBubble={false} />
      </div>

      {trendsData?.trends && trendsData.trends.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-card-gap mb-8">
            <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm flex flex-col" style={{ borderLeftColor: 'var(--color-primary)' }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Reading Speed (WPM)</h3>
                <span className="material-symbols-outlined text-primary">trending_up</span>
              </div>
              <div className="h-64 flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendsData.trends.map((t: any, i: number) => ({ name: `S${i+1}`, wpm: t.words_per_minute != null ? Math.round(t.words_per_minute) : 0 }))}>
                    <defs>
                      <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1d8d4" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                    <Tooltip contentStyle={{ borderRadius: '16px', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255, 255, 255, 0.8)', boxShadow: '0 8px 24px rgba(45, 41, 38, 0.1)', fontFamily: 'var(--font-body)' }} />
                    <Area type="monotone" dataKey="wpm" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#wpmGradient)" />
                    <Line type="monotone" dataKey="wpm" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-primary)' }} activeDot={{ r: 6, fill: 'var(--color-primary)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="stat-card stat-card-hover p-6 sm:p-8 border border-white/80 shadow-sm flex flex-col" style={{ borderLeftColor: 'var(--color-tertiary)' }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Error Rate (%)</h3>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-tertiary)' }}>trending_down</span>
              </div>
              <div className="h-64 flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendsData.trends.map((t: any, i: number) => ({ name: `S${i+1}`, errorRate: Math.round(t.error_rate * 100) }))}>
                    <defs>
                      <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-tertiary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-tertiary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1d8d4" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6f797c', fontFamily: 'var(--font-display)'}} />
                    <Tooltip contentStyle={{ borderRadius: '16px', background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(255, 255, 255, 0.8)', boxShadow: '0 8px 24px rgba(45, 41, 38, 0.1)', fontFamily: 'var(--font-body)' }} />
                    <Area type="monotone" dataKey="errorRate" stroke="var(--color-tertiary)" strokeWidth={3} fillOpacity={1} fill="url(#errorGradient)" />
                    <Line type="monotone" dataKey="errorRate" stroke="var(--color-tertiary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-tertiary)' }} activeDot={{ r: 6, fill: 'var(--color-tertiary)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="stat-card stat-card-hover p-6 border border-white/80 shadow-sm" style={{ borderLeftColor: 'var(--color-accent)' }}>
            <h2 className="font-display text-xl font-bold text-on-surface mb-6">Error Pattern Analysis</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'rev_count', label: 'Reversals', color: 'cat-rev', icon: 'swap_horiz' },
                { key: 'sub_count', label: 'Substitutions', color: 'cat-sub', icon: 'find_replace' },
                { key: 'omi_count', label: 'Omissions', color: 'cat-omi', icon: 'playlist_remove' },
                { key: 'ins_count', label: 'Insertions', color: 'cat-ins', icon: 'playlist_add' },
              ].map(({ key, label, color, icon }) => {
                const count = student[key] ?? 0;
                return (
                  <div key={key} className={`p-4 rounded-2xl border border-white/80 stat-card text-center badge-cat ${color}`}>
                    <span className="material-symbols-outlined text-2xl mb-1">{icon}</span>
                    <p className="font-display text-2xl font-extrabold teacher-mono">{count}</p>
                    <p className="font-display text-[10px] font-bold uppercase tracking-wider">{label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="stat-card stat-card-hover p-8 border border-white/80 text-center font-body text-on-surface-variant shadow-sm flex flex-col items-center justify-center student-text">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-primary-container/20 text-primary flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>bar_chart</span>
          </div>
          <p className="text-lg">No reading sessions completed by this student yet.</p>
          <DexAvatar state="concerned" size="md" showCaptionBubble={true} caption="Every reading journey starts with one word! Let's help them begin." className="mt-6" />
        </div>
      )}
    </main>
  );
}