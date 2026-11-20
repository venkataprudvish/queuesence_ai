/**
 * QueueSense — Firestore Security Rules TDD Specification (Phase 0)
 * Verifies that all 12 Dirty Dozen payloads are rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  { id: 1, name: 'Identity Spoofing on Session Create', collection: 'queue_sessions', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified Email Write', collection: 'users', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 3, name: 'Shadow Field Injection on Update', collection: 'queue_sessions', operation: 'update', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 4, name: 'Cross-Tenant PII Read', collection: 'users', operation: 'get', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 5, name: 'Blanket List Scraping', collection: 'queue_sessions', operation: 'list', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 6, name: 'ID Poisoning Attack', collection: 'queue_sessions', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 7, name: 'Orphaned Queue Event', collection: 'queue_events', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 8, name: 'Client Timestamp Forgery', collection: 'queue_sessions', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 9, name: 'Immutable Field Mutation', collection: 'queue_sessions', operation: 'update', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 10, name: 'String Overflow (Denial of Wallet)', collection: 'queue_sessions', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 11, name: 'Negative Queue Telemetry', collection: 'queue_sessions', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 12, name: 'Invalid Enum Value on QueueEvent', collection: 'queue_events', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
];
