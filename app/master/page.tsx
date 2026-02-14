'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { SystemAccessQRModal } from './SystemAccessQRModal';
import { Text, Group, ThemeIcon, SimpleGrid, Box, ActionIcon, Button } from '@mantine/core'; // Added ActionIcon
import { IconUsers, IconPrinter, IconFlask, IconQrcode } from '@tabler/icons-react'; // Added IconQrcode
import { useRouter } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { LedgerModal } from './LedgerModal';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';
import { StaggerContainer } from '@/components/UI/StaggerContainer';

// ... (retain CustomIconProps and Custom Icons) ...


// Interface for custom icon props
interface CustomIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'stroke'> {
  stroke?: number | string;
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
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 12l2 2 4-4" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

// Custom Partner Icon
function CustomPartnerIcon({ style, stroke = 1.5, ...other }: CustomIconProps) {
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
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
      <path d="M9 10v4h1" /> 
      <path d="M9 10h1v4" /> 
      <path d="M10 8h2v6h-2z" strokeWidth={1} fill="currentColor" fillOpacity="0.2"/>
      <circle cx="16.5" cy="11.5" r="3.5" stroke="currentColor" fill="none" />
      <path d="M19 14l2 2" />
    </svg>
  );
}

// Custom Cylinder Info Icon
function CustomCylinderInfoIcon({ style, stroke = 1.5, ...other }: CustomIconProps) {
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
      <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4v14c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V6z" stroke="currentColor" fill="currentColor" fillOpacity="0.2" />
      <path d="M7 6v14c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V6" stroke="currentColor" />
      <path d="M7 6c0-2.21 1.79-4 4-4h2c2.21 0 4 1.79 4 4" stroke="currentColor" />
      <rect x="10" y="0.5" width="4" height="2" rx="0.5" fill="currentColor" />
      <path d="M9 2h6" stroke="currentColor" />
      <rect x="14" y="2" width="2" height="3" rx="0.5" fill="currentColor" />
      <rect x="9.5" y="10" width="5" height="4" rx="0.5" stroke="currentColor" strokeWidth={1} fill="none" />
      <path d="M11 12h2" stroke="currentColor" strokeWidth={1} />
    </svg>
  );
}

