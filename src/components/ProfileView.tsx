import React, { useState } from 'react';
import { CheckCircle2, LogOut, Shield, UserCheck } from 'lucide-react';
import { UserProfile } from '../types/safety';
import { validateProfileInput } from '../utils/safetyEngine';

interface ProfileViewProps {
  user: UserProfile;
  onUpdateProfile: (updates: {
    displayName: string;
    studentId: string;
    department: string;
    phone: string;
    commuteRoute: string;
    email: string;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function ProfileView({ user, onUpdateProfile, onSignOut }: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [studentId, setStudentId] = useState(user.studentId);
  const [department, setDepartment] = useState(user.department);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [commuteRoute, setCommuteRoute] = useState(user.commuteRoute);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    const valErr = validateProfileInput({ displayName, studentId, department, phone });
    if (valErr) {
      setError(valErr);
      return;
    }
    setSaving(true);
    try {
      await onUpdateProfile({
        displayName,
        studentId,
        department,
        phone,
        commuteRoute,
        email,
      });
      setSavedMsg('Profile settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Account &amp; Registration Profile</h2>
          <p className="text-sm text-slate-400">
            Update student identification, primary contact number, and regular evening commute route.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              {user.role === 'admin' ? <Shield className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-100">{user.displayName}</div>
              <div className="text-xs text-slate-400 font-mono">
                {user.role === 'admin' ? 'Authorized Security Officer' : 'Registered Student'} · {user.studentId}
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Storage: {user.authMode === 'firebase' ? 'Firebase Cloud Sync' : 'Local Sandbox Session'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="prof-sid" className="block text-xs font-medium text-slate-300 mb-1.5">
                Student / Badge ID
              </label>
              <input
                id="prof-sid"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-dept" className="block text-xs font-medium text-slate-300 mb-1.5">
                Department / Unit
              </label>
              <input
                id="prof-dept"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="prof-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                id="prof-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="prof-route" className="block text-xs font-medium text-slate-300 mb-1.5">
                Primary Commute Route
              </label>
              <input
                id="prof-route"
                type="text"
                value={commuteRoute}
                onChange={(e) => setCommuteRoute(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {savedMsg && (
            <div role="status" className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{savedMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
