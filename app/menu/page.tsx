'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSmartPolling } from '@/app/hooks/useSmartPolling';
import { useRouter } from 'next/navigation';
import { Container, Text, Group, ThemeIcon, Box, Stack, Modal, Button, Badge, ActionIcon } from '@mantine/core';
import { 
  IconDeviceDesktopAnalytics, 
  IconTruckDelivery, 
  IconSettings,
  IconAlertTriangle,
  IconLogout
} from '@tabler/icons-react';
import Image from 'next/image';
import { RecentActivityLog } from '@/components/Dashboard/RecentActivityLog';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { UnifiedSearchModal } from '@/components/Search/UnifiedSearchModal';

// --- Custom Icons (Reused from Sidebar) ---

interface CustomIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'stroke'> {
  stroke?: number | string;
}

function CustomGasCylinderIcon({ style, stroke = 1.5, ...other }: CustomIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={style} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...other}>
      <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" stroke="currentColor" fill="currentColor" fillOpacity="0.2" />
      <path d="M7 6v14c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V6" stroke="currentColor" />
      <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4" stroke="currentColor" />
      <rect x="10" y="0.5" width="4" height="2" rx="0.5" fill="currentColor" />
      <path d="M9 2h6" stroke="currentColor" />
      <rect x="14" y="2" width="2" height="3" rx="0.5" fill="currentColor" />
      <path d="M12 10l-2.5 4h5z" fill="currentColor" stroke="none" />
      <path d="M12 10l-2.5 4h5z" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function CustomChecklistIcon({ style, stroke = 1.5, ...other }: CustomIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={style} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...other}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 12l2 2 4-4" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

// --- Menu Data ---
const mockdata = [
  { icon: IconDeviceDesktopAnalytics, label: '대시보드', link: '/dashboard', color: '#845EF7', desc: '전체 현황 모니터링' },
  { icon: IconTruckDelivery, label: '납품 / 회수', link: '/work/delivery', color: '#339AF0', desc: '용기 납품 및 회수 처리' },
  { icon: CustomGasCylinderIcon, label: '충전 관리', link: '/work/charging', color: '#12B886', desc: '용기 충전 및 생산 관리' },
  { icon: IconAlertTriangle, label: '검사 입고/출고', link: '/work/inspection', color: '#FD7E14', desc: '용기 검사 내역 관리' },
  { icon: CustomChecklistIcon, label: '기준 정보 관리', link: '/master', color: '#40C057', desc: '거래처 및 용기 정보' },
  { icon: IconSettings, label: '시스템 설정', link: '/system', color: '#FCC419', desc: '계정 및 시스템 관리' },
];

