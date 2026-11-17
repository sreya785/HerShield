import {
  CampusSector,
  EMERGENCY_CATEGORIES,
  EmergencyCategory,
  EscalationStep,
  EscalationWorkflow,
  HeatSamplePoint,
  INCIDENT_STATUSES,
  IncidentPriority,
  IncidentReport,
  IncidentStatistics,
  NotificationLogEntry,
  PriorityClassification,
  SafeRouteOption,
  SafeRoutePlan,
  SafetyCheckinResult,
  SectorDangerCluster,
  TrustedContact,
  VALIDATION_LIMITS,
} from '../types/safety';

export const CAMPUS_SECTORS: CampusSector[] = [
  {
    id: 'sector-main-gate',
    name: 'Main Gate & Security Plaza',
    shortCode: 'S1',
    zoneType: 'Perimeter',
    simulatedLat: 23.8768,
    simulatedLng: 90.3204,
    mapX: 145,
    mapY: 375,
    baseSafetyScore: 9,
    lightingLevel: 'Well-Lit',
    nearestGuardPost: 'Command Post Alpha (Main Gate)',
    patrolIntervalMinutes: 5,
    defaultTips: [
      'Remain inside the illuminated security plaza if waiting for campus transit.',
      'Confirm vehicle registration before boarding rideshare pickups outside Main Gate.',
    ],
  },
  {
    id: 'sector-central-library',
    name: 'Central Library & Academic Quad',
    shortCode: 'S2',
    zoneType: 'Academic',
    simulatedLat: 23.8781,
    simulatedLng: 90.3219,
    mapX: 385,
    mapY: 195,
    baseSafetyScore: 8,
    lightingLevel: 'Well-Lit',
    nearestGuardPost: 'Academic Desk Bravo (Library Lobby)',
    patrolIntervalMinutes: 8,
    defaultTips: [
      'Use the illuminated North Arcade walkway when departing after 20:00.',
      'Request a Safe-Walk escort from the Library Security Desk for late study exits.',
    ],
  },
  {
    id: 'sector-engineering-block',
    name: 'Engineering & Innovation Labs',
    shortCode: 'S3',
    zoneType: 'Academic',
    simulatedLat: 23.8794,
    simulatedLng: 90.3235,
    mapX: 595,
    mapY: 140,
    baseSafetyScore: 7,
    lightingLevel: 'Moderate',
    nearestGuardPost: 'Lab Wing Post Charlie',
    patrolIntervalMinutes: 12,
    defaultTips: [
      'Avoid the unmonitored East Courtyard shortcut after laboratory closing hours.',
      'Pair up with lab colleagues when walking toward the Transit Hub at night.',
    ],
  },
  {
    id: 'sector-south-dorms',
    name: 'South Residence Halls',
    shortCode: 'S4',
    zoneType: 'Residential',
    simulatedLat: 23.8755,
    simulatedLng: 90.3228,
    mapX: 520,
    mapY: 365,
    baseSafetyScore: 7,
    lightingLevel: 'Moderate',
    nearestGuardPost: 'Dormitory Gate Delta',
    patrolIntervalMinutes: 10,
    defaultTips: [
      'Keep student ID card ready at residential turnstiles and do not prop doors open.',
      'Use emergency call boxes spaced every 80 meters along South Walkway.',
    ],
  },
  {
    id: 'sector-transit-hub',
    name: 'Campus Bus & Shuttle Terminal',
    shortCode: 'S5',
    zoneType: 'Transit',
    simulatedLat: 23.8762,
    simulatedLng: 90.3191,
    mapX: 225,
    mapY: 265,
    baseSafetyScore: 6,
    lightingLevel: 'Moderate',
    nearestGuardPost: 'Transit Booth Echo',
    patrolIntervalMinutes: 10,
    defaultTips: [
      'Wait under CCTV canopy Zone B while awaiting evening shuttle departures.',
      'Share simulated route check-in with a trusted contact before boarding.',
    ],
  },
  {
    id: 'sector-west-walkway',
    name: 'West Lakefront Walkway',
    shortCode: 'S6',
    zoneType: 'Recreation',
    simulatedLat: 23.8789,
    simulatedLng: 90.3185,
    mapX: 165,
    mapY: 125,
    baseSafetyScore: 5,
    lightingLevel: 'Low Lighting',
    nearestGuardPost: 'West Perimeter Patrol Foxtrot',
    patrolIntervalMinutes: 18,
    defaultTips: [
      'Low ambient lighting after dusk; prefer the Central Quad route after 19:30.',
      'Keep phone battery above 20% and avoid wearing noise-canceling headphones alone.',
    ],
  },
  {
    id: 'sector-parking-c',
    name: 'North Parking Lot C & Annex',
    shortCode: 'S7',
    zoneType: 'Perimeter',
    simulatedLat: 23.8802,
    simulatedLng: 90.3211,
    mapX: 390,
    mapY: 75,
    baseSafetyScore: 5,
    lightingLevel: 'Low Lighting',
    nearestGuardPost: 'North Gate Post Golf',
    patrolIntervalMinutes: 15,
    defaultTips: [
      'Park near LED floodlight rows A1-A4 closest to the Academic Quad entrance.',
      'Use CampusShield Escort Request if returning to Lot C past 21:00.',
    ],
  },
];

