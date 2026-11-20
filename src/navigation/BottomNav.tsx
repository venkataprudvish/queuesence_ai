import React from 'react';
import { Home, Video, BarChart2, Clock, User } from 'lucide-react';
import { MainTab } from '../types';
import { useAppStore } from '../hooks/useAppStore';

const MOBILE_TABS: {
  id: MainTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'monitor', label: 'Monitor', Icon: Video },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2 },
  { id: 'history', label: 'History', Icon: Clock },
  { id: 'profile', label: 'Profile', Icon: User },
];

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F7F5EC]/95 backdrop-blur-md border-t border-[#E1E6DA] pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {MOBILE_TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer select-none ${
                isActive ? 'text-[#244C3A]' : 'text-[#777D75] hover:text-[#252B26]'
              }`}
            >
              <div
                className={`px-3 py-1 rounded-full transition-colors ${
                  isActive ? 'bg-[#E1E6DA]' : 'bg-transparent'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className={`text-[11px] tracking-tight mt-0.5 whitespace-nowrap ${
                  isActive ? 'font-semibold text-[#244C3A]' : 'font-medium text-[#777D75]'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