export default function MasterPage() {
  const router = useRouter();
  const [opened, { open, close }] = useDisclosure(false);
  const [qrOpened, { open: openQr, close: closeQr }] = useDisclosure(false); // QR Modal State

  return (
    <AppLayout title="기준 정보 관리" themeColor="#40C057">
      <PageTransition>
        <Box p="lg">
            <Group justify="space-between" mb="xl" align="flex-end">
                <Group gap="sm">
                    <ThemeIcon size={36} radius="md" style={{ 
                        backgroundColor: 'rgba(64, 192, 87, 0.15)', // Jade Theme
                        border: '1px solid rgba(64, 192, 87, 0.2)',
                        color: '#40C057' 
                    }}>
                        <CustomChecklistIcon style={{ width: 22, height: 22 }} />
                    </ThemeIcon>
                    <div>
                        <Text size="xl" fw={900} c="white" style={{ letterSpacing: '-0.5px' }}>마스터 데이터 관리</Text>
                        <Text size="xs" c="gray.4" fw={500}>Master Data Management</Text>
                    </div>
                </Group>
                
                {/* [System Access QR Button] */}
                <ActionIcon 
                    variant="light" 
                    color="gray" 
                    size="xl" 
                    radius="md"
                    onClick={openQr}
                    aria-label="모바일 접속 QR코드"
                    style={{ border: '1px solid #373A40' }}
                >
                    <IconQrcode size={24} />
                </ActionIcon>
                

                {/* [Tracker Test Data] */}
                <Group gap="xs" ml="auto">
                    <Button 
                        variant="light" 
                        color="violet" 
                        size="xs" 
                        onClick={async () => {
                            if (confirm('새로운 테스트 용기 100개를 생성하시겠습니까?\n(이미 존재하는 경우 추가 생성됩니다)')) {
                                try {
                                    const res = await fetch('/api/admin/tracker-test?mode=create', { method: 'POST' });
                                    const result = await res.json();
                                    
                                    if (!res.ok) {
                                        alert('실패: ' + (result.message || result.error || '서버 응답 없음'));
                                    } else {
                                        alert(result.message || '완료되었습니다.');
                                        window.location.reload();
                                    }
                                } catch (e) {
                                    const msg = e instanceof Error ? e.message : '알 수 없음';
                                    alert('네트워크 오류: ' + msg);
                                }
                            }
                        }}
                    >
                        데이터 생성
                    </Button>
                    <Button 
                        variant="light" 
                        color="red" 
                        size="xs" 
                        onClick={async () => {
                            if (confirm('생성된 테스트 데이터([TEST_TRACKER])를 모두 삭제하시겠습니까?\n관련된 이력도 함께 삭제됩니다.')) {
                                try {
                                    const res = await fetch('/api/admin/tracker-test?mode=delete', { method: 'POST' });
                                    const result = await res.json();
                                    alert(result.message);
                                    window.location.reload();
                                } catch (e) {
                                    console.error(e);
                                    alert('오류 발생');
                                }
                            }
                        }}
                    >
                        데이터 삭제
                    </Button>
                </Group>
            </Group>

            <SystemAccessQRModal opened={qrOpened} onClose={closeQr} />

            <StaggerContainer>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing={{ base: 10, sm: 'lg' }}>
                {[
                    { title: '거래처 관리', desc: '고객사 및 매입처 정보 등록', icon: CustomPartnerIcon, color: '#339AF0' }, // Blue
                    { title: '용기 정보', desc: '고압가스 용기 제원 관리', icon: CustomCylinderInfoIcon, color: '#12B886' }, // Teal
                    { title: '가스 품목 관리', desc: '가스 종류 및 표준 용량 관리', icon: IconFlask, color: '#FAB005' }, // Yellow
                    { title: '사용자 관리', desc: '시스템 접속 계정 관리', icon: IconUsers, color: '#BE4BDB' }, // Grape
                    { title: '납품 대장 출력', desc: '월간 납품 및 회수 현황 인쇄', icon: IconPrinter, color: '#FF922B' }, // Orange
                ].map((item, i) => (
                    <GlassCard 
                    key={i} 
                    p="md" 
                    variant="interactive"
                    style={{ 
                        borderLeft: `5px solid ${item.color}`,
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}
                    mih={{ base: 100, sm: 110, lg: 120 }}
                    onClick={() => {
                        if (item.title === '거래처 관리') router.push('/master/customers');
                        else if (item.title === '용기 정보') router.push('/master/cylinders');
                        else if (item.title === '가스 품목 관리') router.push('/master/gases');
                        else if (item.title === '사용자 관리') router.push('/master/users');
                        else if (item.title === '납품 대장 출력') open();
                    }}
                    >
                        {/* Watermark Icon */}
                        <item.icon 
                            style={{ 
                                position: 'absolute', 
                                right: '-10%', 
                                bottom: '-15%', 
                                width: '120px', 
                                height: '120px', 
                                opacity: 0.07, 
                                transform: 'rotate(-10deg)', 
                                color: item.color,
                                pointerEvents: 'none'
                            }} 
                        />

                        {/* Content */}
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <Text size="xl" fw={700} c="white" style={{ letterSpacing: '-0.5px', marginBottom: '8px', whiteSpace: 'nowrap' }} fz={{ base: 'lg', sm: 'xl', lg: '1.35rem' }}>{item.title}</Text>
                            <Text size="md" c="gray.4" style={{ opacity: 0.8, whiteSpace: 'normal', lineHeight: 1.4 }} fz={{ base: 'sm', sm: 'md', lg: '1.2rem' }}>{item.desc}</Text>
                        </div>
                    </GlassCard>
                ))}
            </SimpleGrid>
            </StaggerContainer>
            <LedgerModal opened={opened} onClose={close} />
        </Box>
      </PageTransition>
    </AppLayout>
  );
}