export function getSectorById(sectorId: string): CampusSector {
  return CAMPUS_SECTORS.find((s) => s.id === sectorId) || CAMPUS_SECTORS[0];
}

export function findSectorByQuery(query: string): CampusSector {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return CAMPUS_SECTORS[0];
  }
  const exact = CAMPUS_SECTORS.find(
    (s) =>
      s.id.toLowerCase() === normalized ||
      s.shortCode.toLowerCase() === normalized ||
      s.name.toLowerCase() === normalized
  );
  if (exact) return exact;

  const partial = CAMPUS_SECTORS.find(
    (s) =>
      s.name.toLowerCase().includes(normalized) ||
      s.zoneType.toLowerCase().includes(normalized) ||
      s.nearestGuardPost.toLowerCase().includes(normalized)
  );
  return partial || CAMPUS_SECTORS[1];
}

const HIGH_RISK_KEYWORDS = [
  'weapon',
  'knife',
  'bleeding',
  'unconscious',
  'attack',
  'assault',
  'trapped',
  'chasing',
  'following',
  'fainted',
  'chest pain',
  'grabbed',
  'threat',
  'forced',
];

export function classifyIncidentPriority(input: {
  category: EmergencyCategory;
  description: string;
  isSos: boolean;
  isLateNight: boolean;
  isAlone: boolean;
  sectorId: string;
}): PriorityClassification {
  let score = 20;
  const reasons: string[] = [];

  const categoryWeights: Record<EmergencyCategory, number> = {
    'Physical Threat / Assault': 55,
    'Medical Emergency': 52,
    'Harassment / Stalking': 42,
    'Late-Night Travel / Escort Needed': 28,
    'Suspicious Activity': 26,
    'Accident / Infrastructure Hazard': 22,
  };

  const catWeight = categoryWeights[input.category];
  score += catWeight;
  reasons.push(`${input.category} baseline severity (+${catWeight})`);

  if (input.isSos) {
    score += 18;
    reasons.push('Immediate SOS beacon triggered (+18)');
  }

  if (input.isLateNight) {
    score += 10;
    reasons.push('Late-night visibility window (+10)');
  }

  if (input.isAlone) {
    score += 8;
    reasons.push('Student travelling alone (+8)');
  }

  const sector = getSectorById(input.sectorId);
  if (sector.baseSafetyScore <= 5) {
    score += 7;
    reasons.push(`${sector.name} low-lighting zone (+7)`);
  }

  const descLower = input.description.toLowerCase();
  const matchedKeywords = HIGH_RISK_KEYWORDS.filter((kw) => descLower.includes(kw));
  if (matchedKeywords.length > 0) {
    const keywordBoost = Math.min(15, matchedKeywords.length * 8);
    score += keywordBoost;
    reasons.push(`High-urgency indicators detected: ${matchedKeywords.slice(0, 3).join(', ')} (+${keywordBoost})`);
  }

  const clampedScore = Math.max(5, Math.min(100, score));
  let priority: IncidentPriority = 'Low';
  if (clampedScore >= 78) {
    priority = 'Critical';
  } else if (clampedScore >= 58) {
    priority = 'High';
  } else if (clampedScore >= 38) {
    priority = 'Medium';
  }

  return {
    priority,
    priorityScore: clampedScore,
    reasons,
  };
}

