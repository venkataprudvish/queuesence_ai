import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { QueueSessionSummary, UserPreferences } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  QUEUE_SESSIONS: 'queue_sessions',
  QUEUE_EVENTS: 'queue_events',
  PREDICTION_HISTORY: 'prediction_history',
  USER_PREFERENCES: 'user_preferences',
} as const;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Mandatory startup connection check to Firestore
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on 'test/connection' is expected when default-deny rules are active,
    // which proves the client is online and reaching the Firestore server!
    return true;
  }
}

testConnection();

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

function clampString(val: string, minLen: number, maxLen: number, fallback: string): string {
  const trimmed = (val || '').trim();
  if (trimmed.length < minLen) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}

export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  if (user && user.emailVerified) {
    const userPath = `${FIRESTORE_COLLECTIONS.USERS}/${user.uid}`;
    try {
      await setDoc(
        doc(db, FIRESTORE_COLLECTIONS.USERS, sanitizeId(user.uid)),
        {
          userId: sanitizeId(user.uid),
          displayName: clampString(user.displayName || 'Queue Operator', 1, 100, 'Queue Operator'),
          email: clampString(user.email || 'operator@queuesense.edu', 3, 160, 'operator@queuesense.edu'),
          createdAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch {
      // Profile may already exist (createdAt is immutable on update)
    }
  }
  return user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged };

export async function saveQueueSessionToFirestore(
  session: QueueSessionSummary,
  cameraConfigLabel: string,
  modelVersionLabel: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const sessionId = sanitizeId(session.id);
  const path = `${FIRESTORE_COLLECTIONS.QUEUE_SESSIONS}/${sessionId}`;

  try {
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.QUEUE_SESSIONS, sessionId), {
      sessionId,
      userId: sanitizeId(currentUser.uid),
      title: clampString(session.title, 1, 140, 'Queue Monitoring Session'),
      locationLabel: clampString(session.locationLabel, 1, 100, 'Primary Queue Zone'),
      startTime: clampString(session.startedAt, 1, 64, new Date().toISOString()),
      endTime: clampString(session.endedAt, 1, 64, new Date().toISOString()),
      durationSeconds: Math.max(0, Number(session.durationSeconds) || 0),
      maximumQueueLength: Math.max(0, Number(session.peakQueueCount) || 0),
      averageQueueLength: Math.max(0, Number(session.averageQueueCount) || 0),
      totalEntered: Math.max(0, Number(session.totalEntered) || 0),
      totalServed: Math.max(0, Number(session.totalServed) || 0),
      averageWaitingTime: Math.max(0, Number(session.averageWaitSeconds) || 0),
      observedServiceRate: Math.max(0, Number(session.averageServiceRatePerMin) || 0),
      cameraConfiguration: clampString(cameraConfigLabel, 1, 120, 'Android Rear Camera'),
      modelVersion: clampString(modelVersionLabel, 1, 120, 'Pretrained Person Detector'),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserQueueSessionsFromFirestore(): Promise<QueueSessionSummary[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return [];

  const path = FIRESTORE_COLLECTIONS.QUEUE_SESSIONS;
  try {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.QUEUE_SESSIONS),
      where('userId', '==', currentUser.uid)
    );
    const snap = await getDocs(q);
    const results: QueueSessionSummary[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      results.push({
        id: d.sessionId || docSnap.id,
        title: d.title || 'Recorded Session',
        locationLabel: d.locationLabel || 'Service Counter',
        sourceType: 'live_camera',
        isSampleData: false,
        startedAt: d.startTime || new Date().toISOString(),
        endedAt: d.endTime || new Date().toISOString(),
        durationSeconds: Number(d.durationSeconds) || 0,
        peakQueueCount: Number(d.maximumQueueLength) || 0,
        averageQueueCount: Number(d.averageQueueLength) || 0,
        totalEntered: Number(d.totalEntered) || 0,
        totalServed: Number(d.totalServed) || 0,
        averageWaitSeconds: Number(d.averageWaitingTime) || 0,
        averageServiceRatePerMin: Number(d.observedServiceRate) || 0,
        reliability: 'high',
        timeline: [
          {
            timestampOffsetSec: 0,
            timeLabel: new Date(d.startTime || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            queueCount: Number(d.averageQueueLength) || 0,
            estimatedWaitMinutes: Number(((Number(d.averageWaitingTime) || 0) / 60).toFixed(1)),
            serviceRatePerMin: Number(d.observedServiceRate) || 0,
          },
        ],
      });
    });
    return results.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteQueueSessionFromFirestore(sessionId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = sanitizeId(sessionId);
  const path = `${FIRESTORE_COLLECTIONS.QUEUE_SESSIONS}/${cleanId}`;
  try {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.QUEUE_SESSIONS, cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncUserPreferencesToFirestore(prefs: UserPreferences): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const uid = sanitizeId(currentUser.uid);
  const path = `${FIRESTORE_COLLECTIONS.USER_PREFERENCES}/${uid}`;
  try {
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.USER_PREFERENCES, uid), {
      userId: uid,
      preferredCameraFacing:
        prefs.preferredCameraFacing === 'user' ? 'user' : 'environment',
      confidenceThreshold: Math.min(0.95, Math.max(0.1, Number(prefs.confidenceThreshold) || 0.45)),
      targetInferenceFps: Math.min(60, Math.max(1, Number(prefs.targetInferenceFps) || 15)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
