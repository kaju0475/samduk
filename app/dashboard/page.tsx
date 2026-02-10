'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { SimpleGrid, Text, Stack, Box, Group } from '@mantine/core';
// import { useDisclosure } from '@mantine/hooks'; // Unused
import { IconTruckDelivery } from '@tabler/icons-react';
import { IconCylinderCustom, IconFactoryCustom, IconInspectionCustom } from '@/components/Icons/DashboardIcons';
import { useSmartPolling } from '@/app/hooks/useSmartPolling';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RecentActivityLog } from '@/components/Dashboard/RecentActivityLog';
import { PageTransition } from '@/components/UI/PageTransition';
import { StaggerContainer } from '@/components/UI/StaggerContainer';
import { GlassCard } from '@/components/UI/GlassCard';
// import { useDisclosure } from '@mantine/hooks'; // Unused
// import { useDoubleBackExit } from '@/app/hooks/useDoubleBackExit'; // Removed

export default function DashboardPage() {
  const router = useRouter();
  
    // [PWA Exit Strategy] - Reverted to Standard Navigation (User Request)
    // Logout Trap is handled in /app/menu/page.tsx (Mobile Menu)
  
    const [counts, setCounts] = useState({
      totalCylinders: 0,
      atPartner: 0,
      atFactory: 0,
      needsInspection: 0,
      lostCount: 0 
    });
    
    const [isAdmin, setIsAdmin] = useState(false);
  
    useEffect(() => {
      if (typeof window !== 'undefined') {
          try {
              // Check sessionStorage first (Primary source)
              const sessionUser = sessionStorage.getItem('currentUser');
              const localUser = localStorage.getItem('currentUser');
              const userStr = sessionUser || localUser;
  
              if (userStr) {
                  const user = JSON.parse(userStr);
                  if (user.role === '관리자' || user.role === 'ADMIN') {
                      setIsAdmin(true);
                  }
              }
          } catch {}
      }
    }, []);
  
    const pollStats = useCallback(async () => {
      try {
        const statsRes = await fetch('/api/dashboard/stats');
        if (!statsRes.ok) throw new Error(`Status: ${statsRes.status}`);
        const statsData = await statsRes.json();
        if (statsData && !statsData.error) {
            setCounts(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(statsData)) {
                    return statsData;
                }
                return prev;
            });
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      }
    }, []);
  
    useSmartPolling({
      callback: pollStats,
      activeInterval: 1000,
      idleInterval: 30000,
      idleTimeout: 5000
    });
  
    // Initial Sync
    useEffect(() => {
       const init = async () => {
           await pollStats();
       };
       init();
    }, [pollStats]);
  
  
    const baseStats = [
      { label: '총 보유 용기', value: counts.totalCylinders, icon: IconCylinderCustom, color: 'violet', desc: '전체 자산', gradient: { from: '#7950F2', to: '#be4bdb'}, link: '/master/cylinders?filter=ALL' }, 
      { label: '거래처 출고', value: counts.atPartner, icon: IconTruckDelivery, color: 'blue', desc: '거래처 보유', gradient: { from: '#339AF0', to: '#1C7ED6'}, link: '/master/cylinders?filter=PARTNER' }, 
      { label: '공장 내 재고', value: counts.atFactory, icon: IconFactoryCustom, color: 'teal', desc: '공장 내 보유', gradient: { from: '#087F5B', to: '#12B886' }, link: '/master/cylinders?filter=FACTORY' }, 
      { label: '검사 예정', value: counts.needsInspection, icon: IconInspectionCustom, color: 'orange', desc: '검사 예정', gradient: { from: '#F08C00', to: '#FCC419'}, link: '/master/cylinders?filter=NEEDS_INSPECTION' }, 
    ];
  
    // Only add Lost Cylinder Card if Admin
    const stats = isAdmin 
      ? [...baseStats, { label: '장기 미회수 용기', value: counts.lostCount, icon: IconCylinderCustom, color: 'red', desc: '분실/미아', gradient: { from: '#FA5252', to: '#E03131'}, link: '/master/cylinders?filter=LOST' }]
      : baseStats;
  
    return (
      <AppLayout title="대시보드" mainBg="transparent">
        <PageTransition>
          <Stack gap="lg">
              <Text c="gray.4" size="lg" fw={500} style={{ fontSize: '1.1rem' }}>전체 시스템 현황 모니터링 (실시간 데이터)</Text>
              
              <StaggerContainer>
                  {/* 
                     Adjusted Grid for 4 items in 1 row on Mobile, 5 on Desktop (Admin).
                     Note: Original code had base:4 for simple grid, which might be tight on very small screens,
                     but keeping it to match original intent.
                  */}
                  <SimpleGrid cols={{ base: 4, xs: 4, sm: 4, lg: isAdmin ? 5 : 4 }} spacing={{ base: 6, sm: 'md', lg: 'xl' }}>
                  {stats.map((stat) => (
                      <GlassCard 
                          key={stat.label}
                          variant="interactive"
                          onClick={() => router.push(stat.link)}
                          style={{
                              minHeight: '140px',
                              borderTop: `2px solid ${stat.gradient.from}`,
                              background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)`,
                              position: 'relative',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                      >
                          {/* Glow Overlay */}
                          <Box style={{
                              position: 'absolute',
                              top: '-20%',
                              right: '-10%',
                              width: '60%',
                              height: '60%',
                              background: stat.gradient.from,
                              filter: 'blur(40px)',
                              opacity: 0.1,
                              pointerEvents: 'none',
                          }} />

                          {/* Background Decoration */}
                          <Box visibleFrom="sm">
                              <stat.icon 
                                  style={{ 
                                      position: 'absolute', 
                                      right: '-10%', 
                                      bottom: '-15%', 
                                      opacity: 0.15, 
                                      transform: 'rotate(-5deg) scale(1.3)', 
                                      color: stat.gradient.from,
                                      pointerEvents: 'none',
                                      transition: 'all 0.6s ease',
                                  }} 
                                  width="100%" height="auto"
                              />
                          </Box>
                          
                          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                              <Group justify="space-between" align="center" visibleFrom="xs" mb={4}>
                                  <Text 
                                      c="dimmed" 
                                      fw={700} 
                                      tt="uppercase" 
                                      style={{ whiteSpace: 'nowrap' }}
                                      fz={{ base: '9px', sm: '0.7rem' }}
                                      lts={1.5}
                                  >
                                      {stat.label}
                                  </Text>
                                  <Box style={{ 
                                      width: '8px', 
                                      height: '8px', 
                                      borderRadius: '50%', 
                                      background: stat.color, 
                                      boxShadow: `0 0 12px ${stat.color}`,
                                      animation: 'pulse 2s infinite'
                                  }} />
                              </Group>

                              {/* Mobile Label (Centered, smaller) */}
                              <Text hiddenFrom="xs" c="dimmed" fw={700} fz="9px" ta="center" mb={2} lts={1}>
                                  {stat.label}
                              </Text>

                              <Text fw={900} style={{ 
                                  color: '#fff', 
                                  letterSpacing: '-2px', 
                                  lineHeight: 1,
                                  fontFamily: 'Outfit, sans-serif',
                                  textShadow: `0 0 20px rgba(255,255,255,0.2)`
                              }} fz={{ base: '2rem', sm: '3.2rem', md: '4rem' }} ta={{ base: 'center', sm: 'left' }}>
                                  {stat.value}
                              </Text>
                          </div>
   
                          <Box visibleFrom="sm" mt="md" style={{ position: 'relative', zIndex: 1 }}>
                              <Group gap={6} align="center">
                                  <Text c="dimmed" size="xs" fw={400} fs="italic">{stat.desc}</Text>
                              </Group>
                          </Box>
                      </GlassCard>
                  ))}
                  </SimpleGrid>
              </StaggerContainer>
  
              {/* Recent Activity Log also needs to be part of the flow? 
                  The PageTransition wraps it effectively, but we could stagger it too.
              */}
              <Box style={{ animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.3s', opacity: 0 }}>
                   <RecentActivityLog />
              </Box>
          </Stack>
        </PageTransition>
      </AppLayout>
    );
  }
