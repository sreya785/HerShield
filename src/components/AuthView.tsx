import React, { useState } from 'react';
import { Shield, Lock, UserPlus, LogIn, Building2 } from 'lucide-react';
import { UserProfile } from '../types/safety';
import { validateProfileInput } from '../utils/safetyEngine';
import {
  loginPrototypeUser,
  quickLoginDemoRole,
  registerPrototypeStudent,
} from '../services/safetyStore';

interface AuthViewProps {
  onPrototypeLogin: (user: UserProfile) => void;
  onGoogleLogin: () => Promise<void>;
  googleLoading: boolean;
  googleError: string | null;
  pendingFirebaseUser?: {
    uid: string;
    email: string;
    displayName: string;
  } | null;
  onCompleteFirebaseProfile?: (data: {
    displayName: string;
    studentId: string;
    department: string;
    phone: string;
    commuteRoute: string;
  }) => Promise<void>;
}

export function AuthView({
  onPrototypeLogin,
  onGoogleLogin,
  googleLoading,
  googleError,
  pendingFirebaseUser,
  onCompleteFirebaseProfile,
}: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(pendingFirebaseUser?.displayName || '');
  const [department, setDepartment] = useState('Software Engineering');
  const [email, setEmail] = useState(pendingFirebaseUser?.email || '');
  const [phone, setPhone] = useState('');
  const [commuteRoute, setCommuteRoute] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!studentId.trim() || !password.trim()) {
      setFormError('Please enter both your Student / Badge ID and password.');
      return;
    }
    const res = loginPrototypeUser(studentId, password);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    if (res.user) {
      onPrototypeLogin(res.user);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const validationError = validateProfileInput({
      displayName,
      studentId,
      department,
      phone,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    const res = registerPrototypeStudent({
      displayName,
      studentId,
      department,
      email,
      phone,
      commuteRoute,
      password,
    });
    if (res.error) {
      setFormError(res.error);
      return;
    }
    if (res.user) {
      onPrototypeLogin(res.user);
    }
  };

  const handleCompleteGoogleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCompleteFirebaseProfile) return;
    setFormError(null);
    const validationError = validateProfileInput({
      displayName,
      studentId,
      department,
      phone,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      await onCompleteFirebaseProfile({
        displayName,
        studentId,
        department,
        phone,
        commuteRoute,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save student profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingFirebaseUser) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Complete Student Registration</h1>
              <p className="text-xs text-slate-400">Signed in as {pendingFirebaseUser.email}</p>
            </div>
          </div>

          <form onSubmit={handleCompleteGoogleProfile} className="space-y-4">
            <div>
              <label htmlFor="fb-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                id="fb-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Sreya Roy"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="fb-sid" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Student ID
                </label>
                <input
                  id="fb-sid"
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g., 2305341433"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="fb-dept" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Department
                </label>
                <input
                  id="fb-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="fb-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Phone Number
                </label>
                <input
                  id="fb-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1711-000000"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="fb-route" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Primary Commute Route
                </label>
                <input
                  id="fb-route"
                  type="text"
                  value={commuteRoute}
                  onChange={(e) => setCommuteRoute(e.target.value)}
                  placeholder="South Dorms -> Main Gate"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving Profile…' : 'Complete Registration'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Context Column */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#111827] border border-slate-800 rounded-xl p-6 sm:p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-100">CampusShield</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 [text-wrap:balance]">
                Campus Safety, Coordinated in Seconds
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Check sector safety before you walk, plan well-lit routes, notify trusted contacts, and connect with campus security in one calm workspace.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <h2 className="text-xs font-medium text-slate-400">One-Click Role Preview</h2>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => onPrototypeLogin(quickLoginDemoRole('student'))}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-blue-500/60 text-left transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">Student Portal (Sreya Roy)</div>
                    <div className="text-xs text-slate-400 font-mono">ID: 2305341433 · Software Engineering</div>
                  </div>
                  <LogIn className="w-4 h-4 text-blue-400 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => onPrototypeLogin(quickLoginDemoRole('admin'))}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-amber-500/60 text-left transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">Security Command (Officer Tariq)</div>
                    <div className="text-xs text-slate-400 font-mono">Badge: SEC-001 · Command Post Alpha</div>
                  </div>
                  <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 pt-5 border-t border-slate-800/80 mt-6 leading-relaxed">
            Evaluation Safeguard: Alerts, notifications, and campus coordinates are simulated for capstone assessment. No real emergency services or real GPS coordinates are transmitted.
          </p>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setFormError(null);
                  }}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'login'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Student / Security Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setFormError(null);
                  }}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'register'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Student Registration
                </button>
              </div>

              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={googleLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                {googleLoading ? 'Connecting…' : 'Sign in with Google'}
              </button>
            </div>

            {googleError && (
              <p role="alert" className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                {googleError}
              </p>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-sid" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Student ID or Security Badge ID
                  </label>
                  <input
                    id="login-sid"
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g., 2305341433 or SEC-001"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="login-pass" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    id="login-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (sandbox: student123 / security123)"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to CampusShield
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Tanisha Karim"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-sid" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Student ID
                    </label>
                    <input
                      id="reg-sid"
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g., 2305341901"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="reg-dept" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Department
                    </label>
                    <input
                      id="reg-dept"
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Software Engineering"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1711-000000"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                      University Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@diu.edu.bd"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-route" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Evening Commute Route
                    </label>
                    <input
                      id="reg-route"
                      type="text"
                      value={commuteRoute}
                      onChange={(e) => setCommuteRoute(e.target.value)}
                      placeholder="Library -> Transit Terminal"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-pass" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Create Password
                  </label>
                  <input
                    id="reg-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Register Student Account
                </button>
              </form>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-200">Priority Triage</div>
              <div className="text-slate-400 mt-0.5">Automatic severity scoring and response routing</div>
            </div>
            <div>
              <div className="font-semibold text-slate-200">Contact Simulation</div>
              <div className="text-slate-400 mt-0.5">Instant trusted contact dispatch receipts</div>
            </div>
            <div>
              <div className="font-semibold text-slate-200">Security Dispatch</div>
              <div className="text-slate-400 mt-0.5">Real-time patrol assignment &amp; status updates</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
