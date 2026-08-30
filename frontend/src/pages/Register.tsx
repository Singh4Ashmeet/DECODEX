import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { apiFetch } from '../lib/api';
import decodexLogo from '../assets/decodex-logo.jpg';

type AccountType = 'student' | 'parent';
const fieldControlClass = 'h-12 w-full glass-input rounded-xl px-4 font-body text-base text-on-surface outline-none transition-all focus:outline-none';

export default function Register() {
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    display_name: '',
    grade_level: 1,
    date_of_birth: '',
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!agreeTerms) {
      toast.error('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setSubmitting(true);

    try {
      const endpoint = accountType === 'parent' ? '/auth/register/parent' : '/auth/register';
      const body = accountType === 'parent'
        ? {
            email: formData.email,
            password: formData.password,
            display_name: formData.display_name,
          }
        : formData;

      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      navigate('/login');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-transparent px-4 py-8 flex items-center justify-center text-on-surface">
      {/* Subtle dot pattern background */}
      <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#006474 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      
      <motion.main 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto w-full max-w-[480px] glass-card rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,100,116,0.10)] relative z-10"
      >
        <div className="mb-6 text-center flex flex-col items-center">
          <img alt="Decodex Logo" className="w-20 h-20 object-contain mb-2 drop-shadow-sm" src={decodexLogo} />
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Decodex Account</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-primary">Create Your Account</h1>
          <p className="mt-1 font-body text-sm text-on-surface-variant">Choose the account that fits how you use Decodex.</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-surface-container/60 p-1 backdrop-blur-md" role="tablist" aria-label="Account type">
          {(['student', 'parent'] as AccountType[]).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={accountType === type}
              onClick={() => setAccountType(type)}
              className={`rounded-lg px-4 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-200 cursor-pointer ${
                accountType === type
                  ? 'bg-white text-primary shadow-md'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={accountType === 'parent' ? 'Your Name' : 'Student Name'} id="display-name">
            <input
              id="display-name"
              value={formData.display_name}
              onChange={(event) => setFormData({ ...formData, display_name: event.target.value })}
              className={fieldControlClass}
              autoComplete="name"
              placeholder="e.g. Alex Smith"
              required
            />
          </Field>
          <Field label="Email Address" id="email">
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              className={fieldControlClass}
              autoComplete="email"
              placeholder="alex@example.com"
              required
            />
          </Field>
          <Field label="Password" id="password" hint="Minimum 8 characters">
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(event) => setFormData({ ...formData, password: event.target.value })}
              className={fieldControlClass}
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </Field>
          {accountType === 'student' ? (
            <>
            <Field
              label="Grade Level"
              id="grade-level"
              hint="Used to calibrate reading speed and passage complexity."
            >
              <select
                id="grade-level"
                value={formData.grade_level}
                onChange={(event) => setFormData({ ...formData, grade_level: Number(event.target.value) })}
                className={fieldControlClass}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade} (Class {grade})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Date of Birth"
              id="date-of-birth"
              hint="Required for parental consent verification."
            >
              <input
                id="date-of-birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(event) => setFormData({ ...formData, date_of_birth: event.target.value })}
                className={fieldControlClass}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </Field>
            </>
          ) : null}

          <div className="flex items-start gap-3 mt-1">
            <input
              id="agree-terms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(event) => setAgreeTerms(event.target.checked)}
              required
              className="mt-0.5 h-4 w-4 rounded border-2 border-surface-variant text-primary focus:ring-primary cursor-pointer shrink-0"
            />
            <label htmlFor="agree-terms" className="font-body text-xs text-on-surface-variant leading-relaxed">
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="text-primary font-bold hover:underline">
                Terms of Service
              </Link>{' '}
              and acknowledge the{' '}
              <Link to="/privacy" target="_blank" className="text-primary font-bold hover:underline">
                Privacy Policy
              </Link>.
            </label>
          </div>

          <motion.button 
            whileHover={!submitting ? { scale: 1.02 } : {}} 
            whileTap={!submitting ? { scale: 0.98 } : {}}
            disabled={submitting} 
            className="mt-2 h-12 rounded-full btn-clay font-display text-base font-bold disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Creating account…' : `Create ${accountType} Account`}
          </motion.button>
        </form>

        {/* Compact Dex encouragement for student registration */}
        {accountType === 'student' && (
          <div className="mt-5 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/10">
            <span className="material-symbols-outlined text-2xl text-primary" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
            <p className="font-body text-xs text-on-surface-variant leading-snug">Welcome to Decodex! Let's start your reading adventure! 🌟</p>
          </div>
        )}

        <p className="mt-5 text-center font-body text-sm text-on-surface-variant">
          Already have an account? <Link to="/login" className="font-bold text-primary underline decoration-2 underline-offset-4">Log in</Link>
        </p>
      </motion.main>
    </div>
  );
}

function Field({ children, hint, id, label }: { children: ReactNode; hint?: string; id: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">{label}</label>
      {children}
      {hint ? <p className="font-body text-[11px] text-on-surface-variant leading-normal">{hint}</p> : null}
    </div>
  );
}