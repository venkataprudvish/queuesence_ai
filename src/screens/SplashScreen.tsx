import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ScanLine, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAppStore } from '../hooks/useAppStore';

export const SplashScreen: React.FC = () => {
  const { setFlowState } = useAppStore();
  const [progress, setProgress] = useState(20);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(65), 350);
    const t2 = setTimeout(() => setProgress(100), 850);
    const t3 = setTimeout(() => setFlowState('onboarding'), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [setFlowState]);

  return (
    <div className="min-h-screen bg-[#F7F5EC] text-[#252B26] flex flex-col items-center justify-between px-6 py-12">
      <div className="w-full max-w-md flex justify-end">
        <button
          type="button"
          onClick={() => setFlowState('app')}
          className="text-xs font-medium text-[#777D75] hover:text-[#252B26] min-h-[44px] px-3 cursor-pointer"
        >
          Skip to Dashboard
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, transform: 'translateY(12px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.35 }}
        className="text-center max-w-sm mx-auto"
      >
        <div className="w-20 h-20 rounded-3xl bg-[#244C3A] text-[#F7F5EC] flex items-center justify-center mx-auto mb-6 border border-[#E1E6DA]">
          <ScanLine className="w-10 h-10" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#244C3A] font-display mb-2">
          QueueSense
        </h1>
        <p className="text-base text-[#777D75] font-medium mb-8">
          Don&apos;t Just Wait. Know Your Wait.
        </p>

        <div className="w-56 mx-auto bg-[#E1E6DA] h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className="bg-[#244C3A] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-[#777D75] font-mono-tabular">
          Initializing local vision architecture ({progress}%)
        </p>
      </motion.div>

      <div className="w-full max-w-xs">
        <Button
          variant="secondary"
          fullWidth
          onClick={() => setFlowState('onboarding')}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Continue to Onboarding
        </Button>
      </div>
    </div>
  );
};
