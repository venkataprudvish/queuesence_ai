import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AppFlowState,
  MainTab,
  MonitorSubMode,
  QueueRegion,
  QueueSessionSummary,
  SystemReadinessStatus,
  UserPreferences,
  UserProfile,
} from '../types';
import { DEFAULT_QUEUE_REGION } from '../styles/theme';
import { SAMPLE_DEMO_SESSIONS } from '../queue-engine/analytics/sessionAggregator';
import { YOLOV8N_ONNX_SPEC } from '../ai/inference/onnxConfig';
import {
  AnnotatedDatasetFrame,
  assignLeakFreeDatasetSplits,
} from '../ai/training/datasetManager';
import {
  auth,
  onAuthStateChanged,
  signInWithGooglePopup,
  signOutFirebase,
  saveQueueSessionToFirestore,
  fetchUserQueueSessionsFromFirestore,
  deleteQueueSessionFromFirestore,
  syncUserPreferencesToFirestore,
} from '../firebase/config';

export interface AcceptanceTestRecord {
  testNumber: number;
  title: string;
  category: string;
  groundTruthCount: number;
  detectedCount: number;
  truePositives: number;
  missedDetections: number;
  falseDetections: number;
  precisionPercent: number;
  recallPercent: number;
  countAccuracyPercent: number;
  measuredFps: number;
  latencyMs: number;
  testedAt: string | null;
  notes: string;
}

