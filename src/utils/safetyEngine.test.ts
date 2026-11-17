import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPUS_SECTORS,
  classifyIncidentPriority,
  computeEscalationWorkflow,
  computeIncidentHeatPoints,
  computeIncidentStatistics,
  computeSafeRoute,
  computeSectorDangerClusters,
  escalateIncidentTier,
  evaluateSectorSafetyCheckin,
  formatIncidentsCsv,
  simulateContactNotifications,
  validateContactInput,
  validateIncidentInput,
  validateProfileInput,
} from './safetyEngine';
import { IncidentReport, TrustedContact } from '../types/safety';

test('classifyIncidentPriority assigns Critical for SOS physical assault at night', () => {
  const result = classifyIncidentPriority({
    category: 'Physical Threat / Assault',
    description: 'Someone is chasing me near the gate with a weapon',
    isSos: true,
    isLateNight: true,
    isAlone: true,
    sectorId: 'sector-west-walkway',
  });

  assert.equal(result.priority, 'Critical');
  assert.ok(result.priorityScore >= 78);
  assert.ok(result.reasons.length >= 4);
});

test('classifyIncidentPriority assigns Low or Medium for daytime minor hazard', () => {
  const result = classifyIncidentPriority({
    category: 'Accident / Infrastructure Hazard',
    description: 'Broken bench along main library corridor',
    isSos: false,
    isLateNight: false,
    isAlone: false,
    sectorId: 'sector-main-gate',
  });

  assert.ok(result.priority === 'Medium' || result.priority === 'Low');
  assert.ok(result.priorityScore < 58);
});

test('computeEscalationWorkflow identifies medical response category and next actions', () => {
  const workflow = computeEscalationWorkflow({
    category: 'Medical Emergency',
    priority: 'Critical',
    isSos: true,
    isLateNight: false,
    isAlone: true,
    sectorId: 'sector-engineering-block',
  });

  assert.equal(workflow.responseCategory, 'Campus Medical & Rapid Ambulance Unit');
  assert.equal(workflow.autoEscalated, true);
  assert.match(workflow.escalationTier, /Tier 3/);
  assert.equal(workflow.workflowSteps.length, 4);
  assert.ok(workflow.nextActionStudent.length > 10);
  assert.ok(workflow.nextActionResponder.length > 10);
});

test('computeEscalationWorkflow identifies Safe-Walk Escort for late-night travel', () => {
  const workflow = computeEscalationWorkflow({
    category: 'Late-Night Travel / Escort Needed',
    priority: 'High',
    isSos: false,
    isLateNight: true,
    isAlone: true,
    sectorId: 'sector-parking-c',
  });

  assert.equal(workflow.responseCategory, 'Safe-Walk Escort & Shuttle Dispatch');
  assert.match(workflow.recommendedUnit, /Safe-Walk/);
});

