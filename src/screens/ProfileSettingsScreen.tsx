import React, { useState } from 'react';
import {
  User,
  Camera,
  Shield,
  Sliders,
  LogOut,
  RotateCcw,
  Check,
  Compass,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../hooks/useAppStore';

export const ProfileSettingsScreen: React.FC = () => {
  const {
    user,
    signOutUser,
    preferences,
    updatePreferences,
    resetQueueRegion,
    setFlowState,
    systemReadiness,
  } = useAppStore();

  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const showSavedFeedback = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#252B26] font-display">
            Operator Profile & Settings
          </h1>
          <p className="text-sm text-[#777D75]">
            Configure camera defaults, local AI processing parameters, privacy controls, and
            account session settings.
          </p>
        </div>

        {savedBanner && (
          <div className="px-3.5 py-2 rounded-xl bg-[#FFFDF6] border border-[#477A55] text-xs font-medium text-[#477A55] flex items-center gap-1.5 self-start">
            <Check className="w-3.5 h-3.5" />
            <span>{savedBanner}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Account & Operator Profile Column */}
        <div className="lg:col-span-5 space-y-4">
          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#244C3A] text-[#F7F5EC] flex items-center justify-center shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[#252B26] truncate">
                  {user?.displayName || 'Queue Operator'}
                </h2>
                <p className="text-xs text-[#777D75] truncate">
                  {user?.email || 'evaluator@queuesense.local'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">Session Mode:</span>
                <span className="font-semibold text-[#244C3A]">
                  {user?.mode === 'guest_demo'
                    ? 'Guest Demo Mode'
                    : user?.mode === 'authenticated'
                    ? 'Operator Session'
                    : 'Clean Evaluation Mode'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">Firebase Auth & Cloud Sync:</span>
                <span className="text-[#252B26]">Milestone 2 Target</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777D75]">Design Theme Standard:</span>
                <span className="text-[#252B26] font-medium">Warm Ivory + Forest Green</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFlowState('onboarding')}
                icon={<Compass className="w-3.5 h-3.5" />}
              >
                Replay Onboarding
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={signOutUser}
                icon={<LogOut className="w-3.5 h-3.5" />}
              >
                Switch Account / Sign Out
              </Button>
            </div>
          </Card>

          {/* Browser Hardware & Environment Diagnostics */}
          <Card padding="md" className="space-y-3">
            <h3 className="text-sm font-semibold text-[#252B26]">
              Device & Browser Capability Check
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-[#E1E6DA]">
                <span className="text-[#777D75]">Secure Context (HTTPS/localhost)</span>
                <span className="font-mono-tabular font-semibold text-[#477A55]">
                  {systemReadiness.secureContext ? 'Verified' : 'Required'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E1E6DA]">
                <span className="text-[#777D75]">MediaDevices Camera API</span>
                <span className="font-mono-tabular font-semibold text-[#252B26]">
                  {systemReadiness.cameraApiSupported ? 'Supported' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-[#E1E6DA]">
                <span className="text-[#777D75]">Web Workers Background Thread</span>
                <span className="font-mono-tabular font-semibold text-[#477A55]">
                  {systemReadiness.webWorkerSupported ? 'Supported' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#777D75]">WebGPU Hardware Acceleration</span>
                <span className="font-mono-tabular font-semibold text-[#252B26]">
                  {systemReadiness.webGpuSupported ? 'Available' : 'WASM Fallback Active'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Camera, AI Inference & Privacy Preferences Column */}
        <div className="lg:col-span-7 space-y-4">
          <Card padding="md" className="space-y-5">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#244C3A]" />
              <h2 className="text-base font-semibold text-[#252B26]">
                Camera & Queue Region Preferences
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#252B26] mb-1.5">
                  Default Smartphone Camera
                </label>
                <select
                  value={preferences.preferredCameraFacing}
                  onChange={(e) => {
                    updatePreferences({
                      preferredCameraFacing: e.target.value as 'environment' | 'user',
                    });
                    showSavedFeedback('Camera preference updated.');
                  }}
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] focus:outline-none focus:border-[#244C3A]"
                >
                  <option value="environment">Rear Camera (Environment)</option>
                  <option value="user">Front Camera (User)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#252B26] mb-1.5">
                  Target AI Sampling Rate (Milestone 4)
                </label>
                <select
                  value={preferences.targetInferenceFps}
                  onChange={(e) => {
                    updatePreferences({
                      targetInferenceFps: Number(e.target.value) as 15 | 24 | 30,
                    });
                    showSavedFeedback('Target sampling rate saved.');
                  }}
                  className="w-full min-h-[44px] px-3 py-2 text-xs bg-[#F7F5EC] border border-[#E1E6DA] rounded-xl text-[#252B26] focus:outline-none focus:border-[#244C3A]"
                >
                  <option value={15}>15 FPS (Balanced Mobile Battery)</option>
                  <option value={24}>24 FPS (Standard Tracking)</option>
                  <option value={30}>30 FPS (High Capability WebGPU)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E1E6DA]">
              <div>
                <p className="text-xs font-semibold text-[#252B26]">
                  Reset Default Queue Polygon (ROI)
                </p>
                <p className="text-[11px] text-[#777D75]">
                  Restore the 4-point service lane geometry to standard coordinates.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetQueueRegion();
                  showSavedFeedback('Queue Region coordinates reset to default.');
                }}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset ROI
              </Button>
            </div>
          </Card>

          <Card padding="md" className="space-y-5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#244C3A]" />
              <h2 className="text-base font-semibold text-[#252B26]">
                AI Detection & Demonstration Settings
              </h2>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <label htmlFor="conf-slider" className="font-medium text-[#252B26]">
                  YOLO Person Confidence Threshold
                </label>
                <span className="font-mono-tabular font-semibold text-[#244C3A]">
                  {Math.round(preferences.confidenceThreshold * 100)}%
                </span>
              </div>
              <input
                id="conf-slider"
                type="range"
                min={0.25}
                max={0.85}
                step={0.05}
                value={preferences.confidenceThreshold}
                onChange={(e) =>
                  updatePreferences({ confidenceThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-[#244C3A] cursor-pointer"
              />
              <p className="text-[11px] text-[#777D75] mt-1">
                Filters out low-confidence bounding boxes prior to ByteTrack association.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#E1E6DA]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#252B26]">
                    Show Labelled Sample Demonstration Data
                  </p>
                  <p className="text-[11px] text-[#777D75]">
                    Populate Analytics and History with 3 clearly marked sample sessions.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.showSampleDemoData}
                  onClick={() => {
                    updatePreferences({
                      showSampleDemoData: !preferences.showSampleDemoData,
                    });
                    showSavedFeedback('Demonstration data visibility updated.');
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    preferences.showSampleDemoData
                      ? 'bg-[#244C3A] text-[#F7F5EC]'
                      : 'bg-[#E1E6DA] text-[#244C3A]'
                  }`}
                >
                  {preferences.showSampleDemoData ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#244C3A]" />
              <h2 className="text-base font-semibold text-[#252B26]">
                Privacy & On-Device Processing Guarantees
              </h2>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs text-[#777D75] space-y-2 leading-relaxed">
              <p className="text-[#252B26] font-medium">
                100% Local Video Processing Policy
              </p>
              <p>
                QueueSense processes camera frames locally in browser memory. Continuous camera
                footage is never uploaded to cloud storage, and tracking IDs are ephemeral integers
                cleared immediately when a session ends.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
