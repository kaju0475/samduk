'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect, useLayoutEffect } from 'react';
import { Stack, Text, Box, rem, Badge, Modal, Group, Button, ActionIcon } from '@mantine/core';
import { 
  IconDeviceDesktopAnalytics, 
  IconTruckDelivery, 
  IconSettings,
  IconAlertTriangle,
  IconLogout,
} from '@tabler/icons-react';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import classes from './Sidebar.module.css';

interface NavbarLinkProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?(): void;
  color: string;
}

function NavbarLink({ icon: Icon, label, active, onClick, color }: NavbarLinkProps) {
  return (
    <Box 
        component="div"
        onClick={onClick} 
        className={classes.link} 
        data-active={active || undefined}
        style={{ 
            '--item-color': color, 
        } as React.CSSProperties}
    >
      <Icon style={{ width: rem(26), height: rem(26), filter: active ? `drop-shadow(0 0 5px ${color})` : 'none' }} stroke={1.5} />
      <span className={classes.linkLabel} style={{ fontWeight: active ? 700 : 500 }}>{label}</span>
    </Box>
  );
}

// Interface for custom icon props to avoid 'any'
interface CustomIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'stroke'> {
  stroke?: number | string;
}

// Custom Cylinder Icon based on user request
function CustomGasCylinderIcon({ style, stroke = 1.5, ...other }: CustomIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      style={style}
      fill="none"
      stroke="currentColor" 
      strokeWidth={stroke}
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...other}
    >
      {/* Cylinder Body */}
      <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" stroke="currentColor" fill="currentColor" fillOpacity="0.2" />
      <path d="M7 6v14c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V6" stroke="currentColor" />
      
      {/* Shoulder/Neck Area */}
      <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4" stroke="currentColor" />
      
      {/* Valve System */}
      <rect x="10" y="0.5" width="4" height="2" rx="0.5" fill="currentColor" />
      <path d="M9 2h6" stroke="currentColor" />
      <rect x="14" y="2" width="2" height="3" rx="0.5" fill="currentColor" />

      {/* Warning Label (Triangle) */}
      <path d="M12 10l-2.5 4h5z" fill="currentColor" stroke="none" />
      <path d="M12 10l-2.5 4h5z" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

// Custom Checklist Icon based on user request
function CustomChecklistIcon({ style, stroke = 1.5, ...other }: CustomIconProps) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      style={style}
      fill="none"
      stroke="currentColor" 
      strokeWidth={stroke}
      strokeLinecap="round" 
      strokeLinejoin="round"
      {...other}
    >
      {/* Clipboard Outline */}
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      
      {/* Checkmarks and Lines */}
      <path d="M9 12l2 2 4-4" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

const mockdata = [
  { icon: IconDeviceDesktopAnalytics, label: '대시보드', link: '/dashboard', color: '#845EF7' }, // Deep Amethyst (Harmonized)

  { icon: IconTruckDelivery, label: '납품 / 회수', link: '/work/delivery', color: '#339AF0' }, // Sapphire Blue (Maintained)
  { icon: CustomGasCylinderIcon, label: '충전 관리', link: '/work/charging', color: '#12B886' }, // Emerald Teal (More distinct)
  { icon: IconAlertTriangle, label: '검사 입고/출고', link: '/work/inspection', color: '#FD7E14' }, // New Orange
  { icon: CustomChecklistIcon, label: '기준 정보 관리', link: '/master', color: '#40C057' }, // Jade Green (Maintained)
  { icon: IconSettings, label: '시스템 설정', link: '/system', color: '#FCC419' }, // Antique Bronze/Gold (Better contrast)

];

interface SidebarProps {
    onClose?: () => void;
    onOpenSearch: () => void;
}