export function computeEscalationWorkflow(input: {
  category: EmergencyCategory;
  priority: IncidentPriority;
  isSos: boolean;
  isLateNight: boolean;
  isAlone: boolean;
  sectorId: string;
}): EscalationWorkflow {
  const sector = getSectorById(input.sectorId);
  const autoEscalated = input.priority === 'Critical' || input.isSos;

  let responseCategory = 'Campus Patrol & Investigation Unit';
  let recommendedUnit = `${sector.nearestGuardPost} Patrol`;
  let nextActionStudent =
    'Move to a brightly lit academic or security-staffed entrance and keep this status screen open.';
  let nextActionResponder =
    'Verify student check-in, dispatch nearest foot patrol, and log sector CCTV sweep.';

  switch (input.category) {
    case 'Medical Emergency':
      responseCategory = 'Campus Medical & Rapid Ambulance Unit';
      recommendedUnit = 'Med-Response Team 1 & Campus Health Center';
      nextActionStudent =
        'Stay stationary if injured, signal nearby bystanders or security desk, and keep phone line free for medic callback.';
      nextActionResponder =
        'Dispatch campus EMT kit immediately, clear nearest vehicle gate access, and prepare external EMS handoff (simulated).';
      break;
    case 'Physical Threat / Assault':
      responseCategory = 'Tactical Campus Security & Rapid Intervention';
      recommendedUnit = `Rapid Tactical Unit + ${sector.nearestGuardPost}`;
      nextActionStudent =
        'Move immediately into the nearest locked building or populated security booth. Do not confront the individual.';
      nextActionResponder =
        'Dispatch two-officer rapid response unit immediately, lock down adjacent CCTV feed, and alert Duty Supervisor.';
      break;
    case 'Harassment / Stalking':
      responseCategory = 'Immediate Protective Security & Escort Intervention';
      recommendedUnit = `Safe-Response Patrol (${sector.nearestGuardPost})`;
      nextActionStudent =
        'Enter the closest staffed facility (Library, Guard Post, or Hall Desk) and avoid walking toward isolated exits.';
      nextActionResponder =
        'Intercept along student route within 3 minutes, maintain visual escort to safe zone, and document suspect description.';
      break;
    case 'Late-Night Travel / Escort Needed':
      responseCategory = 'Safe-Walk Escort & Shuttle Dispatch';
      recommendedUnit = 'Safe-Walk Escort Unit & Night Shuttle 2';
      nextActionStudent =
        'Wait inside a well-lit checkpoint or building lobby until the assigned escort confirms badge verification.';
      nextActionResponder =
        'Assign nearest Safe-Walk officer or divert campus night shuttle to pick up student at sector checkpoint.';
      break;
    case 'Suspicious Activity':
      responseCategory = 'Campus Patrol & CCTV Surveillance Review';
      recommendedUnit = `Sector Patrol (${sector.nearestGuardPost})`;
      nextActionStudent =
        'Maintain safe distance, avoid direct engagement, and note any distinguishing clothing or direction of movement.';
      nextActionResponder =
        'Review live camera feeds for sector perimeter and conduct an immediate area sweep.';
      break;
    case 'Accident / Infrastructure Hazard':
      responseCategory = 'Facilities Safety & Perimeter Hazard Control';
      recommendedUnit = 'Campus Safety & Facilities Engineering Crew';
      nextActionStudent =
        'Keep clear of exposed electrical, structural, or roadway hazards and warn nearby pedestrians.';
      nextActionResponder =
        'Cordon off affected walkway or roadway, dispatch facilities maintenance, and reroute pedestrian traffic.';
      break;
  }

  let escalationTier = 'Tier 1 · Standard Campus Patrol';
  if (input.priority === 'Critical') {
    escalationTier = 'Tier 3 · Immediate Multi-Unit + External EMS Simulation';
  } else if (input.priority === 'High' || input.isSos) {
    escalationTier = 'Tier 2 · Priority Security Dispatch (< 4 min SLA)';
  }

  const workflowSteps: EscalationStep[] = [
    {
      step: 1,
      actor: 'System',
      action: `Classified as ${input.priority} priority and routed to ${responseCategory}.`,
    },
    {
      step: 2,
      actor: 'Contacts',
      action: autoEscalated
        ? 'Simulated priority SMS & email alerts queued for all active trusted emergency contacts.'
        : 'Trusted contact notification ready on standby or manual trigger.',
    },
    {
      step: 3,
      actor: 'Security',
      action: `${recommendedUnit} notified under ${escalationTier}.`,
    },
    {
      step: 4,
      actor: 'Student',
      action: nextActionStudent,
    },
  ];

  return {
    responseCategory,
    escalationTier,
    recommendedUnit,
    nextActionStudent,
    nextActionResponder,
    autoEscalated,
    workflowSteps,
  };
}

