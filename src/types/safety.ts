export type EmergencyCategory =
  | 'Medical Emergency'
  | 'Harassment / Stalking'
  | 'Suspicious Activity'
  | 'Late-Night Travel / Escort Needed'
  | 'Physical Threat / Assault'
  | 'Accident / Infrastructure Hazard';

export type IncidentPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type IncidentStatus = 'Reported' | 'Acknowledged' | 'Dispatched' | 'Resolved';

export type UserRole = 'student' | 'admin';

export interface CampusSector {
  id: string;
  name: string;
  shortCode: string;
  zoneType: 'Academic' | 'Residential' | 'Transit' | 'Perimeter' | 'Recreation';
  simulatedLat: number;
  simulatedLng: number;
  mapX: number; // SVG coordinate 0..800
  mapY: number; // SVG coordinate 0..480
  baseSafetyScore: number; // 1..10
  lightingLevel: 'Well-Lit' | 'Moderate' | 'Low Lighting';
  nearestGuardPost: string;
  patrolIntervalMinutes: number;
  defaultTips: string[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  studentId: string;
  department: string;
  role: UserRole;
  email: string;
  phone: string;
  commuteRoute: string;
  authMode: 'firebase' | 'prototype';
  createdAt: string;
  updatedAt: string;
}

export interface TrustedContact {
  id: string;
  ownerUid: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notifyOnSos: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLogEntry {
  id: string;
  contactName: string;
  relationship: string;
  phone: string;
  channel: 'SMS & Email (Simulated)' | 'SMS Priority Alert (Simulated)';
  status: 'Delivered (Simulated)';
  messagePreview: string;
  simulatedAt: string;
}

export interface EscalationStep {
  step: number;
  actor: 'System' | 'Student' | 'Security' | 'Contacts';
  action: string;
}

export interface EscalationWorkflow {
  responseCategory: string;
  escalationTier: string;
  recommendedUnit: string;
  nextActionStudent: string;
  nextActionResponder: string;
  autoEscalated: boolean;
  workflowSteps: EscalationStep[];
}

export interface PriorityClassification {
  priority: IncidentPriority;
  priorityScore: number; // 0..100
  reasons: string[];
}

export interface IncidentAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

export interface AiIncidentBrief {
  riskSummary: string;
  recommendedPatrolAction: string;
  studentSafetyDirective: string;
  checkList: string[];
}

export interface SafeRouteOption {
  label: 'Safest Illuminated Route' | 'Direct / Fastest Route';
  sectors: CampusSector[];
  totalMinutes: number;
  safetyScore: number;
  lightingCoveragePercent: number;
  guardPostsPassed: number;
  activeAlertsOnPath: number;
  turnByTurn: string[];
}

export interface SafeRoutePlan {
  origin: CampusSector;
  destination: CampusSector;
  mode: 'walking' | 'shuttle';
  isLateNight: boolean;
  safest: SafeRouteOption;
  fastest: SafeRouteOption;
}

export interface IncidentReport {
  id: string;
  reporterUid: string;
  reporterName: string;
  reporterStudentId: string;
  category: EmergencyCategory;
  description: string;
  sectorId: string;
  sectorName: string;
  simulatedLat: number;
  simulatedLng: number;
  coordinatesShared: boolean;
  isSos: boolean;
  isLateNight: boolean;
  isAlone: boolean;
  priority: IncidentPriority;
  priorityScore: number;
  priorityReasons: string[];
  status: IncidentStatus;
  responseCategory: string;
  escalationTier: string;
  recommendedUnit: string;
  nextActionStudent: string;
  nextActionResponder: string;
  autoEscalated: boolean;
  workflowSteps: EscalationStep[];
  notifiedContactNames: string[];
  notificationLogs: NotificationLogEntry[];
  assignedUnit: string;
  responderNotes: string;
  auditLog?: IncidentAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface SafetyCheckinResult {
  id: string;
  sector: CampusSector;
  safetyScore: number;
  riskLabel: 'Low Risk' | 'Moderate Caution' | 'Elevated Risk';
  activeIncidentCount: number;
  safetyTips: string[];
  checkedAt: string;
}

export interface IncidentStatistics {
  totalIncidents: number;
  activeIncidents: number;
  criticalOrHighCount: number;
  resolvedCount: number;
  resolvedRatePercent: number;
  sosCount: number;
  byCategory: { category: EmergencyCategory; count: number }[];
  byPriority: { priority: IncidentPriority; count: number }[];
  byStatus: { status: IncidentStatus; count: number }[];
  bySector: { sectorId: string; sectorName: string; count: number }[];
}

export interface SectorDangerCluster {
  sector: CampusSector;
  incidentCount: number;
  activeCount: number;
  criticalHighCount: number;
  sosCount: number;
  weightedDangerScore: number; // 0..100
  riskLevel: 'Critical Cluster' | 'High Cluster' | 'Moderate' | 'Low';
  dominantCategory: EmergencyCategory | 'None';
}

export interface HeatSamplePoint {
  id: string;
  sectorId: string;
  lat: number;
  lng: number;
  weight: number; // 0.2..1.0
  priority: IncidentPriority;
  isActive: boolean;
}

export const EMERGENCY_CATEGORIES: EmergencyCategory[] = [
  'Medical Emergency',
  'Harassment / Stalking',
  'Suspicious Activity',
  'Late-Night Travel / Escort Needed',
  'Physical Threat / Assault',
  'Accident / Infrastructure Hazard',
];

export const INCIDENT_STATUSES: IncidentStatus[] = [
  'Reported',
  'Acknowledged',
  'Dispatched',
  'Resolved',
];

export const VALIDATION_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  NAME_MIN: 2,
  NAME_MAX: 100,
  STUDENT_ID_MIN: 3,
  STUDENT_ID_MAX: 32,
  DEPARTMENT_MIN: 2,
  DEPARTMENT_MAX: 80,
  PHONE_MIN: 6,
  PHONE_MAX: 30,
  EMAIL_MAX: 160,
  COMMUTE_MAX: 160,
  DESCRIPTION_MIN: 5,
  DESCRIPTION_MAX: 1000,
  RESPONDER_NOTES_MAX: 500,
  ASSIGNED_UNIT_MAX: 100,
  MAX_CONTACTS_PER_SOS: 10,
} as const;
