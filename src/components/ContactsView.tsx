import React, { useState } from 'react';
import { BellRing, CheckCircle2, Plus, Trash2, Users } from 'lucide-react';
import { NotificationLogEntry, TrustedContact, UserProfile } from '../types/safety';
import { CAMPUS_SECTORS, simulateContactNotifications, validateContactInput } from '../utils/safetyEngine';

interface ContactsViewProps {
  user: UserProfile;
  contacts: TrustedContact[];
  onSaveContact: (contact: Omit<TrustedContact, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  onDeleteContact: (contactId: string) => Promise<void>;
}

export function ContactsView({
  user,
  contacts,
  onSaveContact,
  onDeleteContact,
}: ContactsViewProps) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notifyOnSos, setNotifyOnSos] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [simLogs, setSimLogs] = useState<NotificationLogEntry[] | null>(null);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = validateContactInput({ name, relationship, phone, email });
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    try {
      await onSaveContact(
        {
          id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ownerUid: user.uid,
          name: name.trim(),
          relationship: relationship.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notifyOnSos,
        },
        true
      );
      setName('');
      setPhone('');
      setEmail('');
      setNotifyOnSos(true);
    } catch (errObj) {
      setFormError(errObj instanceof Error ? errObj.message : 'Unable to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotify = async (contact: TrustedContact) => {
    await onSaveContact(
      {
        id: contact.id,
        ownerUid: contact.ownerUid,
        name: contact.name,
        relationship: contact.relationship,
        phone: contact.phone,
        email: contact.email,
        notifyOnSos: !contact.notifyOnSos,
      },
      false
    );
  };

  const handleRunSimulation = () => {
    const logs = simulateContactNotifications(contacts, {
      studentName: user.displayName,
      category: 'Late-Night Travel / Escort Needed',
      sectorName: CAMPUS_SECTORS[0].name,
      priority: 'High',
      coordinatesShared: true,
      simulatedLat: CAMPUS_SECTORS[0].simulatedLat,
      simulatedLng: CAMPUS_SECTORS[0].simulatedLng,
      isTestOnly: true,
    });
    setSimLogs(logs);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Trusted Emergency Contacts</h2>
          <p className="text-sm text-slate-400">
            Manage family members, guardians, or peers who receive simulated SOS notifications when you trigger an alert.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunSimulation}
          disabled={contacts.filter((c) => c.notifyOnSos).length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <BellRing className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <span>Run Notification Simulation</span>
        </button>
      </div>

      {simLogs && (
        <div className="bg-[#111827] border border-blue-500/35 rounded-xl p-6 space-y-4" data-testid="simulation-receipt-panel">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-300">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Test Alert Receipts ({simLogs.length} Sent)</span>
            </div>
            <button
              type="button"
              onClick={() => setSimLogs(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {simLogs.map((log) => (
              <div key={log.id} className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100">
                    {log.contactName} ({log.relationship})
                  </span>
                  <span className="text-emerald-400 font-medium">{log.status}</span>
                </div>
                <div className="text-slate-400 font-mono">{log.phone} · {log.channel}</div>
                <p className="text-slate-300 pt-1 leading-relaxed">{log.messagePreview}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add Contact Form (5 cols) */}
        <form
          onSubmit={handleAddContact}
          className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-base font-semibold text-slate-100">Add Trusted Contact</h3>

          <div>
            <label htmlFor="contact-name" className="block text-xs font-medium text-slate-300 mb-1.5">
              Full Name
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Anjali Roy"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-rel" className="block text-xs font-medium text-slate-300 mb-1.5">
                Relationship
              </label>
              <select
                id="contact-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="Parent">Parent</option>
                <option value="Guardian">Guardian</option>
                <option value="Sibling">Sibling</option>
                <option value="Dorm Roommate">Dorm Roommate</option>
                <option value="Trusted Friend">Trusted Friend</option>
                <option value="Faculty Advisor">Faculty Advisor</option>
              </select>
            </div>
            <div>
              <label htmlFor="contact-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1711-000000"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address (Optional)
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnSos}
              onChange={(e) => setNotifyOnSos(e.target.checked)}
              className="rounded border-slate-600 bg-[#0B1120] text-blue-600"
            />
            <span>Automatically notify on Emergency SOS</span>
          </label>

          {formError && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? 'Saving Contact…' : 'Add Trusted Contact'}
          </button>
        </form>

        {/* Contacts List (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-100">Saved Emergency Contacts</h3>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {contacts.length} contact(s)
            </span>
          </div>

          {contacts.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-500 mx-auto" aria-hidden="true" />
              <p className="text-sm text-slate-300">No trusted emergency contacts added yet.</p>
              <p className="text-xs text-slate-400">
                Add at least one contact so SOS alerts can simulate immediate family or peer notifications.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{contact.name}</span>
                      <span className="text-xs text-slate-400">· {contact.relationship}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {contact.phone}
                      {contact.email ? ` · ${contact.email}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleNotify(contact)}
                      aria-label={`Toggle SOS notification for ${contact.name}`}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        contact.notifyOnSos
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {contact.notifyOnSos ? 'SOS Notify: Active' : 'SOS Notify: Paused'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteContact(contact.id)}
                      aria-label={`Delete contact ${contact.name}`}
                      className="p-2 rounded-md bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
