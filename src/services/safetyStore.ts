import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { BOOTSTRAPPED_ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  EmergencyCategory,
  IncidentAuditEntry,
  IncidentPriority,
  IncidentReport,
  IncidentStatus,
  TrustedContact,
  UserProfile,
  UserRole,
  VALIDATION_LIMITS,
} from '../types/safety';
import {
  CAMPUS_SECTORS,
  classifyIncidentPriority,
  computeEscalationWorkflow,
  getSectorById,
  simulateContactNotifications,
} from '../utils/safetyEngine';

const STORAGE_KEYS = {
  USERS: 'campusshield_proto_users_v1',
  SESSION_UID: 'campusshield_proto_session_uid_v1',
  CONTACTS: 'campusshield_proto_contacts_v1',
  INCIDENTS: 'campusshield_proto_incidents_v1',
};

export interface PrototypeAccount {
  uid: string;
  studentId: string;
  password: string;
  displayName: string;
  department: string;
  email: string;
  phone: string;
  commuteRoute: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PROTO_ACCOUNTS: PrototypeAccount[] = [
  {
    uid: 'proto-student-2305341433',
    studentId: '2305341433',
    password: 'student123',
    displayName: 'Sreya Roy',
    department: 'Software Engineering',
    email: 'sreya.student@diu.edu.bd',
    phone: '+880 1711-240981',
    commuteRoute: 'South Residence Halls -> Main Gate Shuttle',
    role: 'student',
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
  },
  {
    uid: 'proto-admin-sec01',
    studentId: 'SEC-001',
    password: 'security123',
    displayName: 'Officer Tariq Mahmud',
    department: 'Campus Security Command',
    email: 'security.command@diu.edu.bd',
    phone: '+880 1711-990001',
    commuteRoute: 'Command Post Alpha (Main Gate)',
    role: 'admin',
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
  },
];

const DEFAULT_CONTACTS: TrustedContact[] = [
  {
    id: 'contact-mother',
    ownerUid: 'proto-student-2305341433',
    name: 'Anjali Roy',
    relationship: 'Mother',
    phone: '+880 1712-445510',
    email: 'anjali.roy@example.com',
    notifyOnSos: true,
    createdAt: '2026-11-10T09:05:00.000Z',
    updatedAt: '2026-11-10T09:05:00.000Z',
  },
  {
    id: 'contact-roommate',
    ownerUid: 'proto-student-2305341433',
    name: 'Nadia Tasnim',
    relationship: 'Dorm Roommate',
    phone: '+880 1819-773204',
    email: 'nadia.t@diu.edu.bd',
    notifyOnSos: true,
    createdAt: '2026-11-10T09:06:00.000Z',
    updatedAt: '2026-11-10T09:06:00.000Z',
  },
];

function buildSeedIncident(params: {
  id: string;
  reporterUid: string;
  reporterName: string;
  reporterStudentId: string;
  category: EmergencyCategory;
  description: string;
  sectorId: string;
  isSos: boolean;
  isLateNight: boolean;
  isAlone: boolean;
  status: IncidentStatus;
  assignedUnit: string;
  responderNotes: string;
  createdAt: string;
  updatedAt: string;
}): IncidentReport {
  const sector = getSectorById(params.sectorId);
  const priorityInfo = classifyIncidentPriority({
    category: params.category,
    description: params.description,
    isSos: params.isSos,
    isLateNight: params.isLateNight,
    isAlone: params.isAlone,
    sectorId: params.sectorId,
  });
  const escalation = computeEscalationWorkflow({
    category: params.category,
    priority: priorityInfo.priority,
    isSos: params.isSos,
    isLateNight: params.isLateNight,
    isAlone: params.isAlone,
    sectorId: params.sectorId,
  });
  return {
    id: params.id,
    reporterUid: params.reporterUid,
    reporterName: params.reporterName,
    reporterStudentId: params.reporterStudentId,
    category: params.category,
    description: params.description,
    sectorId: sector.id,
    sectorName: sector.name,
    simulatedLat: sector.simulatedLat,
    simulatedLng: sector.simulatedLng,
    coordinatesShared: true,
    isSos: params.isSos,
    isLateNight: params.isLateNight,
    isAlone: params.isAlone,
    priority: priorityInfo.priority,
    priorityScore: priorityInfo.priorityScore,
    priorityReasons: priorityInfo.reasons,
    status: params.status,
    responseCategory: escalation.responseCategory,
    escalationTier: escalation.escalationTier,
    recommendedUnit: escalation.recommendedUnit,
    nextActionStudent: escalation.nextActionStudent,
    nextActionResponder: escalation.nextActionResponder,
    autoEscalated: escalation.autoEscalated,
    workflowSteps: escalation.workflowSteps,
    notifiedContactNames: params.isSos ? ['Anjali Roy', 'Nadia Tasnim'] : [],
    notificationLogs: params.isSos
      ? [
          {
            id: `sim_${params.id}_1`,
            contactName: 'Anjali Roy',
            relationship: 'Mother',
            phone: '+880 1712-445510',
            channel: 'SMS Priority Alert (Simulated)',
            status: 'Delivered (Simulated)',
            messagePreview: `[PROTOTYPE ALERT] ${params.reporterName} reported ${params.category} at ${sector.name}.`,
            simulatedAt: params.createdAt,
          },
        ]
      : [],
    assignedUnit: params.assignedUnit,
    responderNotes: params.responderNotes,
    auditLog: [
      {
        id: `aud_${params.id}_1`,
        timestamp: params.createdAt,
        actor: params.reporterName,
        action: params.isSos ? 'SOS Beacon Logged' : 'Incident Reported',
        detail: `${params.category} at ${sector.name}`,
      },
      ...(params.status !== 'Reported'
        ? [
            {
              id: `aud_${params.id}_2`,
              timestamp: params.updatedAt,
              actor: 'Officer Tariq Mahmud',
              action: `Status: ${params.status}`,
              detail: params.assignedUnit || 'Security Dispatch',
            },
          ]
        : []),
    ],
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

const DEFAULT_INCIDENTS: IncidentReport[] = [
  buildSeedIncident({
    id: 'inc-seed-101',
    reporterUid: 'proto-student-2305341433',
    reporterName: 'Sreya Roy',
    reporterStudentId: '2305341433',
    category: 'Late-Night Travel / Escort Needed',
    description: 'Leaving Engineering Lab late after capstone testing, requesting Safe-Walk escort to South Residence Halls.',
    sectorId: 'sector-engineering-block',
    isSos: false,
    isLateNight: true,
    isAlone: true,
    status: 'Dispatched',
    assignedUnit: 'Safe-Walk Escort Unit 2',
    responderNotes: 'Escort officer en route to Lab Wing Post Charlie; ETA 3 minutes.',
    createdAt: '2026-11-16T21:15:00.000Z',
    updatedAt: '2026-11-16T21:18:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-102',
    reporterUid: 'proto-student-2305998811',
    reporterName: 'Mim Akter',
    reporterStudentId: '2305341812',
    category: 'Harassment / Stalking',
    description: 'Unidentified person following students near the poorly lit bend by West Lakefront Walkway.',
    sectorId: 'sector-west-walkway',
    isSos: true,
    isLateNight: true,
    isAlone: true,
    status: 'Acknowledged',
    assignedUnit: 'West Perimeter Patrol Foxtrot',
    responderNotes: 'CCTV operators tracking sector 6; patrol vehicle dispatched to lakefront path.',
    createdAt: '2026-11-16T20:42:00.000Z',
    updatedAt: '2026-11-16T20:44:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-103',
    reporterUid: 'proto-student-2305441100',
    reporterName: 'Arif Chowdhury',
    reporterStudentId: '2305341100',
    category: 'Medical Emergency',
    description: 'Student fainted near Central Library ground floor stairwell after evening seminar.',
    sectorId: 'sector-central-library',
    isSos: true,
    isLateNight: false,
    isAlone: false,
    status: 'Resolved',
    assignedUnit: 'Med-Response Team 1',
    responderNotes: 'Campus nurse stabilized student and escorted to Campus Health Center.',
    createdAt: '2026-11-15T17:20:00.000Z',
    updatedAt: '2026-11-15T17:45:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-104',
    reporterUid: 'proto-student-2305341433',
    reporterName: 'Sreya Roy',
    reporterStudentId: '2305341433',
    category: 'Accident / Infrastructure Hazard',
    description: 'Streetlight outage along North Parking Lot C row B3 creating blind spot near stairs.',
    sectorId: 'sector-parking-c',
    isSos: false,
    isLateNight: true,
    isAlone: false,
    status: 'Reported',
    assignedUnit: '',
    responderNotes: '',
    createdAt: '2026-11-16T19:05:00.000Z',
    updatedAt: '2026-11-16T19:05:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-105',
    reporterUid: 'proto-student-2305884412',
    reporterName: 'Nusrat Jahan',
    reporterStudentId: '2305341509',
    category: 'Harassment / Stalking',
    description: 'Repeated catcalling near West Lakefront south bench after evening club session.',
    sectorId: 'sector-west-walkway',
    isSos: true,
    isLateNight: true,
    isAlone: true,
    status: 'Resolved',
    assignedUnit: 'West Perimeter Patrol Foxtrot',
    responderNotes: 'Patrol swept perimeter and escorted student safely to South Dorms.',
    createdAt: '2026-11-14T21:10:00.000Z',
    updatedAt: '2026-11-14T21:35:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-106',
    reporterUid: 'proto-student-2305772201',
    reporterName: 'Tanvir Hasan',
    reporterStudentId: '2305341620',
    category: 'Suspicious Activity',
    description: 'Unattended motorcycle idling near West Lakefront pedestrian path with headlights off.',
    sectorId: 'sector-west-walkway',
    isSos: false,
    isLateNight: true,
    isAlone: false,
    status: 'Resolved',
    assignedUnit: 'West Perimeter Patrol Foxtrot',
    responderNotes: 'Rider verified as campus contractor; area cleared and logged.',
    createdAt: '2026-11-13T20:25:00.000Z',
    updatedAt: '2026-11-13T20:50:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-107',
    reporterUid: 'proto-student-2305663309',
    reporterName: 'Farhan Sadik',
    reporterStudentId: '2305341715',
    category: 'Suspicious Activity',
    description: 'Attempted unauthorized entry near North Parking Lot C bicycle rack.',
    sectorId: 'sector-parking-c',
    isSos: false,
    isLateNight: true,
    isAlone: true,
    status: 'Resolved',
    assignedUnit: 'North Gate Post Golf',
    responderNotes: 'Security officer checked CCTV and reinforced North Gate bicycle lock perimeter.',
    createdAt: '2026-11-12T22:05:00.000Z',
    updatedAt: '2026-11-12T22:30:00.000Z',
  }),
  buildSeedIncident({
    id: 'inc-seed-108',
    reporterUid: 'proto-student-2305341433',
    reporterName: 'Sreya Roy',
    reporterStudentId: '2305341433',
    category: 'Late-Night Travel / Escort Needed',
    description: 'Delayed shuttle transfer at Shuttle Terminal; requested security presence until bus arrival.',
    sectorId: 'sector-transit-hub',
    isSos: false,
    isLateNight: true,
    isAlone: true,
    status: 'Resolved',
    assignedUnit: 'Transit Booth Echo',
    responderNotes: 'Officer remained on platform until 21:40 shuttle departure.',
    createdAt: '2026-11-11T21:20:00.000Z',
    updatedAt: '2026-11-11T21:42:00.000Z',
  }),
];

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function ensureSeededPrototypeData(): void {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    safeWriteJson(STORAGE_KEYS.USERS, DEFAULT_PROTO_ACCOUNTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CONTACTS)) {
    safeWriteJson(STORAGE_KEYS.CONTACTS, DEFAULT_CONTACTS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.INCIDENTS)) {
    safeWriteJson(STORAGE_KEYS.INCIDENTS, DEFAULT_INCIDENTS);
  }
}

export function toUserProfile(account: PrototypeAccount): UserProfile {
  return {
    uid: account.uid,
    displayName: account.displayName,
    studentId: account.studentId,
    department: account.department,
    role: account.role,
    email: account.email,
    phone: account.phone,
    commuteRoute: account.commuteRoute,
    authMode: 'prototype',
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function getActivePrototypeUser(): UserProfile | null {
  ensureSeededPrototypeData();
  const uid = localStorage.getItem(STORAGE_KEYS.SESSION_UID);
  if (!uid) return null;
  const accounts = safeReadJson<PrototypeAccount[]>(STORAGE_KEYS.USERS, DEFAULT_PROTO_ACCOUNTS);
  const found = accounts.find((a) => a.uid === uid);
  return found ? toUserProfile(found) : null;
}

export function loginPrototypeUser(studentId: string, password: string): { user?: UserProfile; error?: string } {
  ensureSeededPrototypeData();
  const accounts = safeReadJson<PrototypeAccount[]>(STORAGE_KEYS.USERS, DEFAULT_PROTO_ACCOUNTS);
  const cleanId = studentId.trim().toLowerCase();
  const found = accounts.find((a) => a.studentId.toLowerCase() === cleanId);
  if (!found) {
    return { error: 'No account found with that Student or Badge ID.' };
  }
  if (found.password !== password) {
    return { error: 'Incorrect password. Please try again.' };
  }
  localStorage.setItem(STORAGE_KEYS.SESSION_UID, found.uid);
  return { user: toUserProfile(found) };
}

export function quickLoginDemoRole(role: UserRole): UserProfile {
  ensureSeededPrototypeData();
  const targetId = role === 'admin' ? 'SEC-001' : '2305341433';
  const accounts = safeReadJson<PrototypeAccount[]>(STORAGE_KEYS.USERS, DEFAULT_PROTO_ACCOUNTS);
  const found = accounts.find((a) => a.studentId === targetId) || DEFAULT_PROTO_ACCOUNTS[0];
  localStorage.setItem(STORAGE_KEYS.SESSION_UID, found.uid);
  return toUserProfile(found);
}

export function registerPrototypeStudent(input: {
  displayName: string;
  studentId: string;
  department: string;
  email: string;
  phone: string;
  commuteRoute: string;
  password: string;
}): { user?: UserProfile; error?: string } {
  ensureSeededPrototypeData();
  const accounts = safeReadJson<PrototypeAccount[]>(STORAGE_KEYS.USERS, DEFAULT_PROTO_ACCOUNTS);
  const cleanId = input.studentId.trim();
  if (accounts.some((a) => a.studentId.toLowerCase() === cleanId.toLowerCase())) {
    return { error: 'An account with this Student ID is already registered.' };
  }
  const now = new Date().toISOString();
  const uid = `proto-${cleanId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
  const newAcc: PrototypeAccount = {
    uid,
    studentId: cleanId,
    password: input.password,
    displayName: input.displayName.trim(),
    department: input.department.trim(),
    email: input.email.trim() || `${cleanId}@diu.edu.bd`,
    phone: input.phone.trim(),
    commuteRoute: input.commuteRoute.trim() || 'Main Campus Route',
    role: 'student',
    createdAt: now,
    updatedAt: now,
  };
  const next = [...accounts, newAcc];
  safeWriteJson(STORAGE_KEYS.USERS, next);
  localStorage.setItem(STORAGE_KEYS.SESSION_UID, newAcc.uid);
  return { user: toUserProfile(newAcc) };
}

export function logoutPrototypeUser(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION_UID);
}

export function updatePrototypeProfile(
  uid: string,
  updates: { displayName: string; studentId: string; department: string; phone: string; commuteRoute: string; email: string }
): UserProfile | null {
  const accounts = safeReadJson<PrototypeAccount[]>(STORAGE_KEYS.USERS, DEFAULT_PROTO_ACCOUNTS);
  const now = new Date().toISOString();
  let updatedUser: UserProfile | null = null;
  const next = accounts.map((acc) => {
    if (acc.uid !== uid) return acc;
    const merged: PrototypeAccount = {
      ...acc,
      displayName: updates.displayName.trim().slice(0, VALIDATION_LIMITS.NAME_MAX),
      studentId: updates.studentId.trim().slice(0, VALIDATION_LIMITS.STUDENT_ID_MAX),
      department: updates.department.trim().slice(0, VALIDATION_LIMITS.DEPARTMENT_MAX),
      phone: updates.phone.trim().slice(0, VALIDATION_LIMITS.PHONE_MAX),
      commuteRoute: updates.commuteRoute.trim().slice(0, VALIDATION_LIMITS.COMMUTE_MAX),
      email: updates.email.trim().slice(0, VALIDATION_LIMITS.EMAIL_MAX),
      updatedAt: now,
    };
    updatedUser = toUserProfile(merged);
    return merged;
  });
  safeWriteJson(STORAGE_KEYS.USERS, next);
  return updatedUser;
}

export function getPrototypeContacts(ownerUid: string): TrustedContact[] {
  ensureSeededPrototypeData();
  const all = safeReadJson<TrustedContact[]>(STORAGE_KEYS.CONTACTS, DEFAULT_CONTACTS);
  return all.filter((c) => c.ownerUid === ownerUid);
}

export function savePrototypeContact(contact: TrustedContact): TrustedContact[] {
  const all = safeReadJson<TrustedContact[]>(STORAGE_KEYS.CONTACTS, DEFAULT_CONTACTS);
  const exists = all.some((c) => c.id === contact.id);
  const next = exists ? all.map((c) => (c.id === contact.id ? contact : c)) : [contact, ...all];
  safeWriteJson(STORAGE_KEYS.CONTACTS, next);
  return next.filter((c) => c.ownerUid === contact.ownerUid);
}

export function deletePrototypeContact(ownerUid: string, contactId: string): TrustedContact[] {
  const all = safeReadJson<TrustedContact[]>(STORAGE_KEYS.CONTACTS, DEFAULT_CONTACTS);
  const next = all.filter((c) => !(c.id === contactId && c.ownerUid === ownerUid));
  safeWriteJson(STORAGE_KEYS.CONTACTS, next);
  return next.filter((c) => c.ownerUid === ownerUid);
}

export function getPrototypeIncidents(): IncidentReport[] {
  ensureSeededPrototypeData();
  return safeReadJson<IncidentReport[]>(STORAGE_KEYS.INCIDENTS, DEFAULT_INCIDENTS).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addPrototypeIncident(incident: IncidentReport): IncidentReport[] {
  const all = getPrototypeIncidents();
  const next = [incident, ...all];
  safeWriteJson(STORAGE_KEYS.INCIDENTS, next);
  return next;
}

export function updatePrototypeIncidentStatus(
  incidentId: string,
  updates: {
    status: IncidentStatus;
    assignedUnit: string;
    responderNotes: string;
    priority?: IncidentPriority;
    escalationTier?: string;
    actor?: string;
    actionLabel?: string;
  }
): IncidentReport[] {
  const all = getPrototypeIncidents();
  const now = new Date().toISOString();
  const next = all.map((inc) => {
    if (inc.id !== incidentId) return inc;
    const cleanUnit = updates.assignedUnit.trim().slice(0, VALIDATION_LIMITS.ASSIGNED_UNIT_MAX);
    const auditEntry: IncidentAuditEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      actor: updates.actor || 'Security Command',
      action: updates.actionLabel || `Status: ${updates.status}`,
      detail: cleanUnit
        ? `Assigned ${cleanUnit}${updates.escalationTier && updates.escalationTier !== inc.escalationTier ? ` · ${updates.escalationTier}` : ''}`
        : `Updated to ${updates.status}`,
    };
    const existingLog = inc.auditLog || [
      {
        id: `aud_${inc.id}_init`,
        timestamp: inc.createdAt,
        actor: inc.reporterName,
        action: inc.isSos ? 'SOS Beacon Logged' : 'Incident Reported',
        detail: `${inc.category} at ${inc.sectorName}`,
      },
    ];
    return {
      ...inc,
      status: updates.status,
      assignedUnit: cleanUnit,
      responderNotes: updates.responderNotes.trim().slice(0, VALIDATION_LIMITS.RESPONDER_NOTES_MAX),
      priority: updates.priority || inc.priority,
      escalationTier: updates.escalationTier || inc.escalationTier,
      auditLog: [...existingLog, auditEntry],
      updatedAt: now,
    };
  });
  safeWriteJson(STORAGE_KEYS.INCIDENTS, next);
  return next;
}

// --- Firebase Firestore Persistence Layer ---

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function fetchFirebaseUserProfile(
  uid: string,
  authEmail: string | null,
  authDisplayName: string | null
): Promise<{ profile: UserProfile | null; isAdmin: boolean }> {
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/contactInfo`;
  let isAdmin = authEmail === BOOTSTRAPPED_ADMIN_EMAIL;

  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) {
      isAdmin = true;
    }
  } catch {
    // Non-admin users may not have an admins doc; ignore
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      return { profile: null, isAdmin };
    }
    const uData = userSnap.data();

    let email = authEmail || '';
    let phone = '';
    let commuteRoute = '';
    try {
      const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'contactInfo'));
      if (privSnap.exists()) {
        const pData = privSnap.data();
        email = String(pData.email || email);
        phone = String(pData.phone || '');
        commuteRoute = String(pData.commuteRoute || '');
      }
    } catch (privErr) {
      handleFirestoreError(privErr, OperationType.GET, privatePath);
    }

