import React, { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useReadingPreferences, type ReadingPreferences, DEFAULT_PREFERENCES } from '../hooks/useReadingPreferences';

interface ReadingPreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReadingPreferencesPanel({ isOpen, onClose }: ReadingPreferencesPanelProps) {
  const { preferences, loading, updatePreferences, resetToDefaults } = useReadingPreferences();
  const [localPrefs, setLocalPrefs] = useState<ReadingPreferences>(preferences);

  const previewText = "The quick brown fox jumps over the lazy dog. She reads each word with care and confidence.";

  const handleFontScaleChange = (value: number) => {
    const clamped = Math.max(0.85, Math.min(1.5, value));
    const newPrefs = { ...localPrefs, fontScale: clamped };
    setLocalPrefs(newPrefs);
    updatePreferences({ fontScale: clamped });
  };

  const handleLineSpacingChange = (value: number) => {
    const clamped = Math.max(1, Math.min(2, value));
    const newPrefs = { ...localPrefs, lineSpacing: clamped };
    setLocalPrefs(newPrefs);
    updatePreferences({ lineSpacing: clamped });
  };

  const handleLetterSpacingChange = (value: number) => {
    const clamped = Math.max(0, Math.min(0.05, value));
    const newPrefs = { ...localPrefs, letterSpacing: clamped };
    setLocalPrefs(newPrefs);
    updatePreferences({ letterSpacing: clamped });
  };

  const handleReset = () => {
    setLocalPrefs(DEFAULT_PREFERENCES);
    resetToDefaults();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="prefs-title">
      <div
        className="glass-card w-full max-w-md rounded-3xl p-6 sm:p-8 border border-white/80 shadow-2xl bg-white/95 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="prefs-title" className="font-display text-2xl font-bold text-on-surface">Reading Preferences</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Close preferences"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview */}
        <div className="mb-6 p-4 rounded-2xl bg-surface-container-low border border-surface-container-high">
          <p
            className="font-body text-on-surface"
            style={{
              fontSize: `${20 * localPrefs.fontScale}px`,
              lineHeight: localPrefs.lineSpacing,
              letterSpacing: `${localPrefs.letterSpacing}em`,
            }}
          >
            {previewText}
          </p>
          <p className="font-body text-xs text-on-surface-variant mt-2 text-center">Live preview</p>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          {/* Font Scale */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="font-scale" className="font-display text-sm font-bold text-on-surface">Font Size</label>
              <span className="font-body text-sm text-on-surface-variant font-mono">{Math.round(localPrefs.fontScale * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleFontScaleChange(localPrefs.fontScale - 0.05)}
                disabled={localPrefs.fontScale <= 0.85 || loading}
                className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Decrease font size"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
              <input
                id="font-scale"
                type="range"
                min="0.85"
                max="1.5"
                step="0.05"
                value={localPrefs.fontScale}
                onChange={(e) => handleFontScaleChange(parseFloat(e.target.value))}
                disabled={loading}
                className="flex-1 h-2 bg-surface-container-high rounded-full appearance-none accent-primary cursor-pointer"
                aria-label="Font size slider"
              />
              <button
                onClick={() => handleFontScaleChange(localPrefs.fontScale + 0.05)}
                disabled={localPrefs.fontScale >= 1.5 || loading}
                className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Increase font size"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-1 text-center">85% – 150%</p>
          </div>

          {/* Line Spacing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="line-spacing" className="font-display text-sm font-bold text-on-surface">Line Spacing</label>
              <span className="font-body text-sm text-on-surface-variant font-mono">{localPrefs.lineSpacing.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleLineSpacingChange(localPrefs.lineSpacing - 0.1)}
                disabled={localPrefs.lineSpacing <= 1 || loading}
                className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Decrease line spacing"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
              <input
                id="line-spacing"
                type="range"
                min="1"
                max="2"
                step="0.1"
                value={localPrefs.lineSpacing}
                onChange={(e) => handleLineSpacingChange(parseFloat(e.target.value))}
                disabled={loading}
                className="flex-1 h-2 bg-surface-container-high rounded-full appearance-none accent-primary cursor-pointer"
                aria-label="Line spacing slider"
              />
              <button
                onClick={() => handleLineSpacingChange(localPrefs.lineSpacing + 0.1)}
                disabled={localPrefs.lineSpacing >= 2 || loading}
                className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Increase line spacing"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-1 text-center">1.0 – 2.0</p>
          </div>

          {/* Letter Spacing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="letter-spacing" className="font-display text-sm font-bold text-on-surface">Letter Spacing</label>
              <span className="font-body text-sm text-on-surface-variant font-mono">{localPrefs.letterSpacing.toFixed(3)}em</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleLetterSpacingChange(localPrefs.letterSpacing - 0.005)}
                disabled={localPrefs.letterSpacing <= 0 || loading}
                className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Decrease letter spacing"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
              <input
                id="letter-spacing"
                type="range"
                min="0"
                max="0.05"
                step="0.005"
                value={localPrefs.letterSpacing}
                onChange={(e) => handleLetterSpacingChange(parseFloat(e.target.value))}
                disabled={loading}
                className="flex-1 h-2 bg-surface-container-high rounded-full appearance-none accent-primary cursor-pointer"
                aria-label="Letter spacing slider"
              />
              <button
                onClick={() => handleLetterSpacingChange(localPrefs.letterSpacing + 0.005)}
                disabled={localPrefs.letterSpacing >= 0.05 || loading}
                className="p-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Increase letter spacing"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
            </div>
            <p className="font-body text-xs text-on-surface-variant mt-1 text-center">0 – 0.05em</p>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          disabled={loading}
          className="mt-6 w-full py-3 px-4 rounded-2xl bg-surface-container-high text-on-surface-variant font-display text-sm font-bold uppercase tracking-wider hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Default
        </button>

        <p className="font-body text-xs text-on-surface-variant mt-4 text-center">
          Preferences are saved to your account and sync across devices.
        </p>
      </div>
    </div>
  );
}