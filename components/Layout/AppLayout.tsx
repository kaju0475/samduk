'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { AppShell, Center, Loader, Text, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UnifiedSearchModal } from '@/components/Search/UnifiedSearchModal';
import { PropsWithChildren, useEffect, Suspense } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { AutoLogoutHandler } from '@/components/Auth/AutoLogoutHandler';

interface AppLayoutProps extends PropsWithChildren {
    title?: string;
    themeColor?: string;
    mainBg?: string;
}

function AppLayoutContent({ children, title = '삼덕가스공업(주)', themeColor = '#7048E8', mainBg = 'transparent' }: AppLayoutProps) {
  const { isAuthorized, isLoading } = useAuth();
  const [opened, { toggle }] = useDisclosure();
  const [searchOpened, { open: openSearch, close: closeSearch }] = useDisclosure(false);

  // [Fix] Restore Search Modal if history state indicates it should be open
  // This handles the case: Search -> Link -> Page -> Back -> Should show Search
  // [Fix] Restore Search Modal if history state indicates it should be open
  // This handles the case: Search -> Link -> Page -> Back -> Should show Search
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // [System Shutdown Check]
    const shutdownTime = localStorage.getItem('shutdown_timestamp');
    if (shutdownTime) {
        const diff = Date.now() - parseInt(shutdownTime, 10);
        console.log('[System] Shutdown detected. Elapsed:', diff, 'ms');
        
        // If > 10 seconds, force logout
        if (diff > 10000) {
            console.log('[System] > 10s elapsed. Clearing session.');
            localStorage.clear();
            sessionStorage.clear(); // Clear session
            // Clear Cookie
            document.cookie = 'user=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            // Clean URL to prevent loops
            if (window.location.pathname !== '/auth/login') {
                window.location.replace('/auth/login');
            }
        } else {
            console.log('[System] < 10s elapsed. Resuming session.');
            // Resume: Just clear the flag
        }
        localStorage.removeItem('shutdown_timestamp'); // Consumed
    }

    // [Fix] History Sync Logic is primarily for Mobile Back Navigation
    // On PC, we rely on standard local state to avoid browser history pollution
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
        // Check if we are in the 'unified-search' state
        const shouldBeOpen = typeof window !== 'undefined' && window.history.state?.modal === 'unified-search';
        
        if (shouldBeOpen) {
            if (!searchOpened) openSearch();
        } else {
            // If we navigated away (pathname changed) or back to a state without the modal, ensure it closes visually.
            if (searchOpened) closeSearch();
        }
    }
  }, [pathname, searchParams, openSearch, closeSearch, searchOpened]);

  // [Scroll Lock] Manual Implementation
  useEffect(() => {
    if (opened) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [opened]);

  if (isLoading) {
      return (
          <Center h="100vh" bg="#1A1B1E">
              <Stack align="center">
                  <Loader color="blue" type="dots" />
                  <Text c="dimmed" size="sm">사용자 확인 중...</Text>
              </Stack>
          </Center>
      );
  }

  if (!isAuthorized) {
      return null;
  }

  return (
    <AppShell
      navbar={{
        width: { base: '100%', sm: 360 }, // [Mobile] Reverted to 100%
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      header={{ height: 60 }}
      padding={{ base: 'xs', md: 'md' }}
      layout="alt" // Sticky sidebar
      styles={() => ({
        main: { 
            backgroundColor: mainBg,
            color: 'white',
            // Responsive font size: 1rem (16px) on mobile, 1.5rem (24px) on desktop
            fontSize: 'var(--mantine-font-size-md)', 
        },
        header: {
            backgroundColor: 'transparent',
            borderBottom: 'none'
        }
      })}
    >
      <AppShell.Header>
        <Header 
            opened={opened} 
            toggle={toggle} 
            title={title} 
            themeColor={themeColor} 
            onOpenSearch={openSearch} 
        />
      </AppShell.Header>

      <AppShell.Navbar p={0} withBorder={false} style={{ border: 'none', zIndex: 101 }}>
        <Sidebar onClose={toggle} onOpenSearch={openSearch} />
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>

      <UnifiedSearchModal opened={searchOpened} onClose={closeSearch} />
      
      {/* Logic Components */}
      <AutoLogoutHandler />
    </AppShell>
  );
}

export function AppLayout(props: AppLayoutProps) {
  return (
    <Suspense fallback={
       <Center h="100vh" bg="#1A1B1E">
           <Stack align="center">
               <Loader color="blue" type="dots" />
               <Text c="dimmed" size="sm">로딩 중...</Text>
           </Stack>
       </Center>
    }>
      <AppLayoutContent {...props} />
    </Suspense>
  );
}