export function evaluateSectorSafetyCheckin(
  sectorOrQuery: string,
  incidents: IncidentReport[],
  isLateNight = false
): SafetyCheckinResult {
  const sector = findSectorByQuery(sectorOrQuery);
  const activeInSector = incidents.filter(
    (inc) => inc.sectorId === sector.id && inc.status !== 'Resolved'
  );

  let score = sector.baseSafetyScore;
  const criticalCount = activeInSector.filter((i) => i.priority === 'Critical').length;
  const highCount = activeInSector.filter((i) => i.priority === 'High').length;
  const otherCount = activeInSector.length - criticalCount - highCount;

  score -= criticalCount * 2.5;
  score -= highCount * 1.5;
  score -= otherCount * 0.75;
  if (isLateNight) {
    score -= 1;
  }

  const clampedScore = Math.max(1, Math.min(10, Math.round(score)));
  let riskLabel: SafetyCheckinResult['riskLabel'] = 'Low Risk';
  if (clampedScore <= 4) {
    riskLabel = 'Elevated Risk';
  } else if (clampedScore <= 7) {
    riskLabel = 'Moderate Caution';
  }

  const dynamicTips = [...sector.defaultTips];
  if (activeInSector.length > 0) {
    dynamicTips.unshift(
      `${activeInSector.length} active incident report(s) in ${sector.name} — coordinate with ${sector.nearestGuardPost}.`
    );
  }
  if (isLateNight) {
    dynamicTips.push('Late-night hours active: keep simulated coordinate sharing enabled during transit.');
  }

  return {
    id: `chk_${Date.now()}`,
    sector,
    safetyScore: clampedScore,
    riskLabel,
    activeIncidentCount: activeInSector.length,
    safetyTips: dynamicTips.slice(0, 4),
    checkedAt: new Date().toISOString(),
  };
}

export function simulateContactNotifications(
  contacts: TrustedContact[],
  params: {
    studentName: string;
    category: EmergencyCategory;
    sectorName: string;
    priority: IncidentPriority;
    coordinatesShared: boolean;
    simulatedLat: number;
    simulatedLng: number;
    isTestOnly?: boolean;
  }
): NotificationLogEntry[] {
  const activeContacts = contacts.filter((c) => c.notifyOnSos).slice(0, VALIDATION_LIMITS.MAX_CONTACTS_PER_SOS);
  const now = new Date().toISOString();
  const coordText = params.coordinatesShared
    ? `Simulated Coords: ${params.simulatedLat.toFixed(4)}° N, ${params.simulatedLng.toFixed(4)}° E`
    : 'Coordinates withheld by user';

  return activeContacts.map((contact, idx) => ({
    id: `sim_${Date.now()}_${idx}`,
    contactName: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    channel:
      params.priority === 'Critical' || params.priority === 'High'
        ? 'SMS Priority Alert (Simulated)'
        : 'SMS & Email (Simulated)',
    status: 'Delivered (Simulated)',
    messagePreview: params.isTestOnly
      ? `[PROTOTYPE TEST] ${params.studentName} verified CampusShield emergency alert link for ${params.sectorName}.`
      : `[PROTOTYPE ALERT] ${params.studentName} reported ${params.category} (${params.priority}) at ${params.sectorName}. ${coordText}.`,
    simulatedAt: now,
  }));
}