test('evaluateSectorSafetyCheckin lowers score when active critical incidents exist', () => {
  const baseCheck = evaluateSectorSafetyCheckin('Main Gate', [], false);
  const sampleIncident: IncidentReport = {
    id: 'inc-1',
    reporterUid: 'u1',
    reporterName: 'Nadia Islam',
    reporterStudentId: '2305341401',
    category: 'Harassment / Stalking',
    description: 'Suspicious individual following students',
    sectorId: CAMPUS_SECTORS[0].id,
    sectorName: CAMPUS_SECTORS[0].name,
    simulatedLat: 23.8768,
    simulatedLng: 90.3204,
    coordinatesShared: true,
    isSos: true,
    isLateNight: true,
    isAlone: true,
    priority: 'Critical',
    priorityScore: 90,
    priorityReasons: [],
    status: 'Reported',
    responseCategory: 'Immediate Protective Security & Escort Intervention',
    escalationTier: 'Tier 3',
    recommendedUnit: 'Unit Alpha',
    nextActionStudent: 'Stay inside plaza',
    nextActionResponder: 'Dispatch immediately',
    autoEscalated: true,
    workflowSteps: [],
    notifiedContactNames: [],
    notificationLogs: [],
    assignedUnit: '',
    responderNotes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const activeCheck = evaluateSectorSafetyCheckin('Main Gate', [sampleIncident], true);
  assert.ok(activeCheck.safetyScore < baseCheck.safetyScore);
  assert.equal(activeCheck.activeIncidentCount, 1);
  assert.ok(activeCheck.safetyTips.length > 0);
});

test('simulateContactNotifications only notifies contacts with notifyOnSos enabled', () => {
  const contacts: TrustedContact[] = [
    {
      id: 'c1',
      ownerUid: 'u1',
      name: 'Farhana Ahmed',
      relationship: 'Mother',
      phone: '+8801711000111',
      email: 'farhana@example.com',
      notifyOnSos: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'c2',
      ownerUid: 'u1',
      name: 'Rafi Hasan',
      relationship: 'Classmate',
      phone: '+8801711000222',
      email: '',
      notifyOnSos: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const logs = simulateContactNotifications(contacts, {
    studentName: 'Sreya',
    category: 'Harassment / Stalking',
    sectorName: 'West Lakefront Walkway',
    priority: 'High',
    coordinatesShared: true,
    simulatedLat: 23.8789,
    simulatedLng: 90.3185,
  });

  assert.equal(logs.length, 1);
  assert.equal(logs[0].contactName, 'Farhana Ahmed');
  assert.equal(logs[0].status, 'Delivered (Simulated)');
  assert.match(logs[0].messagePreview, /23\.8789/);
});

test('computeIncidentStatistics aggregates counts accurately', () => {
  const base: Omit<IncidentReport, 'id' | 'status' | 'priority' | 'isSos'> = {
    reporterUid: 'u1',
    reporterName: 'Student A',
    reporterStudentId: '2305001',
    category: 'Suspicious Activity',
    description: 'Test description here',
    sectorId: 'sector-main-gate',
    sectorName: 'Main Gate & Security Plaza',
    simulatedLat: 23.8768,
    simulatedLng: 90.3204,
    coordinatesShared: false,
    isLateNight: false,
    isAlone: false,
    priorityScore: 50,
    priorityReasons: [],
    responseCategory: 'Campus Patrol',
    escalationTier: 'Tier 1',
    recommendedUnit: 'Unit A',
    nextActionStudent: 'Wait',
    nextActionResponder: 'Patrol',
    autoEscalated: false,
    workflowSteps: [],
    notifiedContactNames: [],
    notificationLogs: [],
    assignedUnit: '',
    responderNotes: '',
    createdAt: '',
    updatedAt: '',
  };

  const stats = computeIncidentStatistics([
    { ...base, id: '1', status: 'Reported', priority: 'Critical', isSos: true },
    { ...base, id: '2', status: 'Resolved', priority: 'Low', isSos: false },
  ]);

  assert.equal(stats.totalIncidents, 2);
  assert.equal(stats.activeIncidents, 1);
  assert.equal(stats.resolvedCount, 1);
  assert.equal(stats.resolvedRatePercent, 50);
  assert.equal(stats.criticalOrHighCount, 1);
  assert.equal(stats.sosCount, 1);
});

test('form validators reject empty or malformed inputs', () => {
  assert.ok(validateProfileInput({ displayName: 'A', studentId: '12', department: 'CS', phone: '123456' }) !== null);
  assert.equal(validateProfileInput({ displayName: 'Sreya Roy', studentId: '2305341433', department: 'Software Engineering', phone: '+8801711000111' }), null);

  assert.ok(validateContactInput({ name: 'X', relationship: 'Mom', phone: '123', email: 'bad-email' }) !== null);
  assert.equal(validateContactInput({ name: 'Ananya Roy', relationship: 'Sister', phone: '+8801711999888', email: 'ananya@example.com' }), null);

  assert.ok(validateIncidentInput({ description: 'hi', sectorId: 'sector-main-gate' }) !== null);
  assert.equal(validateIncidentInput({ description: 'Suspicious person near gate', sectorId: 'sector-main-gate' }), null);
});

test('computeSafeRoute avoids active incident sectors and compares walking vs shuttle', () => {
  const incidentAtWest: IncidentReport = {
    id: 'inc-west',
    reporterUid: 'u1',
    reporterName: 'Student',
    reporterStudentId: '2305001',
    category: 'Harassment / Stalking',
    description: 'Active incident near lakefront',
    sectorId: 'sector-west-walkway',
    sectorName: 'West Lakefront Walkway',
    simulatedLat: 23.8789,
    simulatedLng: 90.3185,
    coordinatesShared: true,
    isSos: true,
    isLateNight: true,
    isAlone: true,
    priority: 'Critical',
    priorityScore: 95,
    priorityReasons: [],
    status: 'Reported',
    responseCategory: 'Immediate Protective Security',
    escalationTier: 'Tier 3',
    recommendedUnit: 'Unit F',
    nextActionStudent: 'Stay safe',
    nextActionResponder: 'Dispatch',
    autoEscalated: true,
    workflowSteps: [],
    notifiedContactNames: [],
    notificationLogs: [],
    assignedUnit: '',
    responderNotes: '',
    createdAt: '',
    updatedAt: '',
  };

  const walkingPlan = computeSafeRoute('sector-main-gate', 'sector-parking-c', [incidentAtWest], {
    isLateNight: true,
    mode: 'walking',
  });
  assert.equal(walkingPlan.safest.sectors[0].id, 'sector-main-gate');
  assert.equal(walkingPlan.safest.sectors[walkingPlan.safest.sectors.length - 1].id, 'sector-parking-c');
  assert.ok(walkingPlan.safest.sectors.every((s) => s.id !== 'sector-west-walkway'));
  assert.ok(walkingPlan.safest.turnByTurn.length >= 2);

  const shuttlePlan = computeSafeRoute('sector-main-gate', 'sector-parking-c', [incidentAtWest], {
    isLateNight: true,
    mode: 'shuttle',
  });
  assert.ok(shuttlePlan.safest.totalMinutes <= walkingPlan.safest.totalMinutes);
});

test('escalateIncidentTier upgrades incident to Tier 3 Critical and formatIncidentsCsv outputs valid rows', () => {
  const sample: IncidentReport = {
    id: 'inc-csv-1',
    reporterUid: 'u1',
    reporterName: 'Sreya',
    reporterStudentId: '2305341433',
    category: 'Suspicious Activity',
    description: 'Unattended bag near gate',
    sectorId: 'sector-main-gate',
    sectorName: 'Main Gate & Security Plaza',
    simulatedLat: 23.8768,
    simulatedLng: 90.3204,
    coordinatesShared: true,
    isSos: false,
    isLateNight: false,
    isAlone: false,
    priority: 'Medium',
    priorityScore: 46,
    priorityReasons: [],
    status: 'Reported',
    responseCategory: 'Campus Patrol',
    escalationTier: 'Tier 1',
    recommendedUnit: 'Unit A',
    nextActionStudent: 'Wait',
    nextActionResponder: 'Sweep',
    autoEscalated: false,
    workflowSteps: [],
    notifiedContactNames: [],
    notificationLogs: [],
    assignedUnit: '',
    responderNotes: '',
    createdAt: '2026-11-16T19:00:00.000Z',
    updatedAt: '2026-11-16T19:00:00.000Z',
  };

  const escalated = escalateIncidentTier(sample);
  assert.equal(escalated.priority, 'Critical');
  assert.match(escalated.escalationTier, /Tier 3/);

  const csv = formatIncidentsCsv([sample]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /Reference ID,Category,Priority/);
  assert.match(lines[1], /inc-csv-1,Suspicious Activity,Medium/);
});

test('computeSectorDangerClusters ranks high-incident critical clusters above empty zones', () => {
  const makeInc = (
    id: string,
    sectorId: string,
    priority: IncidentReport['priority'],
    status: IncidentReport['status'],
    isSos: boolean
  ): IncidentReport => ({
    id,
    reporterUid: 'u1',
    reporterName: 'Tester',
    reporterStudentId: '2305001',
    category: 'Harassment / Stalking',
    description: 'Cluster test incident',
    sectorId,
    sectorName: sectorId,
    simulatedLat: 23.8789,
    simulatedLng: 90.3185,
    coordinatesShared: true,
    isSos,
    isLateNight: true,
    isAlone: true,
    priority,
    priorityScore: 80,
    priorityReasons: [],
    status,
    responseCategory: 'Security',
    escalationTier: 'Tier 3',
    recommendedUnit: 'Unit F',
    nextActionStudent: 'Stay safe',
    nextActionResponder: 'Dispatch',
    autoEscalated: true,
    workflowSteps: [],
    notifiedContactNames: [],
    notificationLogs: [],
    assignedUnit: '',
    responderNotes: '',
    createdAt: '2026-11-16T20:00:00.000Z',
    updatedAt: '2026-11-16T20:00:00.000Z',
  });

  const sampleList = [
    makeInc('h1', 'sector-west-walkway', 'Critical', 'Reported', true),
    makeInc('h2', 'sector-west-walkway', 'High', 'Resolved', true),
    makeInc('h3', 'sector-engineering-block', 'Medium', 'Dispatched', false),
  ];

  const allClusters = computeSectorDangerClusters(sampleList, { statusScope: 'all' });
  assert.equal(allClusters[0].sector.id, 'sector-west-walkway');
  assert.equal(allClusters[0].incidentCount, 2);
  assert.equal(allClusters[0].activeCount, 1);
  assert.equal(allClusters[0].riskLevel, 'Critical Cluster');
  assert.equal(allClusters[allClusters.length - 1].incidentCount, 0);

  const activeOnly = computeSectorDangerClusters(sampleList, { statusScope: 'active' });
  const westActive = activeOnly.find((c) => c.sector.id === 'sector-west-walkway');
  assert.equal(westActive?.incidentCount, 1);

  const heatPoints = computeIncidentHeatPoints(sampleList, { statusScope: 'all' });
  assert.equal(heatPoints.length, 3);
  assert.ok(heatPoints[0].weight > heatPoints[2].weight);
});