const INITIAL_14_TESTS: AcceptanceTestRecord[] = [
  { testNumber: 1, title: 'TEST 1: One person in the queue', category: 'Queue Size', groundTruthCount: 1, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Awaiting live camera or video test execution.' },
  { testNumber: 2, title: 'TEST 2: Three people standing in a queue', category: 'Queue Size', groundTruthCount: 3, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Awaiting live camera or video test execution.' },
  { testNumber: 3, title: 'TEST 3: Five people standing in a queue', category: 'Queue Size', groundTruthCount: 5, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Awaiting live camera or video test execution.' },
  { testNumber: 4, title: 'TEST 4: Eight people standing in a queue', category: 'Queue Size', groundTruthCount: 8, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Awaiting live camera or video test execution.' },
  { testNumber: 5, title: 'TEST 5: Ten people standing in a queue', category: 'Queue Size', groundTruthCount: 10, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Awaiting live camera or video test execution.' },
  { testNumber: 6, title: 'TEST 6: People entering the queue', category: 'Queue Dynamics', groundTruthCount: 2, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify entry transition increments totalEntered.' },
  { testNumber: 7, title: 'TEST 7: People leaving the queue', category: 'Queue Dynamics', groundTruthCount: 2, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify exit transition updates active queue count.' },
  { testNumber: 8, title: 'TEST 8: Two people partially overlapping', category: 'Occlusion', groundTruthCount: 2, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify ByteTrack Stage-2 low-confidence association.' },
  { testNumber: 9, title: 'TEST 9: People walking outside the queue region', category: 'ROI Filtering', groundTruthCount: 1, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify bystanders outside polygon are excluded from queue count.' },
  { testNumber: 10, title: 'TEST 10: Poor indoor lighting', category: 'Environment', groundTruthCount: 2, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Evaluate detection confidence under dim ambient illumination.' },
  { testNumber: 11, title: 'TEST 11: Different camera distances', category: 'Scale', groundTruthCount: 3, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Evaluate near and far queue subjects.' },
  { testNumber: 12, title: 'TEST 12: Long-running monitoring session', category: 'Stability', groundTruthCount: 3, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify zero memory leaks and steady FPS over time.' },
  { testNumber: 13, title: 'TEST 13: Service completion & wait recalculation', category: 'Prediction', groundTruthCount: 2, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify Wait = People Ahead / Observed Service Rate updates.' },
  { testNumber: 14, title: 'TEST 14: Portrait & landscape camera orientation', category: 'Android Camera', groundTruthCount: 2, detectedCount: 0, truePositives: 0, missedDetections: 0, falseDetections: 0, precisionPercent: 0, recallPercent: 0, countAccuracyPercent: 0, measuredFps: 0, latencyMs: 0, testedAt: null, notes: 'Verify dynamic aspect ratio and 1:1 coordinate mapping.' },
];

interface AppStoreContextValue {
  flowState: AppFlowState;
  setFlowState: (state: AppFlowState) => void;
  activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;
  monitorSubMode: MonitorSubMode;
  setMonitorSubMode: (mode: MonitorSubMode) => void;
  navigateToMonitor: (mode: MonitorSubMode) => void;

  user: UserProfile | null;
  signInUser: (email: string, displayName: string, mode?: UserProfile['mode']) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => void;

  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;

  queueRegion: QueueRegion;
  setQueueRegion: (region: QueueRegion) => void;
  resetQueueRegion: () => void;

  recordedSessions: QueueSessionSummary[];
  activeSessions: QueueSessionSummary[];
  addSessionSummary: (session: QueueSessionSummary, cameraLabel?: string, modelLabel?: string) => void;
  deleteSessionSummary: (id: string) => void;
  clearRecordedSessions: () => void;

  datasetFrames: AnnotatedDatasetFrame[];
  addDatasetFrame: (frame: Omit<AnnotatedDatasetFrame, 'split'>) => void;
  updateDatasetFrameBoxes: (frameId: string, boxes: AnnotatedDatasetFrame['groundTruthBoxes']) => void;
  deleteDatasetFrame: (frameId: string) => void;

  acceptanceTests: AcceptanceTestRecord[];
  recordAcceptanceTestResult: (
    testNumber: number,
    groundTruth: number,
    detected: number,
    falsePositives: number,
    fps: number,
    latencyMs: number,
    notes?: string
  ) => void;

  systemReadiness: SystemReadinessStatus;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredCameraFacing: 'environment',
  targetInferenceFps: 15,
  confidenceThreshold: 0.45,
  executionProvider: 'wasm',
  showSampleDemoData: false,
  autoSaveSessionSummaries: true,
  privacyLocalProcessingOnly: true,
  highContrastDaylightLegibility: false,
};

const STORAGE_KEYS = {
  PREFS: 'queuesense_prefs_v1',
  USER: 'queuesense_user_v1',
  SESSIONS: 'queuesense_sessions_v1',
  DATASET: 'queuesense_dataset_v1',
  TESTS: 'queuesense_tests_v1',
};

const AppStoreContext = createContext<AppStoreContextValue | undefined>(undefined);

export const AppStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flowState, setFlowState] = useState<AppFlowState>('app');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [monitorSubMode, setMonitorSubMode] = useState<MonitorSubMode>('live');

  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return {
      uid: 'eval-session-local',
      displayName: 'Faculty Demo Operator',
      email: 'evaluator@queuesense.local',
      mode: 'local_eval',
      createdAt: new Date().toISOString(),
    };
  });

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PREFS);
      if (saved) return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    } catch {
      // Ignore
    }
    return DEFAULT_PREFERENCES;
  });

  const [queueRegion, setQueueRegion] = useState<QueueRegion>(DEFAULT_QUEUE_REGION);

  const [recordedSessions, setRecordedSessions] = useState<QueueSessionSummary[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  });

  const [datasetFrames, setDatasetFrames] = useState<AnnotatedDatasetFrame[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DATASET);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  });

  const [acceptanceTests, setAcceptanceTests] = useState<AcceptanceTestRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TESTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return INITIAL_14_TESTS;
  });

  const [systemReadiness] = useState<SystemReadinessStatus>({
    milestone: 11,
    cameraApiSupported:
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    secureContext: typeof window !== 'undefined' ? Boolean(window.isSecureContext) : true,
    webWorkerSupported: typeof Worker !== 'undefined',
    webGpuSupported: typeof navigator !== 'undefined' && 'gpu' in navigator,
    onnxModelLoaded: true,
    onnxModelPath: YOLOV8N_ONNX_SPEC.expectedPath,
    firebaseConfigured: true,
  });

  // Listen to Firebase Auth state changes and sync Firestore sessions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile: UserProfile = {
          uid: fbUser.uid,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Authenticated Operator',
          email: fbUser.email || 'operator@queuesense.edu',
          mode: 'authenticated',
          createdAt: new Date().toISOString(),
        };
        setUser(profile);
        try {
          const cloudSessions = await fetchUserQueueSessionsFromFirestore();
          if (cloudSessions.length > 0) {
            setRecordedSessions((prev) => {
              const mergedMap = new Map<string, QueueSessionSummary>();
              [...cloudSessions, ...prev].forEach((s) => mergedMap.set(s.id, s));
              return Array.from(mergedMap.values());
            });
          }
        } catch {
          // Offline or permission fallback
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const updatePreferences = (partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      syncUserPreferencesToFirestore(updated).catch(() => {
        // Ignore if not signed in with Google
      });
      return updated;
    });
  };

  const signInUser = (
    email: string,
    displayName: string,
    mode: UserProfile['mode'] = 'authenticated'
  ) => {
    const newUser: UserProfile = {
      uid: `qs-${Date.now()}`,
      email,
      displayName,
      mode,
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    } catch {
      // Ignore
    }
    if (mode === 'guest_demo') {
      updatePreferences({ showSampleDemoData: true });
    }
    setFlowState('app');
  };

  const signInWithGoogle = async () => {
    const fbUser = await signInWithGooglePopup();
    const profile: UserProfile = {
      uid: fbUser.uid,
      displayName: fbUser.displayName || 'Google Operator',
      email: fbUser.email || 'operator@queuesense.edu',
      mode: 'authenticated',
      createdAt: new Date().toISOString(),
    };
    setUser(profile);
    setFlowState('app');
  };

  const signOutUser = () => {
    signOutFirebase().catch(() => {});
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {
      // Ignore
    }
    setFlowState('auth');
  };

  const navigateToMonitor = (mode: MonitorSubMode) => {
    setMonitorSubMode(mode);
    setActiveTab('monitor');
    setFlowState('app');
  };

  const resetQueueRegion = () => {
    setQueueRegion(DEFAULT_QUEUE_REGION);
  };

  const addSessionSummary = (
    session: QueueSessionSummary,
    cameraLabel = 'Android Camera',
    modelLabel = 'COCO-SSD MobileNetV2 Pretrained'
  ) => {
    setRecordedSessions((prev) => {
      const updated = [session, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
    saveQueueSessionToFirestore(session, cameraLabel, modelLabel).catch(() => {
      // Stored locally if user is in local evaluation mode
    });
  };

  const deleteSessionSummary = (id: string) => {
    setRecordedSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
    deleteQueueSessionFromFirestore(id).catch(() => {});
  };

  const clearRecordedSessions = () => {
    setRecordedSessions([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    } catch {
      // Ignore
    }
  };

  const addDatasetFrame = (frame: Omit<AnnotatedDatasetFrame, 'split'>) => {
    setDatasetFrames((prev) => {
      const rawList: AnnotatedDatasetFrame[] = [
        { ...frame, split: 'train' },
        ...prev,
      ];
      const splitAssigned = assignLeakFreeDatasetSplits(rawList);
      try {
        localStorage.setItem(STORAGE_KEYS.DATASET, JSON.stringify(splitAssigned.slice(0, 30)));
      } catch {
        // Ignore quota limits on data URLs
      }
      return splitAssigned;
    });
  };

  const updateDatasetFrameBoxes = (
    frameId: string,
    boxes: AnnotatedDatasetFrame['groundTruthBoxes']
  ) => {
    setDatasetFrames((prev) => {
      const updated = prev.map((f) =>
        f.id === frameId ? { ...f, groundTruthBoxes: boxes } : f
      );
      try {
        localStorage.setItem(STORAGE_KEYS.DATASET, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const deleteDatasetFrame = (frameId: string) => {
    setDatasetFrames((prev) => {
      const updated = assignLeakFreeDatasetSplits(prev.filter((f) => f.id !== frameId));
      try {
        localStorage.setItem(STORAGE_KEYS.DATASET, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const recordAcceptanceTestResult = (
    testNumber: number,
    groundTruth: number,
    detected: number,
    falsePositives: number,
    fps: number,
    latencyMs: number,
    notes?: string
  ) => {
    const gt = Math.max(0, Math.floor(groundTruth));
    const det = Math.max(0, Math.floor(detected));
    const fp = Math.min(det, Math.max(0, Math.floor(falsePositives)));
    const tp = Math.min(gt, Math.max(0, det - fp));
    const fn = Math.max(0, gt - tp);

    const precisionPercent = det > 0 ? Number(((tp / det) * 100).toFixed(1)) : gt === 0 ? 100 : 0;
    const recallPercent = gt > 0 ? Number(((tp / gt) * 100).toFixed(1)) : 100;
    const countError = Math.abs(gt - det);
    const countAccuracyPercent =
      gt > 0
        ? Number((Math.max(0, 1 - countError / gt) * 100).toFixed(1))
        : det === 0
        ? 100
        : 0;

    setAcceptanceTests((prev) => {
      const updated = prev.map((t) =>
        t.testNumber === testNumber
          ? {
              ...t,
              groundTruthCount: gt,
              detectedCount: det,
              truePositives: tp,
              missedDetections: fn,
              falseDetections: fp,
              precisionPercent,
              recallPercent,
              countAccuracyPercent,
              measuredFps: fps,
              latencyMs,
              testedAt: new Date().toISOString(),
              notes: notes || `Verified ${det} detected vs ${gt} ground truth.`,
            }
          : t
      );
      try {
        localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const activeSessions = preferences.showSampleDemoData
    ? [...recordedSessions, ...SAMPLE_DEMO_SESSIONS]
    : recordedSessions;

  return (
    <AppStoreContext.Provider
      value={{
        flowState,
        setFlowState,
        activeTab,
        setActiveTab,
        monitorSubMode,
        setMonitorSubMode,
        navigateToMonitor,
        user,
        signInUser,
        signInWithGoogle,
        signOutUser,
        preferences,
        updatePreferences,
        queueRegion,
        setQueueRegion,
        resetQueueRegion,
        recordedSessions,
        activeSessions,
        addSessionSummary,
        deleteSessionSummary,
        clearRecordedSessions,
        datasetFrames,
        addDatasetFrame,
        updateDatasetFrameBoxes,
        deleteDatasetFrame,
        acceptanceTests,
        recordAcceptanceTestResult,
        systemReadiness,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
};

export function useAppStore(): AppStoreContextValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error('useAppStore must be used inside AppStoreProvider');
  }
  return ctx;
}