export function computeIncidentStatistics(incidents: IncidentReport[]): IncidentStatistics {
  const totalIncidents = incidents.length;
  const activeIncidents = incidents.filter((i) => i.status !== 'Resolved').length;
  const criticalOrHighCount = incidents.filter(
    (i) => i.priority === 'Critical' || i.priority === 'High'
  ).length;
  const resolvedCount = incidents.filter((i) => i.status === 'Resolved').length;
  const resolvedRatePercent =
    totalIncidents === 0 ? 0 : Math.round((resolvedCount / totalIncidents) * 100);
  const sosCount = incidents.filter((i) => i.isSos).length;

  const byCategory = EMERGENCY_CATEGORIES.map((category) => ({
    category,
    count: incidents.filter((i) => i.category === category).length,
  }));

  const priorityOrder: IncidentPriority[] = ['Critical', 'High', 'Medium', 'Low'];
  const byPriority = priorityOrder.map((priority) => ({
    priority,
    count: incidents.filter((i) => i.priority === priority).length,
  }));

  const byStatus = INCIDENT_STATUSES.map((status) => ({
    status,
    count: incidents.filter((i) => i.status === status).length,
  }));

  const bySector = CAMPUS_SECTORS.map((sector) => ({
    sectorId: sector.id,
    sectorName: sector.name,
    count: incidents.filter((i) => i.sectorId === sector.id).length,
  }));

  return {
    totalIncidents,
    activeIncidents,
    criticalOrHighCount,
    resolvedCount,
    resolvedRatePercent,
    sosCount,
    byCategory,
    byPriority,
    byStatus,
    bySector,
  };
}

export function validateProfileInput(input: {
  displayName: string;
  studentId: string;
  department: string;
  phone: string;
}): string | null {
  const name = input.displayName.trim();
  const sid = input.studentId.trim();
  const dept = input.department.trim();
  const phone = input.phone.trim();

  if (name.length < VALIDATION_LIMITS.NAME_MIN || name.length > VALIDATION_LIMITS.NAME_MAX) {
    return `Full name must be between ${VALIDATION_LIMITS.NAME_MIN} and ${VALIDATION_LIMITS.NAME_MAX} characters.`;
  }
  if (
    sid.length < VALIDATION_LIMITS.STUDENT_ID_MIN ||
    sid.length > VALIDATION_LIMITS.STUDENT_ID_MAX ||
    !VALIDATION_LIMITS.ID_PATTERN.test(sid)
  ) {
    return 'Student or Badge ID must be 3-32 alphanumeric characters (dashes/underscores allowed).';
  }
  if (dept.length < VALIDATION_LIMITS.DEPARTMENT_MIN || dept.length > VALIDATION_LIMITS.DEPARTMENT_MAX) {
    return 'Department or unit name is required.';
  }
  if (phone.length < VALIDATION_LIMITS.PHONE_MIN || phone.length > VALIDATION_LIMITS.PHONE_MAX) {
    return 'Valid contact phone number is required (6-30 characters).';
  }
  return null;
}

export function validateContactInput(input: {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}): string | null {
  const name = input.name.trim();
  const rel = input.relationship.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();

  if (name.length < VALIDATION_LIMITS.NAME_MIN || name.length > VALIDATION_LIMITS.NAME_MAX) {
    return 'Contact name must be at least 2 characters.';
  }
  if (rel.length < 2 || rel.length > 50) {
    return 'Relationship is required (e.g., Parent, Roommate, Guardian).';
  }
  if (phone.length < VALIDATION_LIMITS.PHONE_MIN || phone.length > VALIDATION_LIMITS.PHONE_MAX) {
    return 'Phone number must be between 6 and 30 characters.';
  }
  if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address or leave email blank.';
  }
  return null;
}

export function validateIncidentInput(input: {
  description: string;
  sectorId: string;
}): string | null {
  const desc = input.description.trim();
  if (desc.length < VALIDATION_LIMITS.DESCRIPTION_MIN || desc.length > VALIDATION_LIMITS.DESCRIPTION_MAX) {
    return `Incident details must be between ${VALIDATION_LIMITS.DESCRIPTION_MIN} and ${VALIDATION_LIMITS.DESCRIPTION_MAX} characters.`;
  }
  if (!input.sectorId || !CAMPUS_SECTORS.some((s) => s.id === input.sectorId)) {
    return 'Please select a valid campus sector.';
  }
  return null;
}

interface WalkwayEdge {
  from: string;
  to: string;
  walkMinutes: number;
}