    return {
      isAdmin,
      profile: {
        uid,
        displayName: String(uData.displayName || authDisplayName || 'Campus Student'),
        studentId: String(uData.studentId || 'UNASSIGNED'),
        department: String(uData.department || 'General'),
        role: isAdmin ? 'admin' : (uData.role as UserRole) || 'student',
        email,
        phone,
        commuteRoute,
        authMode: 'firebase',
        createdAt: timestampToIso(uData.createdAt),
        updatedAt: timestampToIso(uData.updatedAt),
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }
}

export async function saveFirebaseUserProfile(input: {
  uid: string;
  displayName: string;
  studentId: string;
  department: string;
  email: string;
  phone: string;
  commuteRoute: string;
  role: UserRole;
  isNew: boolean;
}): Promise<UserProfile> {
  const userPath = `users/${input.uid}`;
  const privatePath = `users/${input.uid}/private/contactInfo`;
  const cleanName = input.displayName.trim().slice(0, VALIDATION_LIMITS.NAME_MAX);
  const cleanStudentId = input.studentId.trim().slice(0, VALIDATION_LIMITS.STUDENT_ID_MAX);
  const cleanDept = input.department.trim().slice(0, VALIDATION_LIMITS.DEPARTMENT_MAX);
  const cleanEmail = input.email.trim().slice(0, VALIDATION_LIMITS.EMAIL_MAX);
  const cleanPhone = input.phone.trim().slice(0, VALIDATION_LIMITS.PHONE_MAX);
  const cleanCommute = input.commuteRoute.trim().slice(0, VALIDATION_LIMITS.COMMUTE_MAX);

  try {
    if (input.isNew) {
      await setDoc(doc(db, 'users', input.uid), {
        uid: input.uid,
        displayName: cleanName,
        studentId: cleanStudentId,
        department: cleanDept,
        role: input.role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', input.uid), {
        displayName: cleanName,
        studentId: cleanStudentId,
        department: cleanDept,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, input.isNew ? OperationType.CREATE : OperationType.UPDATE, userPath);
  }

  try {
    const privRef = doc(db, 'users', input.uid, 'private', 'contactInfo');
    const privSnap = await getDoc(privRef);
    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid: input.uid,
        email: cleanEmail,
        phone: cleanPhone,
        commuteRoute: cleanCommute,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, {
        email: cleanEmail,
        phone: cleanPhone,
        commuteRoute: cleanCommute,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  const now = new Date().toISOString();
  return {
    uid: input.uid,
    displayName: cleanName,
    studentId: cleanStudentId,
    department: cleanDept,
    role: input.role,
    email: cleanEmail,
    phone: cleanPhone,
    commuteRoute: cleanCommute,
    authMode: 'firebase',
    createdAt: now,
    updatedAt: now,
  };
}

export function subscribeFirebaseContacts(
  uid: string,
  onData: (contacts: TrustedContact[]) => void
): () => void {
  const path = `users/${uid}/contacts`;
  const q = query(collection(db, 'users', uid, 'contacts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: TrustedContact[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          ownerUid: String(data.ownerUid || uid),
          name: String(data.name || ''),
          relationship: String(data.relationship || ''),
          phone: String(data.phone || ''),
          email: String(data.email || ''),
          notifyOnSos: Boolean(data.notifyOnSos),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveFirebaseContact(
  uid: string,
  contact: Omit<TrustedContact, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const path = `users/${uid}/contacts/${contact.id}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'users', uid, 'contacts', contact.id), {
        id: contact.id,
        ownerUid: uid,
        name: contact.name.trim().slice(0, VALIDATION_LIMITS.NAME_MAX),
        relationship: contact.relationship.trim().slice(0, 50),
        phone: contact.phone.trim().slice(0, VALIDATION_LIMITS.PHONE_MAX),
        email: contact.email.trim().slice(0, VALIDATION_LIMITS.EMAIL_MAX),
        notifyOnSos: Boolean(contact.notifyOnSos),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'users', uid, 'contacts', contact.id), {
        name: contact.name.trim().slice(0, VALIDATION_LIMITS.NAME_MAX),
        relationship: contact.relationship.trim().slice(0, 50),
        phone: contact.phone.trim().slice(0, VALIDATION_LIMITS.PHONE_MAX),
        email: contact.email.trim().slice(0, VALIDATION_LIMITS.EMAIL_MAX),
        notifyOnSos: Boolean(contact.notifyOnSos),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeFirebaseContact(uid: string, contactId: string): Promise<void> {
  const path = `users/${uid}/contacts/${contactId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'contacts', contactId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeFirebaseIncidents(
  uid: string,
  isAdmin: boolean,
  onData: (incidents: IncidentReport[]) => void
): () => void {
  const path = 'incidents';
  const q = isAdmin
    ? query(collection(db, 'incidents'), orderBy('createdAt', 'desc'))
    : query(collection(db, 'incidents'), where('reporterUid', '==', uid), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const items: IncidentReport[] = snap.docs.map((d) => {
        const data = d.data();
        const sector = getSectorById(String(data.sectorId || CAMPUS_SECTORS[0].id));
        const category = data.category as EmergencyCategory;
        const priority = data.priority as IncidentPriority;
        const escalation = computeEscalationWorkflow({
          category,
          priority,
          isSos: Boolean(data.isSos),
          isLateNight: Boolean(data.isLateNight),
          isAlone: Boolean(data.isAlone),
          sectorId: sector.id,
        });
        const priorityInfo = classifyIncidentPriority({
          category,
          description: String(data.description || ''),
          isSos: Boolean(data.isSos),
          isLateNight: Boolean(data.isLateNight),
          isAlone: Boolean(data.isAlone),
          sectorId: sector.id,
        });
        const notifiedNames = Array.isArray(data.notifiedContactNames)
          ? (data.notifiedContactNames as string[])
          : [];
        return {
          id: String(data.id || d.id),
          reporterUid: String(data.reporterUid || ''),
          reporterName: String(data.reporterName || 'Student'),
          reporterStudentId: String(data.reporterStudentId || ''),
          category,
          description: String(data.description || ''),
          sectorId: sector.id,
          sectorName: String(data.sectorName || sector.name),
          simulatedLat: Number(data.simulatedLat ?? sector.simulatedLat),
          simulatedLng: Number(data.simulatedLng ?? sector.simulatedLng),
          coordinatesShared: Boolean(data.coordinatesShared),
          isSos: Boolean(data.isSos),
          isLateNight: Boolean(data.isLateNight),
          isAlone: Boolean(data.isAlone),
          priority,
          priorityScore: Number(data.priorityScore ?? priorityInfo.priorityScore),
          priorityReasons: priorityInfo.reasons,
          status: data.status as IncidentStatus,
          responseCategory: String(data.responseCategory || escalation.responseCategory),
          escalationTier: String(data.escalationTier || escalation.escalationTier),
          recommendedUnit: escalation.recommendedUnit,
          nextActionStudent: String(data.nextActionStudent || escalation.nextActionStudent),
          nextActionResponder: String(data.nextActionResponder || escalation.nextActionResponder),
          autoEscalated: escalation.autoEscalated,
          workflowSteps: escalation.workflowSteps,
          notifiedContactNames: notifiedNames,
          notificationLogs: notifiedNames.map((name, idx) => ({
            id: `sim_${d.id}_${idx}`,
            contactName: name,
            relationship: 'Trusted Contact',
            phone: 'Verified Contact',
            channel: 'SMS & Email (Simulated)',
            status: 'Delivered (Simulated)',
            messagePreview: `[PROTOTYPE ALERT] Emergency alert dispatched for ${category} at ${data.sectorName}.`,
            simulatedAt: timestampToIso(data.createdAt),
          })),
          assignedUnit: String(data.assignedUnit || ''),
          responderNotes: String(data.responderNotes || ''),
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createFirebaseIncident(incident: IncidentReport): Promise<void> {
  const path = `incidents/${incident.id}`;
  try {
    await setDoc(doc(db, 'incidents', incident.id), {
      id: incident.id,
      reporterUid: incident.reporterUid,
      reporterName: incident.reporterName.slice(0, VALIDATION_LIMITS.NAME_MAX),
      reporterStudentId: incident.reporterStudentId.slice(0, VALIDATION_LIMITS.STUDENT_ID_MAX),
      category: incident.category,
      description: incident.description.slice(0, VALIDATION_LIMITS.DESCRIPTION_MAX),
      sectorId: incident.sectorId,
      sectorName: incident.sectorName.slice(0, 120),
      simulatedLat: incident.simulatedLat,
      simulatedLng: incident.simulatedLng,
      coordinatesShared: incident.coordinatesShared,
      isSos: incident.isSos,
      isLateNight: incident.isLateNight,
      isAlone: incident.isAlone,
      priority: incident.priority,
      priorityScore: incident.priorityScore,
      status: 'Reported',
      responseCategory: incident.responseCategory.slice(0, 120),
      escalationTier: incident.escalationTier.slice(0, 80),
      nextActionStudent: incident.nextActionStudent.slice(0, 400),
      nextActionResponder: incident.nextActionResponder.slice(0, 400),
      notifiedContactNames: incident.notifiedContactNames
        .slice(0, VALIDATION_LIMITS.MAX_CONTACTS_PER_SOS)
        .map((n) => n.slice(0, 100)),
      assignedUnit: '',
      responderNotes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFirebaseIncidentStatus(
  incidentId: string,
  updates: {
    status: IncidentStatus;
    assignedUnit: string;
    responderNotes: string;
    priority: IncidentPriority;
    escalationTier: string;
  }
): Promise<void> {
  const path = `incidents/${incidentId}`;
  try {
    await updateDoc(doc(db, 'incidents', incidentId), {
      status: updates.status,
      assignedUnit: updates.assignedUnit.trim().slice(0, VALIDATION_LIMITS.ASSIGNED_UNIT_MAX),
      responderNotes: updates.responderNotes.trim().slice(0, VALIDATION_LIMITS.RESPONDER_NOTES_MAX),
      priority: updates.priority,
      escalationTier: updates.escalationTier.slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function buildNewIncidentObject(params: {
  user: UserProfile;
  contacts: TrustedContact[];
  category: EmergencyCategory;
  description: string;
  sectorId: string;
  simulatedLat: number;
  simulatedLng: number;
  coordinatesShared: boolean;
  isSos: boolean;
  isLateNight: boolean;
  isAlone: boolean;
}): IncidentReport {
  const sector = getSectorById(params.sectorId);
  const priorityInfo = classifyIncidentPriority({
    category: params.category,
    description: params.description,
    isSos: params.isSos,
    isLateNight: params.isLateNight,
    isAlone: params.isAlone,
    sectorId: sector.id,
  });
  const escalation = computeEscalationWorkflow({
    category: params.category,
    priority: priorityInfo.priority,
    isSos: params.isSos,
    isLateNight: params.isLateNight,
    isAlone: params.isAlone,
    sectorId: sector.id,
  });
  const notificationLogs = simulateContactNotifications(params.contacts, {
    studentName: params.user.displayName,
    category: params.category,
    sectorName: sector.name,
    priority: priorityInfo.priority,
    coordinatesShared: params.coordinatesShared,
    simulatedLat: params.simulatedLat,
    simulatedLng: params.simulatedLng,
  });

  const now = new Date().toISOString();
  return {
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reporterUid: params.user.uid,
    reporterName: params.user.displayName,
    reporterStudentId: params.user.studentId,
    category: params.category,
    description: params.description.trim(),
    sectorId: sector.id,
    sectorName: sector.name,
    simulatedLat: params.simulatedLat,
    simulatedLng: params.simulatedLng,
    coordinatesShared: params.coordinatesShared,
    isSos: params.isSos,
    isLateNight: params.isLateNight,
    isAlone: params.isAlone,
    priority: priorityInfo.priority,
    priorityScore: priorityInfo.priorityScore,
    priorityReasons: priorityInfo.reasons,
    status: 'Reported',
    responseCategory: escalation.responseCategory,
    escalationTier: escalation.escalationTier,
    recommendedUnit: escalation.recommendedUnit,
    nextActionStudent: escalation.nextActionStudent,
    nextActionResponder: escalation.nextActionResponder,
    autoEscalated: escalation.autoEscalated,
    workflowSteps: escalation.workflowSteps,
    notifiedContactNames: notificationLogs.map((l) => l.contactName),
    notificationLogs,
    assignedUnit: '',
    responderNotes: '',
    auditLog: [
      {
        id: `aud_${Date.now()}_1`,
        timestamp: now,
        actor: params.user.displayName,
        action: params.isSos ? 'SOS Beacon Logged' : 'Incident Reported',
        detail: `${params.category} at ${sector.name}`,
      },
      ...(notificationLogs.length > 0
        ? [
            {
              id: `aud_${Date.now()}_2`,
              timestamp: now,
              actor: 'CampusShield Engine',
              action: 'Trusted Contacts Notified (Simulated)',
              detail: `${notificationLogs.length} emergency contact receipt(s) queued.`,
            },
          ]
        : []),
    ],
    createdAt: now,
    updatedAt: now,
  };
}
