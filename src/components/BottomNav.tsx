import React from 'react';
import { MapPin, MessageSquare, Megaphone, LayoutDashboard } from 'lucide-react';

interface BottomNavProps {
  role: 'client' | 'pharma' | 'pharma_active' | 'pharma_pending';
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  role,
  currentPath,
  onNavigate,
}) => {
  // Masqué dans la vue de chat plein écran sur mobile
  if (currentPath.startsWith('/chat')) {
    return null;
  }

  const isPharma =
    role === 'pharma' || role === 'pharma_active' || role === 'pharma_pending';

  // Tabs mobile ultra-fines (h-14 max) : CARTE, CHAT, ESPACE PUBLICITAIRE
  const tabs = [
    ...(isPharma
      ? [
          {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            path: '/pharma/dashboard',
            isActive:
              currentPath === '/pharma/dashboard' ||
              currentPath === '/dashboard-pharma' ||
              currentPath === '/pharma/login',
          },
        ]
      : []),
    {
      id: 'carte',
      label: 'Carte',
      icon: MapPin,
      path: '/client',
      isActive:
        currentPath === '/' ||
        currentPath === '/home' ||
        currentPath === '/carte' ||
        currentPath === '/client' ||
        currentPath === '/map',
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      path: '/inbox',
      isActive: currentPath === '/inbox',
    },
    {
      id: 'pub',
      label: 'Espace Pub',
      icon: Megaphone,
      path: '/pub',
      isActive:
        currentPath === '/pub' ||
        currentPath === '/app-mobile' ||
        currentPath === '/download',
    },
  ];

  return (
    <nav
      aria-label="Navigation mobile EFA GARDE"
      className="md:hidden fixed bottom-0 left-0 right-0 w-full z-[900] bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] h-14 max-h-14 flex items-center justify-around px-2 select-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.isActive;

        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150 cursor-pointer active:scale-95 ${
              active
                ? 'text-[#0A3D8F]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title={tab.label}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                className={`w-5 h-5 transition-transform ${
                  active ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'
                }`}
              />
              {active && (
                <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#0A3D8F]" />
              )}
            </div>
            <span
              className={`text-[10px] tracking-tight leading-none mt-1 ${
                active ? 'font-black text-[#0A3D8F]' : 'font-medium text-slate-500'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