const CAMPUS_WALKWAY_EDGES: WalkwayEdge[] = [
  { from: 'sector-main-gate', to: 'sector-transit-hub', walkMinutes: 3 },
  { from: 'sector-main-gate', to: 'sector-south-dorms', walkMinutes: 5 },
  { from: 'sector-transit-hub', to: 'sector-central-library', walkMinutes: 3 },
  { from: 'sector-transit-hub', to: 'sector-south-dorms', walkMinutes: 4 },
  { from: 'sector-transit-hub', to: 'sector-west-walkway', walkMinutes: 4 },
  { from: 'sector-central-library', to: 'sector-engineering-block', walkMinutes: 3 },
  { from: 'sector-central-library', to: 'sector-south-dorms', walkMinutes: 4 },
  { from: 'sector-central-library', to: 'sector-parking-c', walkMinutes: 3 },
  { from: 'sector-west-walkway', to: 'sector-parking-c', walkMinutes: 4 },
  { from: 'sector-parking-c', to: 'sector-engineering-block', walkMinutes: 4 },
  { from: 'sector-engineering-block', to: 'sector-south-dorms', walkMinutes: 5 },
];

function getNeighbors(sectorId: string): { neighborId: string; walkMinutes: number }[] {
  const out: { neighborId: string; walkMinutes: number }[] = [];
  for (const edge of CAMPUS_WALKWAY_EDGES) {
    if (edge.from === sectorId) out.push({ neighborId: edge.to, walkMinutes: edge.walkMinutes });
    if (edge.to === sectorId) out.push({ neighborId: edge.from, walkMinutes: edge.walkMinutes });
  }
  return out;
}

function findOptimalPath(
  originId: string,
  destinationId: string,
  weightFn: (sector: CampusSector, walkMinutes: number) => number
): { sectorIds: string[]; totalMinutes: number } {
  const dist: Record<string, number> = {};
  const minutesMap: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const s of CAMPUS_SECTORS) {
    dist[s.id] = Infinity;
    minutesMap[s.id] = 0;
    prev[s.id] = null;
    unvisited.add(s.id);
  }
  dist[originId] = 0;

  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      if (dist[id] < best) {
        best = dist[id];
        current = id;
      }
    }
    if (!current || current === destinationId || best === Infinity) break;
    unvisited.delete(current);

    for (const { neighborId, walkMinutes } of getNeighbors(current)) {
      if (!unvisited.has(neighborId)) continue;
      const neighborSector = getSectorById(neighborId);
      const cost = dist[current] + weightFn(neighborSector, walkMinutes);
      if (cost < dist[neighborId]) {
        dist[neighborId] = cost;
        minutesMap[neighborId] = minutesMap[current] + walkMinutes;
        prev[neighborId] = current;
      }
    }
  }

  const path: string[] = [];
  let step: string | null = destinationId;
  while (step) {
    path.unshift(step);
    step = prev[step];
  }
  if (path[0] !== originId) {
    return { sectorIds: [originId, destinationId], totalMinutes: 5 };
  }
  return { sectorIds: path, totalMinutes: minutesMap[destinationId] };
}

function summarizeRoute(
  label: SafeRouteOption['label'],
  sectorIds: string[],
  rawMinutes: number,
  mode: 'walking' | 'shuttle',
  incidents: IncidentReport[],
  isLateNight: boolean
): SafeRouteOption {
  const sectors = sectorIds.map((id) => getSectorById(id));
  const totalMinutes =
    mode === 'shuttle' ? Math.max(2, Math.ceil(rawMinutes * 0.45)) : Math.max(1, rawMinutes);

  const wellLitCount = sectors.filter((s) => s.lightingLevel === 'Well-Lit').length;
  const moderateCount = sectors.filter((s) => s.lightingLevel === 'Moderate').length;
  const lightingCoveragePercent = Math.round(
    ((wellLitCount + moderateCount * 0.65) / Math.max(1, sectors.length)) * 100
  );

  let activeAlertsOnPath = 0;
  let scoreSum = 0;
  for (const s of sectors) {
    const check = evaluateSectorSafetyCheckin(s.id, incidents, isLateNight);
    activeAlertsOnPath += check.activeIncidentCount;
    scoreSum += check.safetyScore;
  }
  const safetyScore = Math.max(1, Math.min(10, Math.round(scoreSum / Math.max(1, sectors.length))));

  const turnByTurn = sectors.map((sec, idx) => {
    if (idx === 0) return `Start at ${sec.shortCode} · ${sec.name} (${sec.nearestGuardPost}).`;
    if (idx === sectors.length - 1) {
      return `Arrive at ${sec.shortCode} · ${sec.name} (${sec.lightingLevel}).`;
    }
    return `Pass through ${sec.shortCode} · ${sec.name} — ${sec.lightingLevel} corridor (${sec.nearestGuardPost}).`;
  });

  return {
    label,
    sectors,
    totalMinutes,
    safetyScore,
    lightingCoveragePercent,
    guardPostsPassed: sectors.length,
    activeAlertsOnPath,
    turnByTurn,
  };
}

