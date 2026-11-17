import React, { useState } from 'react';
import { Bot, Send, ShieldAlert } from 'lucide-react';
import { IncidentReport, UserProfile } from '../types/safety';
import { CAMPUS_SECTORS } from '../utils/safetyEngine';

interface SafetyAssistantViewProps {
  user: UserProfile;
  incidents: IncidentReport[];
  onTriggerSos: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTED_PROMPTS = [
  'Which campus sectors currently have active alerts or low lighting?',
  'What should I do right now if someone is following me near West Lakefront?',
  'Recommend a safe late-night commute plan from Engineering Labs to South Dorms.',
  'How does CampusShield classify priority and escalate critical SOS reports?',
];

export function SafetyAssistantView({
  user,
  incidents,
  onTriggerSos,
}: SafetyAssistantViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: `Hello ${user.displayName}. I am the CampusShield Safety Advisor. Ask about safe late-night campus routes, active sector alerts, or immediate emergency steps.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const activeAlerts = incidents
        .filter((i) => i.status !== 'Resolved')
        .slice(0, 6)
        .map((i) => `- [${i.priority}] ${i.category} at ${i.sectorName} (${i.status})`)
        .join('\n');

      const sectorSummary = CAMPUS_SECTORS.map(
        (s) => `${s.shortCode} ${s.name}: ${s.lightingLevel}, Guard Post: ${s.nearestGuardPost}`
      ).join('\n');

      const res = await fetch('/api/ai/safety-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          campusContext: {
            userName: user.displayName,
            userRole: user.role,
            activeIncidentSummary: activeAlerts || 'No open alerts currently.',
            sectorSummary,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to reach Safety AI Advisor.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply,
        },
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Safety AI request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">CampusShield Safety AI Advisor</h2>
          <p className="text-sm text-slate-400">
            Real-time campus safety guidance grounded in monitored sectors, guard posts, and active alerts.
          </p>
        </div>
        <button
          type="button"
          onClick={onTriggerSos}
          className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <ShieldAlert className="w-4 h-4" aria-hidden="true" />
          <span>Switch to SOS Report</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Conversation Thread (8 cols) */}
        <div className="xl:col-span-8 bg-[#111827] border border-slate-800 rounded-xl flex flex-col h-[560px]">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-100">Safety Advisor Session</span>
          </div>

          <div
            className="flex-1 overflow-y-auto p-5 space-y-4"
            aria-live="polite"
            data-testid="safety-chat-thread"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0B1120] border border-slate-800 text-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-4 py-3 text-xs text-slate-400 bg-[#0B1120] border border-slate-800">
                  Analyzing campus sector conditions…
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div role="alert" className="mx-5 mb-3 px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about campus safety, escort protocols, or sector conditions…"
              aria-label="Ask Safety AI Advisor"
              className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Suggested Safety Prompts (4 cols) */}
        <aside className="xl:col-span-4 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-100">Quick Safety Questions</h3>
          <div className="space-y-2.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg bg-[#0B1120] border border-slate-800 hover:border-blue-500/50 text-xs text-slate-300 hover:text-slate-100 transition-colors leading-relaxed disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-800 leading-relaxed">
            In an immediate physical or medical emergency, use Emergency SOS to log an alert and notify Campus Security Command.
          </p>
        </aside>
      </div>
    </div>
  );
}
