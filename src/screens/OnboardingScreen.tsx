import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScanLine, ShieldCheck, Camera, Clock, ArrowRight, Check } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../hooks/useAppStore';

interface OnboardingStep {
  stepNumber: string;
  title: string;
  subtitle: string;
  points: string[];
  Icon: React.ComponentType<{ className?: string }>;
}

const STEPS: OnboardingStep[] = [
  {
    stepNumber: '01. Queue Intelligence',
    title: 'Real-Time Queue Measurement & Wait Prediction',
    subtitle:
      'QueueSense measures active line occupancy and observed service completions to estimate waiting time transparently.',
    points: [
      'Defines an exact polygonal queue region on the camera feed',
      'Counts only people standing inside the configured service lane',
      'Separates direct observations from smoothed rate estimates',
    ],
    Icon: ScanLine,
  },
  {
    stepNumber: '02. Local Computer Vision',
    title: 'On-Device Browser AI Processing',
    subtitle:
      'Video frames are processed locally inside your browser using Web Workers and ONNX Runtime Web.',
    points: [
      'Zero continuous video uploads to cloud servers',
      'Temporary anonymous tracking IDs during active sessions only',
      'No facial recognition or biometric identification',
    ],
    Icon: ShieldCheck,
  },
  {
    stepNumber: '03. Camera & Video Input',
    title: 'Flexible Live Camera or Recorded Video Analysis',
    subtitle:
      'Use your smartphone rear camera for live queue monitoring or load recorded queue videos for evaluation.',
    points: [
      'Requires browser HTTPS or localhost camera permission',
      'Supports front and rear mobile camera switching',
      'Includes interactive Region-of-Interest (ROI) calibration',
    ],
    Icon: Camera,
  },
  {
    stepNumber: '04. Predictive Math Engine',
    title: 'Service Rate & Waiting-Time Formula',
    subtitle:
      'Waiting times are computed from verified queue departures using exponential moving average smoothing.',
    points: [
      'Formula: People Ahead ÷ Observed Service Rate',
      'Automatic safeguards for zero rate or insufficient samples',
      'Explicit confidence and reliability indicators on every reading',
    ],
    Icon: Clock,
  },
];

export const OnboardingScreen: React.FC = () => {
  const { setFlowState } = useAppStore();
  const [stepIndex, setStepIndex] = useState(0);
  const current = STEPS[stepIndex];
  const Icon = current.Icon;

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setFlowState('auth');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5EC] text-[#252B26] flex flex-col justify-between px-4 sm:px-6 py-8">
      <div className="max-w-lg w-full mx-auto flex items-center justify-between">
        <span className="text-base font-bold text-[#244C3A] font-display">QueueSense</span>
        <button
          type="button"
          onClick={() => setFlowState('auth')}
          className="text-xs font-medium text-[#777D75] hover:text-[#252B26] min-h-[44px] px-2 cursor-pointer"
        >
          Skip Intro
        </button>
      </div>

      <div className="max-w-lg w-full mx-auto my-6">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, transform: 'translateY(8px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.2 }}
        >
          <Card padding="lg">
            <div className="w-12 h-12 rounded-2xl bg-[#F7F5EC] border border-[#E1E6DA] text-[#244C3A] flex items-center justify-center mb-5">
              <Icon className="w-6 h-6" />
            </div>

            <p className="text-xs font-medium text-[#777D75] mb-1">{current.stepNumber}</p>
            <h1 className="text-2xl font-bold text-[#252B26] font-display mb-3">
              {current.title}
            </h1>
            <p className="text-sm text-[#777D75] leading-relaxed mb-6">{current.subtitle}</p>

            <div className="space-y-3 border-t border-[#E1E6DA] pt-5">
              {current.points.map((pt, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm text-[#252B26]">
                  <span className="w-5 h-5 rounded-full bg-[#E1E6DA] text-[#244C3A] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3" />
                  </span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="max-w-lg w-full mx-auto space-y-4">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to onboarding step ${idx + 1}`}
              onClick={() => setStepIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === stepIndex ? 'w-8 bg-[#244C3A]' : 'w-2 bg-[#A8B9A0]'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <Button variant="outline" onClick={() => setStepIndex(stepIndex - 1)}>
              Previous
            </Button>
          )}
          <Button
            variant="primary"
            fullWidth
            onClick={handleNext}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            {stepIndex === STEPS.length - 1 ? 'Continue to Sign In' : 'Next Step'}
          </Button>
        </div>
      </div>
    </div>
  );
};