export function computeSafeRoute(
  originId: string,
  destinationId: string,
  incidents: IncidentReport[],
  options: { isLateNight: boolean; mode: 'walking' | 'shuttle' }
): SafeRoutePlan {
  const origin = getSectorById(originId);
  const destination = getSectorById(destinationId);

  const safestPath = findOptimalPath(origin.id, destination.id, (sector, walkMinutes) => {
    const check = evaluateSectorSafetyCheckin(sector.id, incidents, options.isLateNight);
    const lightingPenalty =
      sector.lightingLevel === 'Well-Lit' ? 0 : sector.lightingLevel === 'Moderate' ? 4 : 12;
    const riskPenalty = (10 - check.safetyScore) * 3.5 + check.activeIncidentCount * 10;
    return walkMinutes + lightingPenalty + riskPenalty;
  });

  const fastestPath = findOptimalPath(origin.id, destination.id, (_sector, walkMinutes) => walkMinutes);

  return {
    origin,
    destination,
    mode: options.mode,
    isLateNight: options.isLateNight,
    safest: summarizeRoute(
      'Safest Illuminated Route',
      safestPath.sectorIds,
      safestPath.totalMinutes,
      options.mode,
      incidents,
      options.isLateNight
    ),
    fastest: summarizeRoute(
      'Direct / Fastest Route',
      fastestPath.sectorIds,
      fastestPath.totalMinutes,
      options.mode,
      incidents,
      options.isLateNight
    ),
  };
}

