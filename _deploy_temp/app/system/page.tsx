'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';
import { StaggerContainer } from '@/components/UI/StaggerContainer';
import { Text, Group, ThemeIcon, Stack, SimpleGrid, UnstyledButton, Switch } from '@mantine/core';
import { IconSettings, IconFileAnalytics, IconDatabase, IconMoon, IconBarcode, IconBuildingSkyscraper } from '@tabler/icons-react';
import { DataManagement } from '@/components/System/DataManagement';
import { SafetyReportsResponsive } from '@/components/System/SafetyReportsResponsive';
// import { BackupManagementModal } from '@/components/System/BackupManagementModal';
import { useDisclosure } from '@mantine/hooks';
import { getSoundSettings, saveSoundSettings } from '@/app/utils/soundSettings';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SystemPage() {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      const settings = getSoundSettings();
      setVibrationEnabled(settings.vibrationEnabled);
    }, 0);
  }, []);

  const toggleVibration = (checked: boolean) => {
    setVibrationEnabled(checked);
    const current = getSoundSettings();
    saveSoundSettings({ ...current, vibrationEnabled: checked });
  };

  return (
    <AppLayout title="시스템 설정">
      <PageTransition>
      <Stack gap="xl">
        
        {/* General Settings Section */}
        <section>
          <Group mb="md">
            <ThemeIcon size="lg" radius="md" variant="light" color="gray">
              <IconSettings size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg">일반 설정 (General Settings)</Text>
          </Group>

          <StaggerContainer>
          <SimpleGrid cols={{ base: 2, sm: 2, xl: 4 }} spacing="md">
            {/* Display Mode */}
            <GlassCard 
                p="sm" 
                variant="static"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <Group justify="space-between" mb={8} wrap="nowrap">
                <Group gap={8}>
                  <ThemeIcon size="lg" radius="md" variant="filled" color="dark" style={{ opacity: 0.8 }}>
                    <IconMoon size={22} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">다크 모드</Text>
                </Group>
                <Switch 
                  size="sm"
                  label=""
                  checked={true}
                  disabled
                />
              </Group>
              <Text c="dimmed" size="xs" style={{ lineHeight: 1.3 }}>시스템 전체에 다크 테마를 적용합니다.</Text>
            </GlassCard>

            {/* Haptic Feedback */}
            <GlassCard 
                p="sm" 
                variant="static"
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <Group justify="space-between" mb={8} wrap="nowrap">
                <Group gap={8}>
                  <ThemeIcon size="lg" radius="md" variant="filled" color="orange" style={{ opacity: 0.8 }}>
                    <IconBarcode size={22} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">진동</Text>
                </Group>
                <Switch 
                  size="sm"
                  label="" 
                  checked={vibrationEnabled}
                  onChange={(e) => toggleVibration(e.currentTarget.checked)}
                />
              </Group>
              <Text c="dimmed" size="xs" style={{ lineHeight: 1.3 }}>스캔 성공/실패 시 진동 알림을 받습니다.</Text>
            </GlassCard>

             {/* Safety Report Card */}
             <UnstyledButton onClick={open} style={{ height: '100%' }}>
                <GlassCard 
                    p="sm" 
                    variant="interactive" 
                    style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <Group mb={8} gap={8}>
                        <ThemeIcon size="lg" radius="md" variant="filled" color="orange" style={{ opacity: 0.8 }}>
                        <IconFileAnalytics size={22} />
                        </ThemeIcon>
                        <div style={{ flex: 1 }}>
                        <Text fw={700} size="sm" lineClamp={1}>안전 리포트</Text>
                        <Text size="10px" c="dimmed" lineClamp={1}>Safety Report</Text>
                        </div>
                    </Group>
                    <Text c="dimmed" size="xs" lineClamp={2} style={{ lineHeight: 1.3 }}>
                        용기 추적, 장기 미회수 등 안전 보고서 조회
                    </Text>
                  </div>
                </GlassCard>
             </UnstyledButton>

             {/* Backup Management Card */}
             <UnstyledButton onClick={() => router.push('/system/backup')} style={{ height: '100%' }}>
                <GlassCard 
                    p="sm" 
                    variant="interactive" 
                    style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <Group mb={8} gap={8}>
                        <ThemeIcon size="lg" radius="md" variant="filled" color="indigo" style={{ opacity: 0.8 }}>
                            <IconDatabase size={22} />
                        </ThemeIcon>
                        <div style={{ flex: 1 }}>
                            <Text fw={700} size="sm" lineClamp={1}>백업 관리</Text>
                            <Text size="10px" c="dimmed" lineClamp={1}>Backup</Text>
                        </div>
                    </Group>
                    <Text c="dimmed" size="xs" lineClamp={2} style={{ lineHeight: 1.3 }}>
                        데이터 자동 백업 일정 및 복구 작업
                    </Text>
                  </div>
                </GlassCard>
             </UnstyledButton>

             {/* Company Settings Card (Added) */}
             <UnstyledButton onClick={() => router.push('/system/company')} style={{ height: '100%' }}>
                <GlassCard 
                    p="sm" 
                    variant="interactive" 
                    style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <Group mb={8} gap={8}>
                        <ThemeIcon size="lg" radius="md" variant="filled" color="cyan" style={{ opacity: 0.8 }}>
                            <IconBuildingSkyscraper size={22} />
                        </ThemeIcon>
                        <div style={{ flex: 1 }}>
                            <Text fw={700} size="sm" lineClamp={1}>회사 정보 관리</Text>
                            <Text size="10px" c="dimmed" lineClamp={1}>Company & Aliases</Text>
                        </div>
                    </Group>
                    <Text c="dimmed" size="xs" lineClamp={2} style={{ lineHeight: 1.3 }}>
                        회사명 및 자사 용기 식별을 위한 별칭(Alias) 설정
                    </Text>
                  </div>
                </GlassCard>
             </UnstyledButton>
          </SimpleGrid>
          </StaggerContainer>
        </section>

        {/* Data Management Section */}
        <section>
           <DataManagement />
        </section>

      </Stack>
      </PageTransition>

      <SafetyReportsResponsive opened={opened} onClose={close} />
      {/* <BackupManagementModal /> removed in favor of /admin page */}
    </AppLayout>
  );
}
