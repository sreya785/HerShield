import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { Menu, Shield } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, googleProvider, testConnection } from './firebase/config';
import {
  addPrototypeIncident,
  buildNewIncidentObject,
  createFirebaseIncident,
  deletePrototypeContact,
  fetchFirebaseUserProfile,
  getActivePrototypeUser,
  getPrototypeContacts,
  getPrototypeIncidents,
  logoutPrototypeUser,
  removeFirebaseContact,
  saveFirebaseContact,
  saveFirebaseUserProfile,
  savePrototypeContact,
  subscribeFirebaseContacts,
  subscribeFirebaseIncidents,
  updateFirebaseIncidentStatus,
  updatePrototypeIncidentStatus,
  updatePrototypeProfile,
} from './services/safetyStore';
import {
  EmergencyCategory,
  IncidentPriority,
  IncidentReport,
  IncidentStatus,
  TrustedContact,
  UserProfile,
} from './types/safety';
import { CAMPUS_SECTORS } from './utils/safetyEngine';
import { AuthView } from './components/AuthView';
import { ContactsView } from './components/ContactsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MyReportsView } from './components/MyReportsView';
import { ProfileView } from './components/ProfileView';
import { ReportIncidentView } from './components/ReportIncidentView';
import { SafeRoutePlannerView } from './components/SafeRoutePlannerView';
import { SafetyAssistantView } from './components/SafetyAssistantView';
import { SafetyStatusView } from './components/SafetyStatusView';
import { SecurityDashboardView } from './components/SecurityDashboardView';
import { NavTab, Sidebar } from './components/Sidebar';
import { StatisticsView } from './components/StatisticsView';

function CampusShieldApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingFbUser, setPendingFbUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
  } | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('status');
  const [sosSectorId, setSosSectorId] = useState<string>(CAMPUS_SECTORS[0].id);
  const [sosPresetMode, setSosPresetMode] = useState<boolean>(false);
  const [sosPresetCategory, setSosPresetCategory] = useState<EmergencyCategory | undefined>(undefined);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Startup Firestore connection check & auth listener
  useEffect(() => {
    testConnection();

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const { profile, isAdmin } = await fetchFirebaseUserProfile(
            fbUser.uid,
            fbUser.email,
            fbUser.displayName
          );
          if (profile) {
            setUser(profile);
            setPendingFbUser(null);
          } else {
            setPendingFbUser({
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || '',
              isAdmin: isAdmin || fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL,
            });
            setUser(null);
          }
        } catch (err) {
          console.error('Failed to load Firebase user profile:', err);
        }
      } else {
        setPendingFbUser(null);
        const protoUser = getActivePrototypeUser();
        setUser(protoUser);
      }
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  // Subscribe to contacts and incidents depending on authMode
  useEffect(() => {
    if (!user) {
      setContacts([]);
      setIncidents([]);
      return;
    }

    if (user.authMode === 'firebase') {
      const unsubContacts = subscribeFirebaseContacts(user.uid, setContacts);
      const unsubIncidents = subscribeFirebaseIncidents(
        user.uid,
        user.role === 'admin',
        setIncidents
      );
      return () => {
        unsubContacts();
        unsubIncidents();
      };
    }

    setContacts(getPrototypeContacts(user.uid));
    setIncidents(getPrototypeIncidents());
  }, [user]);

  const handleGoogleLogin = async () => {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setGoogleError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In failed. You can also use Student ID login or Prototype Quick Access.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCompleteFirebaseProfile = async (data: {
    displayName: string;
    studentId: string;
    department: string;
    phone: string;
    commuteRoute: string;
  }) => {
    if (!pendingFbUser) return;
    const saved = await saveFirebaseUserProfile({
      uid: pendingFbUser.uid,
      displayName: data.displayName,
      studentId: data.studentId,
      department: data.department,
      email: pendingFbUser.email,
      phone: data.phone,
      commuteRoute: data.commuteRoute,
      role: pendingFbUser.isAdmin ? 'admin' : 'student',
      isNew: true,
    });
    setPendingFbUser(null);
    setUser(saved);
    setActiveTab(saved.role === 'admin' ? 'security' : 'status');
  };

  const handlePrototypeLogin = (loggedUser: UserProfile) => {
    setUser(loggedUser);
    setActiveTab(loggedUser.role === 'admin' ? 'security' : 'status');
  };

  const handleSignOut = async () => {
    if (user?.authMode === 'firebase') {
      await signOut(auth);
    } else {
      logoutPrototypeUser();
    }
    setUser(null);
    setPendingFbUser(null);
    setActiveTab('status');
  };

  const handleSaveContact = async (
    contact: Omit<TrustedContact, 'createdAt' | 'updatedAt'>,
    isNew: boolean
  ) => {
    if (!user) return;
    if (user.authMode === 'firebase') {
      await saveFirebaseContact(user.uid, contact, isNew);
      return;
    }
    const now = new Date().toISOString();
    const existing = contacts.find((c) => c.id === contact.id);
    const updated = savePrototypeContact({
      ...contact,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    setContacts(updated);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!user) return;
    if (user.authMode === 'firebase') {
      await removeFirebaseContact(user.uid, contactId);
      return;
    }
    setContacts(deletePrototypeContact(user.uid, contactId));
  };

  const handleSubmitIncident = async (params: {
    category: EmergencyCategory;
    description: string;
    sectorId: string;
    simulatedLat: number;
    simulatedLng: number;
    coordinatesShared: boolean;
    isSos: boolean;
    isLateNight: boolean;
    isAlone: boolean;
  }): Promise<IncidentReport> => {
    if (!user) {
      throw new Error('User session required.');
    }
    const newIncident = buildNewIncidentObject({
      user,
      contacts,
      ...params,
    });

    if (user.authMode === 'firebase') {
      await createFirebaseIncident(newIncident);
    } else {
      setIncidents(addPrototypeIncident(newIncident));
    }
    return newIncident;
  };

  const handleUpdateIncidentStatus = async (
    incidentId: string,
    updates: {
      status: IncidentStatus;
      assignedUnit: string;
      responderNotes: string;
      priority: IncidentPriority;
      escalationTier: string;
      actionLabel?: string;
    }
  ) => {
    if (!user) return;
    if (user.authMode === 'firebase') {
      await updateFirebaseIncidentStatus(incidentId, updates);
      return;
    }
    setIncidents(
      updatePrototypeIncidentStatus(incidentId, {
        ...updates,
        actor: user.displayName,
      })
    );
  };

  const handleUpdateProfile = async (updates: {
    displayName: string;
    studentId: string;
    department: string;
    phone: string;
    commuteRoute: string;
    email: string;
  }) => {
    if (!user) return;
    if (user.authMode === 'firebase') {
      const updated = await saveFirebaseUserProfile({
        uid: user.uid,
        displayName: updates.displayName,
        studentId: updates.studentId,
        department: updates.department,
        email: updates.email,
        phone: updates.phone,
        commuteRoute: updates.commuteRoute,
        role: user.role,
        isNew: false,
      });
      setUser(updated);
      return;
    }
    const updated = updatePrototypeProfile(user.uid, updates);
    if (updated) setUser(updated);
  };

  const handleQuickSos = (sectorId?: string) => {
    setSosSectorId(sectorId || CAMPUS_SECTORS[0].id);
    setSosPresetMode(true);
    setSosPresetCategory(undefined);
    setActiveTab('report');
  };

  const handleRequestEscort = (originSectorId: string) => {
    setSosSectorId(originSectorId);
    setSosPresetMode(false);
    setSosPresetCategory('Late-Night Travel / Escort Needed');
    setActiveTab('report');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-300 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm">
          <Shield className="w-5 h-5 text-blue-400" />
          <span>Initializing CampusShield…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView
        onPrototypeLogin={handlePrototypeLogin}
        onGoogleLogin={handleGoogleLogin}
        googleLoading={googleLoading}
        googleError={googleError}
        pendingFirebaseUser={pendingFbUser}
        onCompleteFirebaseProfile={handleCompleteFirebaseProfile}
      />
    );
  }

  const openIncidentCount = incidents.filter((i) => i.status !== 'Resolved').length;

  const pageTitles: Record<NavTab, string> = {
    status: 'Safety Status Overview',
    report: 'Emergency & SOS Reporting',
    route: 'Safe Route Planner',
    assistant: 'Safety AI Advisor',
    reports: 'My Emergency Reports',
    contacts: 'Trusted Emergency Contacts',
    statistics: 'Incident History & Statistics',
    security: 'Security Operations Console',
    profile: 'Account & Registration Profile',
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab !== 'report') {
            setSosPresetMode(false);
            setSosPresetCategory(undefined);
          }
          setActiveTab(tab);
        }}
        user={user}
        openCount={openIncidentCount}
        onSignOut={handleSignOut}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between gap-4 px-4 sm:px-8 py-4 border-b border-slate-800 bg-[#0B1120]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg bg-[#111827] border border-slate-800 text-slate-200 hover:bg-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
              {pageTitles[activeTab]}
            </h1>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden md:inline text-xs text-slate-400">
              {user.role === 'admin' ? 'Security Command' : 'Student Portal'} · {user.displayName}
            </span>
            {activeTab !== 'status' && activeTab !== 'report' && activeTab !== 'assistant' && (
              <button
                type="button"
                onClick={() => handleQuickSos()}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Emergency SOS
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'status' && (
                <SafetyStatusView
                  incidents={incidents}
                  contacts={contacts}
                  onTriggerQuickSos={(sectorId) => handleQuickSos(sectorId)}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'report' && (
                <ReportIncidentView
                  user={user}
                  contacts={contacts}
                  incidents={incidents}
                  initialSectorId={sosSectorId}
                  initialSosMode={sosPresetMode}
                  initialCategory={sosPresetCategory}
                  onSubmitIncident={handleSubmitIncident}
                  onNavigateToReports={() => setActiveTab('reports')}
                />
              )}

              {activeTab === 'route' && (
                <SafeRoutePlannerView
                  incidents={incidents}
                  onRequestEscort={handleRequestEscort}
                />
              )}

              {activeTab === 'assistant' && (
                <SafetyAssistantView
                  user={user}
                  incidents={incidents}
                  onTriggerSos={() => handleQuickSos()}
                />
              )}

              {activeTab === 'reports' && (
                <MyReportsView
                  incidents={incidents}
                  currentUid={user.uid}
                  isAdmin={user.role === 'admin'}
                  onCreateNewReport={() => {
                    setSosPresetMode(false);
                    setSosPresetCategory(undefined);
                    setActiveTab('report');
                  }}
                />
              )}

              {activeTab === 'contacts' && (
                <ContactsView
                  user={user}
                  contacts={contacts}
                  onSaveContact={handleSaveContact}
                  onDeleteContact={handleDeleteContact}
                />
              )}

              {activeTab === 'statistics' && <StatisticsView incidents={incidents} />}

              {activeTab === 'security' && user.role === 'admin' && (
                <SecurityDashboardView
                  incidents={incidents}
                  onUpdateIncidentStatus={handleUpdateIncidentStatus}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  user={user}
                  onUpdateProfile={handleUpdateProfile}
                  onSignOut={handleSignOut}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <CampusShieldApp />
      </MotionConfig>
    </ErrorBoundary>
  );
}