export function Sidebar({ onClose, onOpenSearch }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Robust Mobile Detection (Client-Side Only to avoid hydration mismatch)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Media Query for exact 992px breakpoint
    const checkIsMobile = () => setIsMobile(window.matchMedia('(max-width: 62em)').matches);
    
    // Initial check
    checkIsMobile();

    // Event Listener
    const mediaQuery = window.matchMedia('(max-width: 62em)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleNavigation = (link: string) => {
    router.push(link);
    if (onClose) onClose(); // Close menu on navigation to unlock scroll
  };

  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useLayoutEffect(() => {
      // Check User Role & Name synchronously before paint
      const stored = sessionStorage.getItem('currentUser');
      if (stored) {
          try {
              const user = JSON.parse(stored);
              if (user) {
                  const newRole = user.role;
                  const newName = user.name;
                  // eslint-disable-next-line 
                  setUserRole((prev) => (prev !== newRole ? newRole : prev));
                  setUserName((prev) => (prev !== newName ? newName : prev));
              }
          } catch {
              // ignore
          }
      }
  }, [pathname]);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const handleLogoutClose = useModalBackTrap(logoutModalOpen, () => setLogoutModalOpen(false), 'logout-modal');

  const handleLogout = () => {
      // 1. Clear Session & Storage
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = 'user=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      // 2. Redirect to Login Page (Replace history to prevent back navigation loop)
      router.replace('/auth/login');
  };

  const visibleLinks = mockdata.filter(item => {
      // Admin sees everything (Case insensitive check)
      if (userRole && (userRole === '관리자' || userRole === 'ADMIN')) return true;

      // Hidden for non-admin
      if (item.label === '기준 정보 관리' || item.label === '시스템 설정') return false;

      // Default visible
      return true;
  });

  const links = visibleLinks.map((item) => (
    <NavbarLink
      {...item}
      key={item.label}
      active={pathname?.startsWith(item.link)}
      onClick={() => handleNavigation(item.link)}
    />
  ));

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        await fetch('/', { method: 'HEAD' });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className={classes.navbar}>
      <div className={classes.header} style={{ position: 'relative' }}>
         {/* System Online Badge - Moved to Top Right Absolute */}
         <Badge 
            size="xs" 
            variant="dot" 
            color={isOnline ? 'teal' : 'red'}
            style={{ 
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 10,
                backgroundColor: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: isOnline ? '#40C057' : '#FA5252'
            }}
        >
            {isOnline ? 'ONLINE' : 'OFFLINE'}
        </Badge>
        
        {/* Mobile Logout Button - Moved below Badge */}
        {isMobile && (
             <ActionIcon 
                variant="light" 
                color="red" 
                size="lg" // Slightly smaller to fit nicely
                radius="md"
                onClick={() => setLogoutModalOpen(true)}
                style={{
                    position: 'absolute',
                    top: 35, // Below the badge
                    right: 0,
                    zIndex: 11,
                    backgroundColor: 'rgba(0,0,0,0.2)', // Slight background for visibility
                    border: '1px solid rgba(255,100,100,0.2)',
                    color: '#FA5252'
                }}
             >
                <IconLogout size={20} />
             </ActionIcon>
        )}

        {/* Logo Container with Frosted Glass Effect for Visibility */}
        <Box 
            style={{ 
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                marginTop: 10 // Add slight margin for badge clearance if needed
            }}
        >
            <Box style={{ position: 'relative' }}>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
                    boxShadow: '0 0 35px 15px rgba(51, 154, 240, 0.25)',
                    zIndex: 0,
                    filter: 'blur(5px)'
                }} />
                <Image 
                    src="/emblem_v2.png" 
                    alt="Samduk Emblem" 
                    width={64} 
                    height={64} 
                    style={{ 
                        objectFit: 'contain', 
                        mixBlendMode: 'multiply',
                        position: 'relative',
                        zIndex: 1
                    }} 
                />
            </Box>
            <div style={{ flex: 1, lineHeight: 1.1, textAlign: 'center' }}> {/* Center align text in remaining space */}
                <Text fw={800} c="white" style={{ fontSize: '1.6rem', letterSpacing: '-0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>삼덕가스공업(주)</Text>
                <Text size="sm" fw={600} c="white" style={{ letterSpacing: '0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Total Safety System</Text>
            </div>
        </Box>
      </div>

      {/* Info Bar: User Name (Left or Right based on Device) & Actions */}
      {/* Info Bar: AI Search (Left) & User Name (Right) - Swapped for PC */}
      <Box mb="md" px="xs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         
         {/* Reusable Search Button Component */}
         {(() => {
             const SearchButton = (
                <ActionIcon 
                    variant="transparent" 
                    size="lg"
                    radius="md"
                    onClick={() => {
                        onOpenSearch();
                        if (onClose) onClose();
                    }}
                    style={{
                        width: 38,
                        height: 38,
                        padding: 0,
                        overflow: 'hidden',
                        transition: 'transform 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <Image 
                        src="/ai_icon.png" 
                        alt="AI Search" 
                        width={38} 
                        height={38} 
                        style={{ objectFit: 'cover' }}
                    />
                </ActionIcon>
             );

             return (
                 <>
                    {/* Desktop: AI Search Button on Left */}
                    {!isMobile && SearchButton}

                    {/* Mobile: Spacer to push everything to right */}
                    {isMobile && <Box style={{ flex: 1 }} />}

                    <Group gap="xs">
                        {/* Mobile: AI Search Button in Right Group */}
                        {isMobile && SearchButton}

                        {/* User Name (Always on Right now) */}
                        {/* Desktop Style */}
                        {!isMobile && (
                            <Text 
                                size="md" 
                                fw={700} 
                                c="white" 
                                style={{ letterSpacing: '-0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', textAlign: 'right' }}
                            >
                                {userName ? `${userName} 님` : '관리자 님'}
                            </Text>
                        )}

                        {/* Mobile Style */}
                        {isMobile && (
                            <Text 
                                size="sm" 
                                fw={700} 
                                c="white" 
                                style={{ 
                                    letterSpacing: '-0.5px', 
                                    textShadow: '0 2px 4px rgba(0,0,0,0.5)', 
                                    marginLeft: 4, marginRight: 4, 
                                }}
                            >
                                {userName ? `${userName} 님` : '관리자 님'}
                            </Text>
                        )}
                    </Group>
                 </>
             );
         })()}
      </Box>

      <div className={classes.navbarMain}>
        <Stack gap={2}> {/* Compact spacing */}
          {links}
          
          {/* Desktop Login Button in Bottom Menu (Rendered only if Desktop) */}
          {!isMobile && (
              <Box mt="lg"> 
                <NavbarLink 
                    icon={IconSettings} 
                    label="로그아웃" 
                    onClick={() => setLogoutModalOpen(true)} 
                    color="#FA5252" 
                />
              </Box>
          )}
        </Stack>
      </div>

      <Modal 
        opened={logoutModalOpen} 
        onClose={handleLogoutClose}
        title="로그아웃"
        centered
        size="sm"
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        closeOnEscape={false}
      >
        <Text size="md" mb="xl" fw={500} ta="center">
            로그아웃 하시겠습니까?
        </Text>
        <Group justify="center" gap="md">
            <Button variant="default" onClick={() => setLogoutModalOpen(false)} w="45%">
                아니요
            </Button>
            <Button color="red" onClick={handleLogout} w="45%">
                네
            </Button>
        </Group>
      </Modal>
    </nav>
  );
}
