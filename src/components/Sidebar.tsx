import React from 'react';
import { LayoutDashboard, MapPin, MessageSquare, Megaphone, LogOut, BarChart3 } from 'lucide-react';
import { Logo } from './Logo';

interface SidebarProps {
  role: 'client' | 'pharma' | 'pharma_active' | 'pharma_pending';
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  currentPath,
  onNavigate,
  onLogout,
  unreadCount = 0,
}) => {
  const isPharma =
    role === 'pharma' || role === 'pharma_active' || role === 'pharma_pending';

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
          {
            id: 'stats',
            label: 'Stats',
            icon: BarChart3,
            path: '/pharma/stats',
            isActive:
              currentPath === '/pharma/stats' ||
              currentPath === '/stats' ||
              currentPath === '/statistiques',
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
        currentPath === '/client' ||
        currentPath === '/map' ||
        currentPath === '/home',
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
    <aside
      aria-label="Sidebar navigation desktop"
      className="hidden md:flex flex-col w-[80px] bg-slate-900 border-r border-slate-800 h-screen sticky top-0 justify-between items-center py-4 shrink-0 z-[800] select-none"
    >
      {/* Brand Icon Top */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => onNavigate(isPharma ? '/pharma/dashboard' : '/client')}
          className="w-12 h-12 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-blue-900/30 hover:scale-105 transition-transform cursor-pointer border border-slate-200"
          title="EFA GARDE Lomé"
        >
          <Logo className="w-full h-full" variant="blue" />
        </button>
        <span className="text-[9px] font-black tracking-widest text-[#3b82f6] uppercase mt-1">
          EFA
        </span>
      </div>

      {/* 4 Tabs Central Dock */}
      <nav className="flex flex-col items-center gap-3 w-full px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive;

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.path)}
              className={`w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-[#0A3D8F] text-white scale-105 shadow-lg shadow-blue-900/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={tab.label}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className="w-6 h-6 shrink-0"
                  style={{ width: 24, height: 24 }}
                />
                {tab.id === 'chat' && unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#25D366] text-white text-[11px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full animate-pulse px-1 shadow-sm leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight leading-none mt-1.5 ${
                  active ? 'font-black text-white' : 'font-semibold text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Logout / Switch Role Bottom */}
      <div className="flex flex-col items-center">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-11 h-11 rounded-2xl bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/60 flex items-center justify-center transition-all cursor-pointer shadow-sm hover:scale-105"
            title="Changer de rôle / Se déconnecter"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