export default function MobileMenuPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const handleLogoutClose = useModalBackTrap(logoutModalOpen, () => setLogoutModalOpen(false), 'menu-logout-modal');
  const [isOnline, setIsOnline] = useState(true);

  const [isAuthorized, setIsAuthorized] = useState(false);
  const isLoggingOut = useRef(false);

  useEffect(() => {
    // [Mobile] Back Button Trap
    const TRAP_STATE = { page: 'menu_trap' };
    
    if (window.history.state?.page !== 'menu_trap') {
        window.history.pushState(TRAP_STATE, '', window.location.href);
    }

    const handlePopState = () => {
        if (isLoggingOut.current) return;
        
        if (
            (typeof window !== 'undefined' && window.__MODAL_COUNT__ && window.__MODAL_COUNT__ > 0) || 
            window.history.state?.page === 'menu_trap'
        ) {
            return;
        }

        window.history.pushState(TRAP_STATE, '', window.location.href);
        setLogoutModalOpen(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);


  useEffect(() => {
    // [Auth Check]
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift();
        return cookieValue || null;
      }
      return null;
    };

    const userCookie = getCookie('user');
    
    if (userCookie) {
      try {
        const user = JSON.parse(decodeURIComponent(userCookie));
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        setTimeout(() => {
          setIsAuthorized(true);
          setUserRole(user.role);
          setUserName(user.name);
        }, 0);
        
        // Initial check only, polling is handled by useSmartPolling
        const checkStatus = async () => {
          try {
            await fetch('/', { method: 'HEAD' });
            setIsOnline(true);
          } catch {
            setIsOnline(false);
          }
        };
        checkStatus();

      } catch (e) {
        console.error('Cookie parse error:', e);
      }
      return; // Return if cookie auth successful
    }
    
    const stored = localStorage.getItem('currentUser');
    
    if (!stored) {
      if (!isLoggingOut.current) {
        router.replace('/auth/login');
      }
      return;
    }

    try {
      const user = JSON.parse(stored);
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      
      setTimeout(() => {
        setIsAuthorized(true);
        setUserRole(user.role);
        setUserName(user.name);
      }, 0);
      
      const checkStatus = async () => {
        try {
          await fetch('/', { method: 'HEAD' });
          setIsOnline(true);
        } catch {
          setIsOnline(false);
        }
      };
      checkStatus();

    } catch {
      router.replace('/auth/login');
    }
  }, [router]);

  const checkOnlineStatus = useCallback(async () => {
      try {
          await fetch('/', { method: 'HEAD' });
          setIsOnline(true);
      } catch {
          setIsOnline(false);
      }
  }, []);

  useSmartPolling({
      callback: checkOnlineStatus,
      activeInterval: 60000, // Check every 60s
      idleInterval: 300000,  // Check every 5m if idle
      hiddenInterval: 0      // Stop if hidden
  });

  const handleLogout = async () => {
    isLoggingOut.current = true;
    
    // [Logout Logic]
    try {
        // Clear Auth Data
        document.cookie = 'user=; Max-Age=0; path=/;';
        localStorage.removeItem('currentUser');
        
        // Redirect
        router.replace('/auth/login');
    } catch (e) {
        console.error("Logout failed", e);
        router.replace('/auth/login');
    }
  };

  if (!isAuthorized) {
    return null; 
  }

  const visibleItems = mockdata.filter(item => {
    if (userRole && (userRole === '관리자' || userRole === 'ADMIN')) return true;
    if (item.label === '기준 정보 관리' || item.label === '시스템 설정') return false;
    return true;
  });

  return (
    <Container size="xs" p="md" style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative', 
    }}>
      {/* ... (Previous Content) ... */}
      
      {/* System Online Badge - Top Right */}
      <Box style={{ position: 'absolute', top: 'var(--mantine-spacing-md)', right: 'var(--mantine-spacing-md)', zIndex: 10 }}>
            <Badge 
                size="md" 
                variant="outline"
                color={isOnline ? 'teal' : 'red'}
                leftSection={
                    <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: isOnline ? 'var(--mantine-color-teal-5)' : 'var(--mantine-color-red-5)',
                        boxShadow: isOnline ? '0 0 8px var(--mantine-color-teal-5)' : 'none',
                    }} />
                }
            >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Badge>
      </Box>

      {/* Header Section */}
      <Stack align="center" gap="xs" mb="md" mt="xs">
         <Box 
            style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center', 
                width: '100%',
                marginBottom: 10,
                position: 'relative'
            }}
        >
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
                boxShadow: '0 0 40px 20px rgba(51, 154, 240, 0.25)', 
                zIndex: 0,
                filter: 'blur(5px)'
            }} />
            <Image 
                src="/emblem_v2.png" 
                alt="Samduk Emblem" 
                width={80} 
                height={80} 
                style={{ 
                    objectFit: 'contain', 
                    zIndex: 1,
                    filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.5))'
                }} 
            />
        </Box>
        <Text size="xl" fw={900} c="white" style={{ letterSpacing: '-1px' }}>삼덕가스공업(주)</Text>
        <Text size="sm" c="dimmed" fw={600}>Total Safety System</Text>
        
        {/* User Info Row: AI (Left) - [Name + Logout] (Right) */}
        <Group mt="xs" w="100%" justify="space-between" px="md" gap="xs">
             {/* Left: AI Search Button */}
             <ActionIcon 
                variant="transparent" 
                size="xl" 
                radius="md"
                onClick={() => setSearchOpened(true)}
                style={{
                    width: 44,
                    height: 44,
                    padding: 0,
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease',
                    // Add a subtle glow to match the neon theme
                    boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)' 
                }}
             >
                <Image 
                  src="/ai_icon.png" 
                  alt="AI Search" 
                  width={44} 
                  height={44} 
                  style={{ objectFit: 'cover' }}
                />
             </ActionIcon>

            {/* Right: Name & Logout */}
            <Group gap="md"> 
                {/* User Name Badge (Square/Rectangular Style) */}
                <Box
                    style={{
                        height: 44, 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 16px',
                        borderRadius: 'var(--mantine-radius-md)',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                        border: '1px solid rgba(250, 82, 82, 0.1)', // Changed border color for logout indication context
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        backdropFilter: 'blur(5px)',
                        minWidth: 80 
                    }}
                >
                    {userName ? `${userName} 님` : '사용자'}
                </Box>

                <ActionIcon 
                    variant="light" 
                    color="red" 
                    size="xl" 
                    radius="md" 
                    onClick={() => setLogoutModalOpen(true)}
                    style={{
                        backgroundColor: 'rgba(250, 82, 82, 0.15)', 
                        border: '1px solid rgba(250, 82, 82, 0.3)', 
                    }}
                >
                    <IconLogout size={24} stroke={1.5} />
                </ActionIcon>
            </Group>
        </Group>
      </Stack>

      {/* Menu Grid */}
      <Stack gap="md" style={{ flex: 1 }}>
        {visibleItems.map((item) => (
          <Box
            key={item.label}
            onClick={() => router.push(item.link)}
            p="lg"
            style={{
              background: `linear-gradient(135deg, ${item.color}26 0%, rgba(255, 255, 255, 0.03) 100%)`,
              borderColor: `${item.color}4D`,
              backdropFilter: 'blur(10px)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: 'var(--mantine-radius-md)',
              width: '100%',
              display: 'block',
              transition: 'transform 0.2s ease, box-shadow 0.2s',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer'
            }}
          >
            <Group>
              <ThemeIcon size={48} radius="md" color={item.color} variant="filled" style={{ boxShadow: `0 4px 10px ${item.color}66` }}>
                <item.icon style={{ width: 28, height: 28 }} stroke={1.5} color="white" />
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Text size="lg" fw={700} c="white">
                  {item.label}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                    {item.desc}
                </Text>
              </div>
            </Group>
          </Box>
        ))}

        {/* Recent Activity Log */}
        <Box mt="md">
            <RecentActivityLog />
        </Box>

      </Stack>

      {/* Logout Modal */}
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
            로그아웃하시겠습니까?
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

      {/* UI Search Modal */}
      <UnifiedSearchModal opened={searchOpened} onClose={() => setSearchOpened(false)} />
    </Container>
  );
}
