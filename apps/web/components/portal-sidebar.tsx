'use client';

import React from 'react';
import NextLink from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useBranch } from '../context/branch-context';
import {
  DashboardIcon,
  CalendarIcon,
  UsersIcon,
  FileTextIcon,
  PillIcon,
  FlaskIcon,
  ClockIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserCheckIcon,
  ReceiptIcon,
  BarChartIcon,
  BoxesIcon,
  ShoppingCartIcon,
  TruckIcon,
  ActivityIcon,
  ShieldCheckIcon,
  PlusIcon,
  StethoscopeIcon,
  PanelLeftIcon,
  XIcon,
  BuildingIcon,
  ChevronDownIcon,
} from './icons';

export type PortalType = 'doctor' | 'receptionist' | 'pharmacy' | 'owner';

interface PortalSidebarProps {
  portal: PortalType;
  activePath?: string;
}

export function PortalSidebar({ portal, activePath = 'dashboard' }: PortalSidebarProps) {
  const {
    sidebarCollapsed,
    toggleSidebar,
    logoUrl,
    organizationName,
    loading,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    hasPermission,
  } = useBranch();

  const pathname = usePathname() || '';

  const isSettingsActive =
    activePath === 'settings' ||
    activePath === 'all' ||
    activePath === 'branches' ||
    activePath === 'branding' ||
    activePath === 'staff' ||
    activePath === 'roles' ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/organization-settings';

  const [settingsExpanded, setSettingsExpanded] = React.useState<boolean>(isSettingsActive);

  React.useEffect(() => {
    if (isSettingsActive) {
      setSettingsExpanded(true);
    }
  }, [isSettingsActive]);

  const [imageError, setImageError] = React.useState(false);
  const [logoAspectRatio, setLogoAspectRatio] = React.useState<number | null>(null);

  React.useEffect(() => {
    setImageError(false);
    setLogoAspectRatio(null);
  }, [logoUrl]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setLogoAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  };

  const homeHref =
    portal === 'doctor'
      ? '/doctor'
      : portal === 'receptionist'
      ? '/reception'
      : portal === 'pharmacy'
      ? '/pharmacy'
      : '/dashboard';

  const isCustomLogo = !imageError && Boolean(logoUrl);
  const displayLogoSrc = isCustomLogo ? (logoUrl as string) : '/healthiva-logo.png';
  const displayAlt = isCustomLogo ? (organizationName || 'Clinic Logo') : 'Healthiva';

  const settingsSubItems = [
    { key: 'branches', label: 'Manage Branch', href: '/settings/branches', icon: BuildingIcon },
    { key: 'branding', label: 'Branding & Fees', href: '/organization-settings', icon: FileTextIcon },
    { key: 'staff', label: 'Staff & Scopes', href: '/settings/staff', icon: UsersIcon },
    { key: 'roles', label: 'Role Capabilities', href: '/settings/roles', icon: ShieldCheckIcon },
  ];

  const getNavItems = () => {
    switch (portal) {
      case 'doctor': {
        const items = [
          { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, href: '/doctor' },
          { key: 'appointments', label: 'My Appointments', icon: CalendarIcon, href: '/doctor?tab=appointments' },
          { key: 'patients', label: 'Patients', icon: UsersIcon, href: '/doctor?tab=patients', permission: 'visit.read' },
          { key: 'records', label: 'Medical Records', icon: FileTextIcon, href: '/doctor?tab=records', permission: 'visit.read' },
          { key: 'prescriptions', label: 'Prescriptions', icon: PillIcon, href: '/doctor?tab=prescriptions', permission: 'visit.write' },
          { key: 'lab-results', label: 'Lab Results', icon: FlaskIcon, href: '/doctor?tab=lab' },
          { key: 'follow-ups', label: 'Follow-ups', icon: ClockIcon, href: '/doctor?tab=followups' },
          { key: 'messages', label: 'Messages', icon: MessageSquareIcon, href: '/doctor?tab=messages' },
        ];
        return items.filter((item) => !item.permission || (hasPermission && hasPermission(item.permission)));
      }
      case 'receptionist': {
        const items = [
          { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, href: '/reception' },
          { key: 'appointments', label: 'Appointments', icon: CalendarIcon, href: '/reception?tab=appointments' },
          { key: 'patients', label: 'Patients', icon: UsersIcon, href: '/reception?tab=patients', permission: 'patient.register' },
          { key: 'queue', label: 'Check-in / Queue', icon: UserCheckIcon, href: '/reception?tab=queue', permission: 'queue.manage' },
          { key: 'billing', label: 'Billing & Payments', icon: ReceiptIcon, href: '/reception?tab=billing', permission: 'billing.collect' },
          { key: 'messages', label: 'Messages', icon: MessageSquareIcon, href: '/reception?tab=messages' },
          { key: 'reports', label: 'Reports', icon: BarChartIcon, href: '/reception?tab=reports', permission: 'reports.read' },
        ];
        return items.filter((item) => !item.permission || (hasPermission && hasPermission(item.permission)));
      }
      case 'pharmacy': {
        const items = [
          { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, href: '/pharmacy' },
          { key: 'prescriptions', label: 'Prescriptions', icon: PillIcon, href: '/pharmacy?tab=prescriptions', permission: 'visit.read' },
          { key: 'dispense', label: 'Dispense History', icon: FileTextIcon, href: '/pharmacy?tab=dispense', permission: 'pharmacy.dispense' },
          { key: 'inventory', label: 'Inventory', icon: BoxesIcon, href: '/pharmacy?tab=inventory' },
          { key: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCartIcon, href: '/pharmacy?tab=orders' },
          { key: 'suppliers', label: 'Suppliers', icon: TruckIcon, href: '/pharmacy?tab=suppliers' },
          { key: 'reports', label: 'Reports', icon: BarChartIcon, href: '/pharmacy?tab=reports', permission: 'reports.read' },
        ];
        return items.filter((item) => !item.permission || (hasPermission && hasPermission(item.permission)));
      }
      case 'owner':
      default:
        return [
          { key: 'dashboard', label: 'Dashboard', icon: DashboardIcon, href: '/dashboard' },
          { key: 'analytics', label: 'Analytics', icon: ActivityIcon, href: '/dashboard?tab=analytics' },
          { key: 'appointments', label: 'Appointments', icon: CalendarIcon, href: '/dashboard?tab=appointments' },
          { key: 'patients', label: 'Patients', icon: UsersIcon, href: '/dashboard?tab=patients' },
          { key: 'billing', label: 'Billing & Revenue', icon: ReceiptIcon, href: '/dashboard?tab=billing' },
          { key: 'pharmacy', label: 'Pharmacy', icon: PillIcon, href: '/pharmacy' },
          { key: 'inventory', label: 'Inventory', icon: BoxesIcon, href: '/dashboard?tab=inventory' },
        ];
    }
  };

  const getPortalInfo = () => {
    switch (portal) {
      case 'doctor':
        return { title: 'Doctor Portal', icon: StethoscopeIcon };
      case 'receptionist':
        return { title: 'Receptionist Portal', icon: UserCheckIcon };
      case 'pharmacy':
        return { title: 'Pharmacy Portal', icon: PillIcon };
      case 'owner':
      default:
        return { title: 'Admin Portal', icon: ShieldCheckIcon };
    }
  };

  const portalInfo = getPortalInfo();
  const navItems = getNavItems();

  const renderSidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex flex-col justify-between h-full">
        <div>
          {/* Brand Header */}
          <div
            className={`py-3.5 border-b border-slate-100 flex items-center min-h-[69px] ${
              isCollapsed ? 'px-3 justify-center' : 'px-5 justify-between gap-2.5'
            }`}
          >
            {loading ? (
              isCollapsed ? (
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-[#009fe3]/30 border-t-[#009fe3] animate-spin" />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                      <div className="w-4 h-4 rounded-full border-2 border-[#009fe3]/30 border-t-[#009fe3] animate-spin" />
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-4 w-28 bg-slate-200/70 rounded-md animate-pulse" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded-md animate-pulse" />
                    </div>
                  </div>
                  {!isMobile && <div className="w-8 h-8 rounded-xl bg-slate-100/70 shrink-0 animate-pulse" />}
                </div>
              )
            ) : isCollapsed ? (
              <button
                onClick={toggleSidebar}
                className="w-10 h-10 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#009fe3] flex items-center justify-center transition-all cursor-pointer border border-sky-100 shadow-2xs group"
                title="Open Sidebar"
              >
                <PanelLeftIcon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
              </button>
            ) : (
              <>
                {isCustomLogo ? (
                  logoAspectRatio === null || logoAspectRatio < 1.4 ? (
                    <NextLink
                      href={homeHref}
                      onClick={() => isMobile && setMobileSidebarOpen(false)}
                      className="flex items-center gap-3 flex-1 min-w-0 group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shrink-0 shadow-2xs group-hover:border-[#009fe3]/40 transition-colors">
                        <div className="relative w-full h-full">
                          <Image
                            src={displayLogoSrc}
                            alt={displayAlt}
                            fill
                            className="object-contain"
                            priority
                            unoptimized
                            onLoad={handleImageLoad}
                            onError={() => setImageError(true)}
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xs font-black text-slate-900 tracking-tight leading-snug truncate group-hover:text-[#009fe3] transition-colors">
                          {organizationName || 'Clinic'}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                          Clinic Portal
                        </p>
                      </div>
                    </NextLink>
                  ) : (
                    <NextLink
                      href={homeHref}
                      onClick={() => isMobile && setMobileSidebarOpen(false)}
                      className="block flex-1 min-w-0 group"
                    >
                      <div className="relative w-40 h-11">
                        <Image
                          src={displayLogoSrc}
                          alt={displayAlt}
                          fill
                          className="object-contain object-left transition-transform duration-200 group-hover:scale-[1.02]"
                          priority
                          unoptimized
                          onLoad={handleImageLoad}
                          onError={() => setImageError(true)}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold tracking-tight mt-0.5 truncate">
                        {organizationName || 'Clinic Portal'}
                      </p>
                    </NextLink>
                  )
                ) : (
                  <NextLink
                    href={homeHref}
                    onClick={() => isMobile && setMobileSidebarOpen(false)}
                    className="block flex-1 min-w-0 group"
                  >
                    <div className="relative w-40 h-10">
                      <Image
                        src="/healthiva-logo.png"
                        alt="Healthiva"
                        fill
                        className="object-contain object-left transition-transform duration-200 group-hover:scale-[1.02]"
                        priority
                        unoptimized
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-tight mt-0.5 truncate">
                      Run Your Clinic Smarter.
                    </p>
                  </NextLink>
                )}

                {isMobile ? (
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Close Navigation"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={toggleSidebar}
                    className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-slate-200/70"
                    title="Close Sidebar"
                  >
                    <PanelLeftIcon className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Portal Role Indicator */}
          <div className={`pt-4 pb-2 ${isCollapsed ? 'px-2.5' : 'px-4'}`}>
            {loading ? (
              <div
                className={`flex items-center rounded-xl bg-slate-50 border border-slate-200/70 ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-slate-200 animate-pulse shrink-0" />
                {!isCollapsed && <div className="h-3.5 w-24 bg-slate-200 rounded animate-pulse" />}
              </div>
            ) : (
              <div
                className={`flex items-center rounded-xl bg-slate-50 border border-slate-200/70 text-slate-800 text-xs font-bold ${
                  isCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'
                }`}
                title={isCollapsed ? portalInfo.title : undefined}
              >
                <span className="w-5 h-5 rounded-md bg-[#009fe3]/10 text-[#009fe3] flex items-center justify-center shrink-0">
                  <PlusIcon className="w-3.5 h-3.5" />
                </span>
                {!isCollapsed && (
                  <span className="font-extrabold tracking-tight text-slate-900 truncate">
                    {portalInfo.title}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className={`py-2 space-y-1 ${isCollapsed ? 'px-2.5' : 'px-3'}`}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.key || (item.key === 'dashboard' && pathname === item.href);
              return (
                <NextLink
                  key={item.key}
                  href={item.href}
                  onClick={() => isMobile && setMobileSidebarOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl text-xs font-bold transition-all ${
                    isCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#009fe3] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NextLink>
              );
            })}

            {/* Owner Portal: Collapsible Settings Parent & Child Items */}
            {portal === 'owner' && (
              <div className="pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed) {
                      toggleSidebar();
                      setSettingsExpanded(true);
                    } else {
                      setSettingsExpanded(!settingsExpanded);
                    }
                  }}
                  title={isCollapsed ? 'Settings' : undefined}
                  className={`w-full flex items-center justify-between rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2.5'
                  } ${
                    isSettingsActive
                      ? 'bg-sky-50 text-[#009fe3] border border-sky-100 font-extrabold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SettingsIcon className={`w-4 h-4 shrink-0 ${isSettingsActive ? 'text-[#009fe3]' : 'text-slate-400'}`} />
                    {!isCollapsed && <span className="truncate">Settings</span>}
                  </div>
                  {!isCollapsed && (
                    <ChevronDownIcon
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        settingsExpanded ? 'rotate-180 text-[#009fe3]' : ''
                      }`}
                    />
                  )}
                </button>

                {/* Child Sub-Menu items */}
                {settingsExpanded && !isCollapsed && (
                  <div className="ml-4 pl-3 border-l border-slate-200/80 my-1 space-y-1">
                    {settingsSubItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive =
                        activePath === subItem.key ||
                        pathname === subItem.href;

                      return (
                        <NextLink
                          key={subItem.key}
                          href={subItem.href}
                          onClick={() => isMobile && setMobileSidebarOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                            isSubActive
                              ? 'bg-[#009fe3] text-white font-bold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-semibold'
                          }`}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{subItem.label}</span>
                        </NextLink>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Bottom Sidebar Footer */}
        <div
          className={`py-4 border-t border-slate-100/80 flex items-center text-[11px] text-slate-400 font-medium ${
            isCollapsed ? 'px-2 justify-center flex-col gap-1' : 'px-5 justify-between'
          }`}
        >
          {!isCollapsed && <span className="font-bold text-slate-500">Healthiva OS</span>}
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">
            v1.2
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 md:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Slide-Over Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/80 flex flex-col justify-between select-none transition-transform duration-300 ease-in-out md:hidden shadow-2xl ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between select-none min-h-screen transition-all duration-300 ease-in-out bg-white border-r border-slate-200/80 shrink-0 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>
    </>
  );
}

