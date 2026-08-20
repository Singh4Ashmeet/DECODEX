import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApiQuery } from '../lib/api';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import AssignmentManager from '../components/AssignmentManager';

export default function TeacherDashboard() {
  const { data, loading, error } = useApiQuery<any>('/teacher/students');
  const { data: heatmapData } = useApiQuery<any>('/classroom/heatmap');
  const { data: weaknessData } = useApiQuery<any>('/classroom/weaknesses');
  const { data: skillData } = useApiQuery<any>('/classroom/skill-distribution');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'assignments' | 'heatmap' | 'weaknesses'>('students');

  if (loading) return (
    <div className="flex-grow w-full max-w-max-content-width mx-auto px-4 py-8">
      <Skeleton className="h-28 w-64 mb-10" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
      <Skeleton className="h-12 w-full mb-6" />
      <SkeletonText lines={10} className="w-full" />
    </div>
  );
  if (error) return <div className="p-8 text-center text-error font-body">Error: {error.message}</div>;

  const allStudents: any[] = data?.students ?? [];
  const filteredStudents = searchQuery.trim()
    ? allStudents.filter(s =>
        s.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allStudents;

  const heatmap = heatmapData?.heatmap || [];
  const weaknesses = weaknessData?.weaknesses || [];
  const skillDist = skillData?.distribution;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const riskTierConfig = {
    excellent: { label: 'Excellent', count: skillDist?.excellent ?? 0, bg: 'var(--risk-excellent-bg)', text: 'var(--risk-excellent-text)', border: 'var(--risk-excellent-border)', icon: 'sentiment_very_satisfied' },
    good: { label: 'Good', count: skillDist?.good ?? 0, bg: 'var(--risk-good-bg)', text: 'var(--risk-good-text)', border: 'var(--risk-good-border)', icon: 'sentiment_satisfied' },
    medium: { label: 'Medium', count: skillDist?.medium ?? 0, bg: 'var(--risk-medium-bg)', text: 'var(--risk-medium-text)', border: 'var(--risk-medium-border)', icon: 'sentiment_neutral' },
    high: { label: 'High Risk', count: skillDist?.high ?? 0, bg: 'var(--risk-high-bg)', text: 'var(--risk-high-text)', border: 'var(--risk-high-border)', icon: 'sentiment_dissatisfied' },
    critical: { label: 'Critical', count: skillDist?.critical ?? 0, bg: 'var(--risk-critical-bg)', text: 'var(--risk-critical-text)', border: 'var(--risk-critical-border)', icon: 'sentiment_very_dissatisfied' },
  };

  const riskLevels = ['excellent', 'good', 'medium', 'high', 'critical'] as const;

  return (
    <motion.main
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="flex-grow w-full max-w-max-content-width mx-auto px-4 py-6 sm:py-8 text-on-surface"
    >
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-container/20 flex items-center justify-center text-primary shadow-inner">
            <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
          </div>
          <div>
            <h1 className="font-display text-[28px] sm:text-[36px] font-extrabold text-primary">My Classroom</h1>
            <p className="text-on-surface-variant font-body text-sm sm:text-base mt-1 tracking-wide">Classroom Analytics & AI Copilot Hub</p>
          </div>
        </div>
      </motion.div>

      {/* Risk Overview Cards Row — using stat-card pattern */}
      {skillDist && (
        <motion.div variants={itemVariants} className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {riskLevels.map((tier) => {
              const config = riskTierConfig[tier];
              const isCritical = tier === 'critical';
              return (
                <motion.div
                  key={tier}
                  className={`stat-card stat-card-border stat-card-hover text-center ${isCritical ? 'sm:col-span-1' : ''}`}
                  style={{
                    borderLeftColor: config.border,
                  } as React.CSSProperties}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="material-symbols-outlined text-2xl" style={{ color: config.border }}>{config.icon}</span>
                    <p className="stat-value teacher-mono" style={{ color: config.text }}>{config.count}</p>
                    <p className="stat-label" style={{ color: config.text }}>{config.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Tabs — pill style with active indicator */}
      <motion.div variants={itemVariants} className="flex gap-1 mb-5 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer rounded-xl ${
            activeTab === 'students' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-primary'
          }`}
        >
          Students ({allStudents.length})
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer rounded-xl ${
            activeTab === 'assignments' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-primary'
          }`}
        >
          Assignments
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer rounded-xl ${
            activeTab === 'heatmap' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-primary'
          }`}
        >
          Error Heatmap
        </button>
        <button
          onClick={() => setActiveTab('weaknesses')}
          className={`px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer rounded-xl ${
            activeTab === 'weaknesses' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-primary'
          }`}
        >
          Class Weaknesses
        </button>
      </motion.div>

      {activeTab === 'students' && (
        <motion.div variants={itemVariants} className="glass-card rounded-3xl border border-white/85 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="font-display text-xs font-bold tracking-[0.08em] bg-white/80 border border-surface-variant/40 px-3 py-1 rounded-full uppercase">All Students ({allStudents.length})</span>
              {searchQuery && (
                <span className="font-display text-xs font-bold tracking-[0.08em] bg-secondary/10 border border-secondary/20 px-3 py-1 rounded-full text-secondary uppercase">
                  Filtered ({filteredStudents.length})
                </span>
              )}
            </div>
            <div className="relative w-full sm:w-auto">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input
                type="text"
                placeholder="Search student name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-72 glass-input pl-12 pr-4 py-3 rounded-2xl text-body font-body placeholder:text-outline/70 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Desktop Table View — enhanced with risk dots, alternating rows, and visual hierarchy */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-white/60">
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase">Student</th>
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase">Grade</th>
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase text-right">Sessions</th>
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase text-right">Avg WPM</th>
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase">Accuracy</th>
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase">Risk Tier</th>
                  <th className="py-4 px-4 font-display text-[12px] font-bold text-outline tracking-[0.08em] uppercase text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show" className="divide-y divide-white/40">
                {filteredStudents.map((student: any, rowIndex: number) => {
                  const initials = student.display_name?.substring(0, 2).toUpperCase() || 'ST';
                  const riskLevel = student.health_risk_level || 'medium';
                  const riskDotClasses = {
                    excellent: 'risk-dot-excellent',
                    good: 'risk-dot-good',
                    medium: 'risk-dot-medium',
                    high: 'risk-dot-high',
                    critical: 'risk-dot-critical',
                  };
                  const riskDotClass = riskDotClasses[riskLevel as keyof typeof riskDotClasses] || 'risk-dot-medium';
                  const accuracy = student.avg_error_rate != null ? 100 - Math.round(student.avg_error_rate * 100) : 0;
                  const accuracyColor = accuracy >= 90 ? 'var(--risk-excellent-border)' : accuracy >= 75 ? 'var(--risk-good-border)' : accuracy >= 60 ? 'var(--risk-medium-border)' : accuracy >= 40 ? 'var(--risk-high-border)' : 'var(--risk-critical-border)';
                  const riskBadgeClasses = {
                    excellent: 'risk-excellent',
                    good: 'risk-good',
                    medium: 'risk-medium',
                    high: 'risk-high',
                    critical: 'risk-critical',
                  };
                  const riskBadgeClass = riskBadgeClasses[riskLevel as keyof typeof riskBadgeClasses] || 'risk-medium';
                  return (
                    <motion.tr variants={itemVariants} key={student.id} className={`table-row-hover group ${rowIndex % 2 === 0 ? 'bg-white/20' : ''}`}>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center font-bold font-display text-sm shadow-inner">{initials}</div>
                            <span className={`risk-dot absolute -bottom-1 -right-1 ${riskDotClass}`} title={`Risk: ${riskLevel}`} />
                          </div>
                          <span className="font-bold text-on-background group-hover:text-primary transition-colors">{student.display_name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-on-surface-variant font-body">{student.grade_level ?? '—'}</td>
                      <td className="py-4 px-3 text-right font-mono font-medium teacher-mono">{student.session_count}</td>
                      <td className="py-4 px-3 text-right font-mono font-medium teacher-mono">
                        {student.avg_wpm != null ? Math.round(student.avg_wpm) : '—'}
                      </td>
                      <td className="py-4 px-3 font-body">
                        {student.avg_error_rate != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-white/60 border border-white/80 rounded-full h-2 max-w-[80px]">
                              <div className="progress-bar-fill" style={{ width: `${accuracy}%`, backgroundColor: accuracyColor }}></div>
                            </div>
                            <span className="font-semibold text-sm font-mono teacher-mono" style={{ color: accuracyColor }}>{accuracy}%</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4 px-3">
                        <span className={`badge-risk ${riskBadgeClass}`}>{riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}</span>
                      </td>
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/copilot/${student.id}`}
                            className="inline-flex items-center gap-1 font-display text-xs font-bold text-secondary bg-secondary-container/20 hover:bg-secondary-container/40 px-3 py-1.5 rounded-full transition-all uppercase tracking-[0.08em]"
                          >
                            <span className="material-symbols-outlined text-[16px]">smart_toy</span> Copilot
                          </Link>
                          <Link
                            to={`/teacher/student/${student.id}`}
                            className="inline-flex items-center gap-1 font-display text-xs font-bold text-primary hover:text-primary-container px-3 py-1.5 rounded-full hover:bg-primary/10 transition-all uppercase tracking-[0.08em]"
                          >
                            Profile <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                          </Link>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredStudents.map((student: any) => {
              const initials = student.display_name?.substring(0, 2).toUpperCase() || 'ST';
              const riskLevel = student.health_risk_level || 'medium';
              const riskDotClasses = {
                excellent: 'risk-dot-excellent',
                good: 'risk-dot-good',
                medium: 'risk-dot-medium',
                high: 'risk-dot-high',
                critical: 'risk-dot-critical',
              };
              const riskDotClass = riskDotClasses[riskLevel as keyof typeof riskDotClasses] || 'risk-dot-medium';
              const accuracy = student.avg_error_rate != null ? 100 - Math.round(student.avg_error_rate * 100) : 0;
              const riskBadgeClasses = {
                excellent: 'risk-excellent',
                good: 'risk-good',
                medium: 'risk-medium',
                high: 'risk-high',
                critical: 'risk-critical',
              };
              const riskBadgeClass = riskBadgeClasses[riskLevel as keyof typeof riskBadgeClasses] || 'risk-medium';
              return (
                <motion.div variants={itemVariants} key={student.id} className="glass-card p-4 border border-white/80">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center font-bold font-display text-sm shadow-inner">{initials}</div>
                        <span className={`risk-dot absolute -bottom-1 -right-1 ${riskDotClass}`} />
                      </div>
                      <div>
                        <span className="font-bold text-on-background">{student.display_name}</span>
                        {student.grade_level && <span className="font-body text-xs text-on-surface-variant ml-2">Grade {student.grade_level}</span>}
                      </div>
                    </div>
                    <span className={`badge-risk ${riskBadgeClass} shrink-0`}>{riskLevel}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-3">
                    <div className="p-2 rounded-xl bg-white/50">
                      <p className="font-display font-bold teacher-mono text-primary">{student.session_count}</p>
                      <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Sessions</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/50">
                      <p className="font-display font-bold teacher-mono text-primary">{student.avg_wpm != null ? Math.round(student.avg_wpm) : '—'}</p>
                      <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Avg WPM</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/50">
                      <p className="font-display font-bold teacher-mono" style={{ color: accuracy >= 90 ? 'var(--risk-excellent-border)' : accuracy >= 75 ? 'var(--risk-good-border)' : accuracy >= 60 ? 'var(--risk-medium-border)' : accuracy >= 40 ? 'var(--risk-high-border)' : 'var(--risk-critical-border)' }}>{accuracy}%</p>
                      <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">Accuracy</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/40">
                    <Link
                      to={`/copilot/${student.id}`}
                      className="inline-flex items-center gap-1 font-display text-xs font-bold text-secondary bg-secondary-container/20 hover:bg-secondary-container/40 px-3 py-1.5 rounded-full transition-all uppercase tracking-[0.08em]"
                    >
                      <span className="material-symbols-outlined text-[16px]">smart_toy</span> Copilot
                    </Link>
                    <Link
                      to={`/teacher/student/${student.id}`}
                      className="inline-flex items-center gap-1 font-display text-xs font-bold text-primary hover:text-primary-container px-3 py-1.5 rounded-full hover:bg-primary/10 transition-all uppercase tracking-[0.08em]"
                    >
                      Profile <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {activeTab === 'assignments' && (
        <motion.div variants={itemVariants}>
          <AssignmentManager />
        </motion.div>
      )}

      {/* Heatmap Tab — using semantic category colors */}
      {activeTab === 'heatmap' && (
        <motion.div variants={itemVariants} className="glass-card rounded-3xl border border-white/85 p-6 md:p-8 shadow-sm overflow-x-auto">
          <h2 className="font-display text-xl font-bold text-on-surface mb-4">Orton-Gillingham Error Distribution Heatmap</h2>
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-white/60">
                <th className="py-3 px-3 font-display text-[11px] font-bold text-outline uppercase">Student</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-purple-700 uppercase text-center badge-cat cat-rev">REV</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-amber-700 uppercase text-center badge-cat cat-sub">SUB</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-emerald-700 uppercase text-center badge-cat cat-omi">OMI</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-orange-700 uppercase text-center badge-cat cat-ins">INS</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-blue-700 uppercase text-center badge-cat cat-bld">BLD</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-indigo-700 uppercase text-center badge-cat cat-pac">PAC</th>
                <th className="py-3 px-3 font-display text-[11px] font-bold text-primary uppercase text-center">Health Score</th>
              </tr>
            </thead>
            <motion.tbody variants={containerVariants} initial="hidden" animate="show" className="divide-y divide-white/40">
              {heatmap.map((row: any) => (
                <motion.tr variants={itemVariants} key={row.studentId} className="table-row-hover">
                  <td className="py-3 px-3 font-bold text-on-surface font-display">{row.studentName}</td>
                  <td className={`py-3 px-3 text-center font-bold teacher-mono ${row.rev > 2 ? 'badge-cat cat-rev' : 'text-on-surface-variant'}`}>{row.rev}</td>
                  <td className={`py-3 px-3 text-center font-bold teacher-mono ${row.sub > 4 ? 'badge-cat cat-sub' : 'text-on-surface-variant'}`}>{row.sub}</td>
                  <td className={`py-3 px-3 text-center font-bold teacher-mono ${row.omi > 2 ? 'badge-cat cat-omi' : 'text-on-surface-variant'}`}>{row.omi}</td>
                  <td className={`py-3 px-3 text-center font-bold teacher-mono ${row.ins > 2 ? 'badge-cat cat-ins' : 'text-on-surface-variant'}`}>{row.ins}</td>
                  <td className={`py-3 px-3 text-center font-bold teacher-mono ${row.bld > 2 ? 'badge-cat cat-bld' : 'text-on-surface-variant'}`}>{row.bld}</td>
                  <td className={`py-3 px-3 text-center font-bold teacher-mono ${row.pac > 2 ? 'badge-cat cat-pac' : 'text-on-surface-variant'}`}>{row.pac}</td>
                  <td className="py-3 px-3 text-center font-extrabold text-primary font-display teacher-mono">{row.healthScore ?? '—'}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </motion.div>
      )}

      {/* Weaknesses Tab — enhanced with category colors and visual hierarchy */}
      {activeTab === 'weaknesses' && (
        <motion.div variants={itemVariants} className="glass-card rounded-3xl border border-white/85 p-6 md:p-8 shadow-sm space-y-4">
          <h2 className="font-display text-xl font-bold text-on-surface mb-2">Class-Wide Error Analysis</h2>
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {weaknesses.map((w: any) => {
              const categoryStyles: Record<string, string> = {
                REV: 'cat-rev',
                SUB: 'cat-sub',
                OMI: 'cat-omi',
                INS: 'cat-ins',
                BLD: 'cat-bld',
                PAC: 'cat-pac',
                UNC: 'cat-unc',
              };
              const styleClass = categoryStyles[w.category] || 'cat-unc';
              const categoryIcons: Record<string, string> = {
                REV: 'swap_horiz',
                SUB: 'find_replace',
                OMI: 'playlist_remove',
                INS: 'playlist_add',
                BLD: 'blend',
                PAC: 'pace',
                UNC: 'help',
              };
              return (
                <motion.div variants={itemVariants} key={w.category} className="p-4 rounded-2xl glass-card border border-white/80 flex items-center justify-between gap-4 table-row-hover">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center badge-cat ${styleClass} shadow-inner`}>
                      <span className="material-symbols-outlined text-[20px]">{categoryIcons[w.category] || 'psychology'}</span>
                    </div>
                    <div>
                      <span className="font-display text-sm font-bold text-on-surface">{w.categoryName} ({w.category})</span>
                      <p className="font-body text-xs text-on-surface-variant">{w.affectedStudents} student(s) affected ({w.percentageOfClass}% of class)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-2xl font-extrabold text-primary teacher-mono">{w.totalOccurrences}</span>
                    <p className="font-body text-[10px] text-on-surface-variant uppercase tracking-wider">total errors</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </motion.main>
  );
}