export function escalateIncidentTier(incident: IncidentReport): {
  priority: IncidentPriority;
  escalationTier: string;
} {
  return {
    priority: 'Critical',
    escalationTier: 'Tier 3 · Duty Supervisor & External EMS Simulation',
  };
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatIncidentsCsv(incidents: IncidentReport[]): string {
  const headers = [
    'Reference ID',
    'Category',
    'Priority',
    'Score',
    'Status',
    'Campus Sector',
    'Simulated Coordinates',
    'SOS Beacon',
    'Response Category',
    'Assigned Unit',
    'Created At',
  ];
  const rows = incidents.map((inc) =>
    [
      inc.id,
      inc.category,
      inc.priority,
      inc.priorityScore,
      inc.status,
      inc.sectorName,
      inc.coordinatesShared ? `${inc.simulatedLat.toFixed(4)}, ${inc.simulatedLng.toFixed(4)}` : 'Withheld',
      inc.isSos ? 'Yes' : 'No',
      inc.responseCategory,
      inc.assignedUnit || 'Unassigned',
      inc.createdAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

const PRIORITY_DANGER_WEIGHT: Record<IncidentPriority, number> = {
  Critical: 34,
  High: 22,
  Medium: 12,
  Low: 6,
};

function filterHeatmapIncidents(
  incidents: IncidentReport[],
  options?: { statusScope?: 'all' | 'active'; priorityFilter?: 'All' | IncidentPriority }
): IncidentReport[] {
  const statusScope = options?.statusScope ?? 'all';
  const priorityFilter = options?.priorityFilter ?? 'All';
  return incidents.filter((inc) => {
    if (statusScope === 'active' && inc.status === 'Resolved') return false;
    if (priorityFilter !== 'All' && inc.priority !== priorityFilter) return false;
    return true;
  });
}

export function computeSectorDangerClusters(
  incidents: IncidentReport[],
  options?: { statusScope?: 'all' | 'active'; priorityFilter?: 'All' | IncidentPriority }
): SectorDangerCluster[] {
  const filtered = filterHeatmapIncidents(incidents, options);

  const clusters: SectorDangerCluster[] = CAMPUS_SECTORS.map((sector) => {
    const sectorIncidents = filtered.filter((inc) => inc.sectorId === sector.id);
    const activeCount = sectorIncidents.filter((inc) => inc.status !== 'Resolved').length;
    const criticalHighCount = sectorIncidents.filter(
      (inc) => inc.priority === 'Critical' || inc.priority === 'High'
    ).length;
    const sosCount = sectorIncidents.filter((inc) => inc.isSos).length;

    let rawDanger = 0;
    const categoryCounts: Partial<Record<EmergencyCategory, number>> = {};

    for (const inc of sectorIncidents) {
      const baseWeight = PRIORITY_DANGER_WEIGHT[inc.priority];
      const activeMultiplier = inc.status === 'Resolved' ? 0.72 : 1.15;
      const sosBonus = inc.isSos ? 8 : 0;
      rawDanger += baseWeight * activeMultiplier + sosBonus;
      categoryCounts[inc.category] = (categoryCounts[inc.category] || 0) + 1;
    }

    // Subtle baseline exposure for low-lighting zones when incidents exist
    if (sectorIncidents.length > 0 && sector.lightingLevel === 'Low Lighting') {
      rawDanger += 8;
    }

    const weightedDangerScore = Math.max(0, Math.min(100, Math.round(rawDanger)));

    let riskLevel: SectorDangerCluster['riskLevel'] = 'Low';
    if (weightedDangerScore >= 72) {
      riskLevel = 'Critical Cluster';
    } else if (weightedDangerScore >= 42) {
      riskLevel = 'High Cluster';
    } else if (weightedDangerScore >= 16) {
      riskLevel = 'Moderate';
    }

    let dominantCategory: EmergencyCategory | 'None' = 'None';
    let topCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if ((count || 0) > topCount) {
        topCount = count || 0;
        dominantCategory = cat as EmergencyCategory;
      }
    }

    return {
      sector,
      incidentCount: sectorIncidents.length,
      activeCount,
      criticalHighCount,
      sosCount,
      weightedDangerScore,
      riskLevel,
      dominantCategory,
    };
  });

  return clusters.sort((a, b) => {
    if (b.weightedDangerScore !== a.weightedDangerScore) {
      return b.weightedDangerScore - a.weightedDangerScore;
    }
    return b.incidentCount - a.incidentCount;
  });
}

function deterministicHashFraction(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function computeIncidentHeatPoints(
  incidents: IncidentReport[],
  options?: { statusScope?: 'all' | 'active'; priorityFilter?: 'All' | IncidentPriority }
): HeatSamplePoint[] {
  const filtered = filterHeatmapIncidents(incidents, options);

  const weightByPriority: Record<IncidentPriority, number> = {
    Critical: 1.0,
    High: 0.78,
    Medium: 0.52,
    Low: 0.3,
  };

  return filtered.map((inc, index) => {
    const sector = getSectorById(inc.sectorId);
    const baseLat = inc.coordinatesShared ? inc.simulatedLat : sector.simulatedLat;
    const baseLng = inc.coordinatesShared ? inc.simulatedLng : sector.simulatedLng;

    // Deterministic slight micro-spread for incidents sharing exact sector center so D3 contourDensity shows crisp multi-incident clusters
    const angle = deterministicHashFraction(`${inc.id}_${index}_a`) * Math.PI * 2;
    const radius = (0.00012 + deterministicHashFraction(`${inc.id}_${index}_r`) * 0.00028);
    const lat = Number((baseLat + Math.sin(angle) * radius).toFixed(6));
    const lng = Number((baseLng + Math.cos(angle) * radius * 1.15).toFixed(6));

    const activeBoost = inc.status === 'Resolved' ? 0.78 : 1.0;
    const weight = Number((weightByPriority[inc.priority] * activeBoost).toFixed(3));

    return {
      id: inc.id,
      sectorId: sector.id,
      lat,
      lng,
      weight,
      priority: inc.priority,
      isActive: inc.status !== 'Resolved',
    };
  });
}


