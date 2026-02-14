'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';
import { StaggerContainer } from '@/components/UI/StaggerContainer';

import { 
  Paper, Text, Button, Stack, Modal, Tabs, Group, TextInput,
  Grid, Badge, Table, ScrollArea, LoadingOverlay, Box, Card, Textarea
} from '@mantine/core';
import { GasBadge } from '@/components/Common/GasBadge';
import { DateInput, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/ko';
import useSWR from 'swr';
import { useState, useEffect, Fragment, useMemo } from 'react';
import dayjs from 'dayjs';
import { IconScan, IconArrowRight, IconAnalyze, IconCheck, IconAlertTriangle, IconX } from '@tabler/icons-react';
import { QRScannerModal } from '@/components/Common/QRScannerModal';
import { useScanner } from '@/app/hooks/useScanner';
import { CentralNotification } from '@/components/Common/CentralNotification';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { playErrorSound, playWarningSound } from '@/app/utils/feedback';
import { TransactionValidator } from '@/lib/transaction-validator';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { useUserMap } from '@/app/hooks/useUserMap';
import { getWorkerId } from '@/app/utils/authUtils';
import { WorkSessionStatsModal } from '@/components/Work/WorkSessionStatsModal';
import { useVisualFeedbackStore } from '@/store/visualFeedbackStore'; // [VISUAL_FEEDBACK_IMPORT]
import { EdgeLighting } from '@/components/UI/EdgeLighting'; // [NEW]
import { SafetyConfirmModal, SafetyLevel } from '@/components/Common/SafetyConfirmModal';

// Types
interface InspectionItem {
    id: number;
    cylinderId: string;
    gasType: string;
    gasColor?: string; // Optional or required depending on data
    type?: string;     // Allow string to handle '기타출고' etc.
    action: string;    // Allow string to handle flexible actions
    timestamp: string;
    workerId: string;
    memo?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function InspectionPage() {
  const [activeTab, setActiveTab] = useState<string | null>('outbound');
  const [isProcessing, setIsProcessing] = useState(false); // [NEW] Loading State
  const [scannerOpened, setScannerOpened] = useState(false);
  const [scannedQr, setScannedQr] = useState('');
  const { trigger, isActive: feedbackActive, type: feedbackType } = useVisualFeedbackStore(); // [VISUAL_FEEDBACK_HOOK]
  
  const [inboundModalOpen, setInboundModalOpen] = useState(false);
  const handleInboundClose = useModalBackTrap(inboundModalOpen, () => setInboundModalOpen(false), 'inspection-inbound-modal');
  const [nextExpiry, setNextExpiry] = useState<Date | null>(null);
  
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const handleFailureClose = useModalBackTrap(failureModalOpen, () => setFailureModalOpen(false), 'inspection-failure-modal'); 
  const [failureReason, setFailureReason] = useState('');
  
  const [notification, setNotification] = useState<{
      opened: boolean;
      type: 'success' | 'error' | 'warning';
      message: string;
      subMessage?: string;
  }>({ opened: false, type: 'success', message: '' });

  // [SAFETY_MODAL_STATE]
  const [safetyModal, setSafetyModal] = useState({
      opened: false,
      level: 'info' as SafetyLevel,
      title: '',
      message: '',
      subMessages: [] as string[],
      pendingQr: ''
  });

  const [historyDateRange, setHistoryDateRange] = useState<[Date | null, Date | null]>([null, null]);

  useEffect(() => {
      setHistoryDateRange([new Date(), new Date()]);
  }, []);

  const [selectedCylinder, setSelectedCylinder] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const handleStatsClose = useModalBackTrap(statsModalOpen, () => setStatsModalOpen(false), 'inspection-stats-modal');

  const [currentSessionScans, setCurrentSessionScans] = useState<Array<{
      type: 'OUT' | 'IN' | 'FAIL';
      gasType: string;
      cylinderId: string; // [NEW] Track ID
      timestamp: string; // [NEW] Track Time
      memo?: string;     // [NEW] Track Memo
      action?: string;   // [NEW] Track Action subclass
  }>>([]);

  const sessionStats = useMemo(() => ({
      OUT: currentSessionScans.filter(s => s.type === 'OUT').length,
      IN: currentSessionScans.filter(s => s.type === 'IN').length,
      FAIL: currentSessionScans.filter(s => s.type === 'FAIL').length,
      byGas: currentSessionScans.reduce((acc, curr) => {
          if (!acc[curr.type]) acc[curr.type] = {};
          acc[curr.type][curr.gasType] = (acc[curr.type][curr.gasType] || 0) + 1;
          return acc;
      }, {} as Record<string, Record<string, number>>)
  }), [currentSessionScans]);

  const userMap = useUserMap();
  const [viewMode, setViewMode] = useState<'ALL' | 'OUT' | 'IN' | 'FAIL'>('ALL');

  const startDateStr = historyDateRange[0] ? dayjs(historyDateRange[0]).format('YYYY-MM-DD') : '';
  const endDateStr = historyDateRange[1] ? dayjs(historyDateRange[1]).format('YYYY-MM-DD') : '';
  const shouldFetch = historyDateRange[0] && historyDateRange[1];

  const { data: swrData, isLoading: swrLoading, mutate: mutateHistory } = useSWR(
      shouldFetch ? `/api/work/inspection/history?startDate=${startDateStr}&endDate=${endDateStr}` : null,
      fetcher,
      {
          refreshInterval: 10000,
          revalidateOnFocus: false,
          keepPreviousData: true,
          fallbackData: { success: true, data: { outbound: [], inbound: [], failure: [] } }
      }
  );

  const serverHistory = useMemo(() => 
      swrData?.success ? swrData.data : { outbound: [], inbound: [], failure: [] }, 
  [swrData]);

  // [FIX] Optimistic UI: Merge Local Session Scans
  const historyData = useMemo(() => {
      // Map local scans to InspectionItem shape
      const localItems = currentSessionScans.map((scan, i) => ({
          id: -1 - i, // Temporary negative ID
          cylinderId: scan.cylinderId,
          gasType: scan.gasType,
          gasColor: 'gray',
          type: scan.action || scan.type,
          action: scan.type,
          timestamp: scan.timestamp,
          workerId: 'WORKER-LOCAL',
          memo: scan.memo || ''
      } as InspectionItem));

      const localOut = localItems.filter(i => i.action === 'OUT');
      const localIn = localItems.filter(i => i.action === 'IN');
      const localFail = localItems.filter(i => i.action === 'FAIL');

      // Filter Server Data (Dedup)
      const localIds = new Set(localItems.map(i => i.cylinderId));
      
      return {
          outbound: [...localOut, ...serverHistory.outbound.filter((h: InspectionItem) => !localIds.has(h.cylinderId))],
          inbound: [...localIn, ...serverHistory.inbound.filter((h: InspectionItem) => !localIds.has(h.cylinderId))],
          failure: [...localFail, ...serverHistory.failure.filter((h: InspectionItem) => !localIds.has(h.cylinderId))]
      };
  }, [serverHistory, currentSessionScans]);
  const historyLoading = swrLoading && !swrData;

  const toggleView = (mode: 'OUT' | 'IN' | 'FAIL') => {
      if (viewMode === mode) setViewMode('ALL');
      else setViewMode(mode);
  };

  // Helper: Gas Color removed

  // Auto-focus logic
  // const focusTrap = useFocusTrap(activeTab === 'outbound'); // Simple trap

  // Helper: Smart Expiry Calculation (Delegated to TransactionValidator)
  // const calculateNextExpiry = ... (Removed, using Central Logic)

  // [VISUAL_FEEDBACK] Hook is used inside component




  const handleScan = async (code: string) => {
       const qr = code.trim();
       if (!qr) return;

       if (activeTab === 'outbound') {
           // [Interceptor Pattern] Safety Check
           try {
               const checkRes = await fetch('/api/work/inspection/check', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ action: 'outbound', qrCode: qr })
               });
               const checkData = await checkRes.json();

               if (checkData.success) {
                   if (checkData.data.safety.level === 'warning') {
                       // Warning (e.g. Full Cylinder) -> Confirm Modal
                       setSafetyModal({
                           opened: true,
                           level: 'warning',
                           title: '확인 필요',
                           message: checkData.message,
                           subMessages: [
                               `용기번호: ${checkData.data.serialNumber}`,
                               `상태: ${checkData.data.status}`
                           ],
                           pendingQr: qr
                       });
                       playWarningSound();
                   } else {
                       // Success -> Proceed
                       executeInspectionAction(qr);
                   }
               } else {
                   // Error -> Blocking Modal
                   setSafetyModal({
                       opened: true,
                       level: 'error',
                       title: '처리 불가',
                       message: checkData.message,
                       subMessages: [
                            `용기번호: ${checkData.data?.serialNumber || qr}`,
                            `사유: ${checkData.message}`
                       ],
                       pendingQr: ''
                   });
                   playErrorSound();
               }
           } catch (e) {
               console.error('Safety Check Failed', e);
               // Fallback: Try execute anyway if check fails network-wise?
               // Or block? "Safety First" -> Block or Warn.
               // Let's Warn.
               setNotification({ opened: true, type: 'error', message: '통신 오류', subMessage: '안전 검증에 실패했습니다.' });
           }
       } else if (activeTab === 'failure') {
          setFailureModalOpen(true);
      } else {
          // 1. Fetch Cylinder Info for Smart Calculation
          try {
              // Reuse charging API to get cylinder info
              const res = await fetch(`/api/work/charging?cylinderId=${qr}`);
              if (!res.ok) throw new Error('Failed to fetch cylinder info');
              const data = await res.json();
              
              if (data.success && data.data?.cylinder) {
                  const cylinder = data.data.cylinder;

                  // [CHECK] If Cylinder is Scrapped
                  if (cylinder.status === '폐기') {
                       playErrorSound();
                       setNotification({ 
                          opened: true, 
                          type: 'error', 
                          message: '폐기된 용기', 
                          subMessage: '이미 폐기 처리된 용기입니다. 입고할 수 없습니다.' 
                      });
                      trigger('error'); // [VISUAL]
                      return;
                  }

                  // [CHECK] If cylinder is NOT at Inspection Agency
                  if (cylinder.currentHolderId !== 'INSPECTION_AGENCY') {
                      
                      // Case 1: Needs Inspection (Never Sent)
                      if (cylinder.status === '검사대상') {
                          playWarningSound();
                          setNotification({ 
                              opened: true, 
                              type: 'warning', 
                              message: '검사 출고 전', 
                              subMessage: '검사 출고 전 용기입니다. 검사 출고를 먼저 진행해주세요.' 
                          });
                          trigger('warning'); // [VISUAL]
                          return;
                      }

                      // Case 2: At Customer (Delivered status)
                      if (cylinder.status === '납품') {
                           playErrorSound();
                           setNotification({ 
                               opened: true, 
                               type: 'error', 
                               message: '위치 오류 (거래처)', 
                               subMessage: `거래처(납품상태)에 있는 용기입니다. 회수 후 진행해주세요.` 
                           });
                           trigger('error'); // [VISUAL]
                           return;
                      }

                      // Case 3: All other valid internal statuses (Empty, Full, Charging, etc.)
                      setNotification({ 
                          opened: true, 
                          type: 'success', 
                          message: '입고 완료된 용기', 
                          subMessage: '해당 용기는 이미 입고 처리가 완료되었습니다.' 
                      });
                      trigger('warning'); // [VISUAL] - Already done
                      return; 
                  }

                  const smartDateStr = TransactionValidator.calculateNextExpiryDate(cylinder);
                  const [y, m] = smartDateStr.split('-').map(Number);
                  // [FIX] User Requirement: Set to Last Day of Month
                  // new Date(y, m, 0) -> Month index `m` is next month, day 0 is previous month's last day.
                  // e.g. Input: 2027-01 (m=1). Date(2027, 1, 0) -> Jan 31, 2027.
                  const smartDate = new Date(y, m, 0); 
                  setNextExpiry(smartDate);
                  
              } else {
                  const today = new Date();
                  const nextYear = new Date(today.setFullYear(today.getFullYear() + 5));
                  setNextExpiry(nextYear);
              }
          } catch {
              const today = new Date();
              const nextYear = new Date(today.setFullYear(today.getFullYear() + 5));
              setNextExpiry(nextYear);
          }
          
          setInboundModalOpen(true);
      }
  };

  useScanner({
      onChange: (code) => {
          handleScan(code);
      }
  });

  const handleCylinderClick = (cylinderId: string) => {
      setSelectedCylinder(cylinderId);
      setHistoryModalOpen(true);
  };


  const processFailure = async (action: 'SCRAP' | 'REINSPECT') => {
      if (action === 'SCRAP' && !failureReason.trim()) {
          await playWarningSound();
          setNotification({ opened: true, type: 'warning', message: '사유 입력 필요', subMessage: '폐기 사유를 입력해주세요.' });
          trigger('warning'); // [VISUAL]
          return;
      }

      try {
        const workerId = getWorkerId(); 

        if (!workerId) {
            playErrorSound();
            setNotification({ opened: true, type: 'error', message: '오류', subMessage: '작업자 정보가 없습니다. 다시 로그인해주세요.' });
            trigger('error'); // [VISUAL]
            return;
        }

        setIsProcessing(true);
        const res = await fetch('/api/work/inspection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                qrCode: scannedQr, 
                action: action, 
                memo: failureReason,
                workerId: workerId
            })
        });
        setIsProcessing(false);

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || `Status: ${res.status}`);

        if (result.success) {
            setFailureModalOpen(false);
            setFailureReason('');
            const newScan = { 
                type: 'FAIL' as const, 
                gasType: result.data?.gasType || '-',
                cylinderId: scannedQr,
                timestamp: new Date().toISOString(),
                memo: failureReason,
                action: action === 'SCRAP' ? '기타출고' : '재검사' // Map action to 'type' field in InspectionItem
            };
            setCurrentSessionScans(prev => [...prev, newScan]);
            setStatsModalOpen(true);
            mutateHistory(); 
            // [NEW] Explicit Modal
            setNotification({ opened: true, type: 'success', message: '처리 완료', subMessage: '불합격 처리가 완료되었습니다.' });
            trigger('success'); 
        } else {
            playErrorSound();
            setNotification({ opened: true, type: 'error', message: '처리 불가', subMessage: result.message });
            setStatsModalOpen(true); 
            trigger('error');
        }
    } catch (e: unknown) {
          setIsProcessing(false);
          const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
          playErrorSound();
          const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('500');
          setNotification({ opened: true, type: 'error', message: isNetworkError ? '통신 오류' : '처리 불가', subMessage: errorMessage });
          trigger('error'); // [VISUAL]
    }
  };

  const executeInspectionAction = async (qr: string, memo?: string) => {
    try {
        const workerId = getWorkerId();
        if (!workerId) {
            playErrorSound();
            setNotification({ opened: true, type: 'error', message: '오류', subMessage: '작업자 정보가 없습니다. 다시 로그인해주세요.' });
            trigger('error');
            return;
        }

        setIsProcessing(true);
        const res = await fetch('/api/work/inspection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                qrCode: qr,
                action: 'OUT',
                workerId: workerId,
                memo: memo // Pass memo (e.g., from safety confirm)
            })
        });
        setIsProcessing(false);

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || `Status: ${res.status}`);

        if (result.success) {
            const newScan = {
                type: 'OUT' as const,
                gasType: result.data?.gasType || '-',
                cylinderId: qr,
                timestamp: new Date().toISOString()
            };
            setCurrentSessionScans(prev => [...prev, newScan]);
            setStatsModalOpen(true);
            mutateHistory();
            setNotification({ opened: true, type: 'success', message: '출고 완료', subMessage: '검사소로 용기 발송이 기록되었습니다.' });
            trigger('success');
        } else {
            playErrorSound();
            setNotification({ opened: true, type: 'error', message: '처리 불가', subMessage: result.message });
            setStatsModalOpen(true);
            trigger('error');
        }
    } catch (e: unknown) {
        setIsProcessing(false);
        const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
        playErrorSound();
        setNotification({ opened: true, type: 'error', message: '통신 오류', subMessage: errorMessage });
        trigger('error');
    }
  };

  const processInbound = async () => {
    if (!nextExpiry) {
        await playWarningSound();
        setNotification({ opened: true, type: 'warning', message: '날짜 미생성', subMessage: '갱신할 만료일을 선택해주세요.' });
        trigger('warning');
        return;
    }

    try {
        const workerId = getWorkerId();
        if (!workerId) {
            playErrorSound();
            setNotification({ opened: true, type: 'error', message: '오류', subMessage: '작업자 정보가 없습니다. 다시 로그인해주세요.' });
            return;
        }

        setIsProcessing(true);
        const res = await fetch('/api/work/inspection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                qrCode: scannedQr,
                action: 'IN',
                nextInspectionDate: dayjs(nextExpiry).format('YYYY-MM-DD'),
                workerId: workerId
            })
        });
        setIsProcessing(false);

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || `Status: ${res.status}`);

        if (result.success) {
            setInboundModalOpen(false);
            const newScan = {
                type: 'IN' as const,
                gasType: result.data?.gasType || '-',
                cylinderId: scannedQr,
                timestamp: new Date().toISOString()
            };
            setCurrentSessionScans(prev => [...prev, newScan]);
            setStatsModalOpen(true);
            mutateHistory();
            setNotification({ opened: true, type: 'success', message: '입고 완료', subMessage: '검사 갱신 및 입고 처리가 완료되었습니다.' });
            trigger('success');
        } else {
            playErrorSound();
            setNotification({ opened: true, type: 'error', message: '처리 불가', subMessage: result.message });
            setStatsModalOpen(true);
            trigger('error');
        }
    } catch (e: unknown) {
        setIsProcessing(false);
        const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
        playErrorSound();
        setNotification({ opened: true, type: 'error', message: '통신 오류', subMessage: errorMessage });
        trigger('error');
    }
  };

 

  return (
    <AppLayout title="검사 입고/출고" themeColor="#FD7E14">
     <PageTransition>
            {isProcessing && (
                <Box pos="fixed" top={0} left={0} w="100%" h="100%" style={{ zIndex: 2000 }}>
                    <LoadingOverlay 
                        visible={true} 
                        overlayProps={{ radius: "sm", blur: 2, backgroundOpacity: 0.5 }} 
                        loaderProps={{ children: <Text fw={700} c="orange">처리 중...</Text> }}
                    />
                </Box>
            )}
      <EdgeLighting 
            active={feedbackActive} 
            color={
                feedbackType === 'success' ? '#40C057' : // Green
                feedbackType === 'warning' ? '#FAB005' : // Yellow
                '#FA5252' // Red (Error)
            } 
      />
      <CentralNotification {...notification} onClose={() => setNotification({ ...notification, opened: false })} />
      <QRScannerModal opened={scannerOpened} onClose={() => setScannerOpened(false)} onScan={(code) => { setScannerOpened(false); handleScan(code); }} />

      <Stack>
        <StaggerContainer>
        <GlassCard p="md" variant="active">
            <Tabs value={activeTab} onChange={setActiveTab} variant="pills" color="orange" radius="md">
                <Tabs.List grow mb="lg">
                    <Tabs.Tab value="outbound" style={{ fontSize: '1.1rem', padding: '15px', border: '2px solid #fd7e14', marginRight: '5px' }}>
                        검사 출고 (보내기)
                    </Tabs.Tab>
                    <Tabs.Tab value="inbound" style={{ fontSize: '1.1rem', padding: '15px', border: '2px solid #2f9e44', marginRight: '5px' }}>
                        검사 입고 (받기/갱신)
                    </Tabs.Tab>
                     <Tabs.Tab value="failure" color="red" style={{ fontSize: '1.1rem', padding: '15px', border: '2px solid #fa5252' }}>
                        검사 불합격 (폐기/재검)
                    </Tabs.Tab>
                </Tabs.List>

                <Stack align="center" gap="lg" py={20}>
                     
                     <Text size="lg" fw={700} c="white">
                        {activeTab === 'outbound' ? '검사소로 보낼 용기를 스캔하세요' : 
                         activeTab === 'inbound' ? '검사 완료된 용기를 스캔하세요' :
                         '불합격 판정된 용기를 스캔하세요'}
                     </Text>

                     <Button 
                        size="lg" 
                        color={activeTab === 'outbound' ? 'orange' : activeTab === 'inbound' ? 'green' : 'red'}
                        leftSection={<IconScan size={24} />}
                        onClick={() => setScannerOpened(true)}
                        radius="xl"
                        styles={{ root: { boxShadow: `0 0 20px ${activeTab === 'outbound' ? 'rgba(253, 126, 20, 0.4)' : activeTab === 'inbound' ? 'rgba(47, 158, 68, 0.4)' : 'rgba(250, 82, 82, 0.4)'}` } }}
                    >
                        카메라 스캔 시작
                     </Button>

                     <Text c="dimmed" size="sm">또는</Text>

                     <Group w="100%" maw={400}>
                        <TextInput 
                            placeholder="용기 일련번호 직접 입력"
                            value={scannedQr}
                            onChange={(e) => setScannedQr(e.currentTarget.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && scannedQr.trim()) {
                                    handleScan(scannedQr.trim());
                                }
                            }}
                            style={{ flex: 1 }}
                            size="lg"
                            styles={{ input: { backgroundColor: '#25262B', color: 'white', border: '1px solid #373A40', fontSize: '16px' } }}
                        />
                        <Button 
                            size="lg" 
                            color="gray" 
                            onClick={() => {
                                if (scannedQr.trim()) handleScan(scannedQr.trim());
                            }}
                        >
                            입력
                        </Button>
                     </Group>
                </Stack>
            </Tabs>
        </GlassCard>
        </StaggerContainer>
      </Stack>

      {/* [REFACTOR] Shared Session Stats Modal - Rendered First in DOM */}
      <WorkSessionStatsModal 
        opened={statsModalOpen}
        onClose={handleStatsClose}
        totalCount={sessionStats.OUT + sessionStats.IN + sessionStats.FAIL}
        sections={[
            { 
                key: 'outbound', 
                label: '검사 출고', 
                color: 'orange', 
                count: sessionStats.OUT,
                items: sessionStats.byGas['OUT'] || {}
            },
            { 
                key: 'inbound', 
                label: '검사 입고', 
                color: 'green', 
                count: sessionStats.IN,
                items: sessionStats.byGas['IN'] || {}
            },
            { 
                key: 'failure', 
                label: '검사 불합격', 
                color: 'red', 
                count: sessionStats.FAIL,
                items: sessionStats.byGas['FAIL'] || {}
            }
        ]}
      />

      {/* [CRITICAL] Notification must be conditionally rendered AND placed last to ensuring top stacking */}
      {notification.opened && (
          <CentralNotification 
              opened={notification.opened}
              type={notification.type}
              message={notification.message}
              subMessage={notification.subMessage}
              onClose={() => setNotification(prev => ({ ...prev, opened: false }))}
          />
      )}

      {/* Safety Modal (Replacing simple notification for critical checks) */}
      <SafetyConfirmModal 
            opened={safetyModal.opened}
            level={safetyModal.level}
            title={safetyModal.title}
            message={safetyModal.message}
            subMessages={safetyModal.subMessages}
            confirmLabel="예"
            cancelLabel="아니요"
            onClose={() => setSafetyModal(prev => ({ ...prev, opened: false }))}
            onConfirm={() => {
                if (safetyModal.pendingQr) {
                    executeInspectionAction(safetyModal.pendingQr, '잔가스 확인 및 제거됨');
                }
            }}
            isBlocking={safetyModal.level === 'error'}
      />

      {/* History Section */}
      <Paper mt="xl" p="md" withBorder style={{ backgroundColor: '#1A1B1E', borderColor: '#2C2E33' }}>
        <Group justify="space-between" mb="md">
            <Group gap="xs">
                <Text size="lg" fw={700} c="white">일일 검사 현황</Text>
                <Badge size="lg" variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
                    {dayjs().format('YYYY.MM.DD')}
                </Badge>
            </Group>
            
            <Group>
                 <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                    <Group gap={5}>
                        <DateInput
                            value={historyDateRange[0]}
                            onChange={(d) => setHistoryDateRange([d as Date | null, historyDateRange[1]])}
                            placeholder="시작일"
                            w={130} // [Mobile]
                            size="sm" // [Mobile]
                            valueFormat="YYYY. MM. DD."
                            inputMode="none"
                            popoverProps={{ withinPortal: true, position: 'bottom-start', middlewares: { flip: true, shift: true } }}
                            styles={{ input: { backgroundColor: '#1A1B1E', border: '1px solid #373A40', color: 'white', fontSize: '14px', textAlign: 'center', caretColor: 'transparent', height: '36px' }}}
                        />
                        <Text c="dimmed">~</Text>
                        <DateInput
                            value={historyDateRange[1]}
                            onChange={(d) => setHistoryDateRange([historyDateRange[0], d as Date | null])}
                            placeholder="종료일"
                            w={130} // [Mobile]
                            size="sm" // [Mobile]
                            valueFormat="YYYY. MM. DD."
                            inputMode="none"
                            popoverProps={{ withinPortal: true, position: 'bottom-start', middlewares: { flip: true, shift: true } }}
                            styles={{ input: { backgroundColor: '#1A1B1E', border: '1px solid #373A40', color: 'white', fontSize: '14px', textAlign: 'center', caretColor: 'transparent', height: '36px' }}}
                        />
                    </Group>
                 </DatesProvider>
                 <Button.Group>
                    <Button 
                        variant={viewMode === 'OUT' ? 'gradient' : 'default'} 
                        gradient={{ from: 'orange', to: 'red' }}
                        onClick={() => toggleView('OUT')}
                        size="sm"
                    >
                        출고만 보기
                    </Button>
                    <Button 
                         variant={viewMode === 'IN' ? 'gradient' : 'default'} 
                         gradient={{ from: 'blue', to: 'cyan' }}
                         onClick={() => toggleView('IN')}
                         size="sm"
                    >
                        입고만 보기
                    </Button>
                    <Button 
                         variant={viewMode === 'FAIL' ? 'gradient' : 'default'} 
                         gradient={{ from: 'red', to: 'orange' }}
                         onClick={() => toggleView('FAIL')}
                         size="sm"
                    >
                        불합격 보기
                    </Button>
                 </Button.Group>
            </Group>
        </Group>

        <Box pos="relative" mih={200}>
            <LoadingOverlay visible={historyLoading} zIndex={10} overlayProps={{ radius: "sm", blur: 2 }} />
            
            <Grid gutter="xl">
                {/* Outbound List */}
                {(viewMode === 'ALL' || viewMode === 'OUT') && (
                    <Grid.Col span={viewMode === 'OUT' ? 12 : 6}>
                         <Card withBorder bg="#25262B" p={0} style={{ borderColor: '#e8590c' }}>
                            <Group justify="space-between" bg="rgba(232, 89, 12, 0.15)" p="sm" style={{ borderBottom: '1px solid #e8590c' }}>
                                <Text fw={700} c="orange.3">
                                    검사 출고 ({historyData.outbound.length})
                                    <Text span size="sm" c="dimmed" ml="sm" fw={500}>(회사 → 검사소)</Text>
                                </Text>
                                <IconArrowRight size={18} color="orange" />
                            </Group>
                            <ScrollArea h={400}>
                                <Table verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th c="dimmed" visibleFrom="xs">날짜</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">용기번호</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">가스</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">작업자</Table.Th>
                                            <Table.Th c="dimmed" hiddenFrom="xs">검사 이력(출고)</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {historyData.outbound.length === 0 ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={4} align="center" c="dimmed" py="xl">내역 없음</Table.Td>
                                            </Table.Tr>
                                        ) : (
                                            historyData.outbound.map((item: InspectionItem) => (
                                                <Fragment key={item.id}>
                                                    {/* Desktop View */}
                                                    <Table.Tr visibleFrom="xs">
                                                        <Table.Td c="white">{dayjs(item.timestamp).format('YYYY. MM. DD.')}</Table.Td>
                                                        <Table.Td>
                                                            <Text fw={500} c="blue.3" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleCylinderClick(item.cylinderId)}>
                                                                {item.cylinderId}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" />
                                                        </Table.Td>
                                                        <Table.Td c="dimmed" fz="sm">
                                                            {userMap[item.workerId] || (item.workerId === 'admin' ? '관리자' : item.workerId)}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                    {/* Mobile View */}
                                                    <Table.Tr hiddenFrom="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <Table.Td p="sm">
                                                            <Group justify="space-between" mb={4}>
                                                                <Text c="dimmed" size="xs">{dayjs(item.timestamp).format('YYYY. MM. DD.')}</Text>
                                                                <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" size="sm" />
                                                            </Group>
                                                            <Group justify="space-between" align="center">
                                                                <Text fw={500} c="blue.3" size="md" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleCylinderClick(item.cylinderId)}>
                                                                    {item.cylinderId}
                                                                </Text>
                                                                <Text c="dimmed" size="sm">
                                                                    {userMap[item.workerId] || (item.workerId === 'admin' ? '관리자' : item.workerId)}
                                                                </Text>
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                </Fragment>
                                            ))
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                         </Card>
                    </Grid.Col>
                )}

                {/* Inbound List */}
                {(viewMode === 'ALL' || viewMode === 'IN') && (
                    <Grid.Col span={viewMode === 'IN' ? 12 : 6}>
                         <Card withBorder bg="#25262B" p={0} style={{ borderColor: '#1c7ed6' }}>
                            <Group justify="space-between" bg="rgba(28, 126, 214, 0.15)" p="sm" style={{ borderBottom: '1px solid #1c7ed6' }}>
                                <Text fw={700} c="blue.3">
                                    검사 입고 ({historyData.inbound.length})
                                    <Text span size="sm" c="dimmed" ml="sm" fw={500}>(검사소 → 회사)</Text>
                                </Text>
                                <IconCheck size={18} color="#1c7ed6" />
                            </Group>
                            <ScrollArea h={400}>
                                <Table verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th c="dimmed" visibleFrom="xs">날짜</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">용기번호</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">가스</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">메모</Table.Th>
                                            <Table.Th c="dimmed" hiddenFrom="xs">검사 이력(입고)</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {historyData.inbound.length === 0 ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={4} align="center" c="dimmed" py="xl">내역 없음</Table.Td>
                                            </Table.Tr>
                                        ) : (
                                            historyData.inbound.map((item: InspectionItem) => (
                                                <Fragment key={item.id}>
                                                    {/* Desktop View */}
                                                    <Table.Tr visibleFrom="xs">
                                                        <Table.Td c="white" fz="sm" style={{ whiteSpace: 'nowrap' }}>{dayjs(item.timestamp).format('YYYY. MM. DD.')}</Table.Td>
                                                        <Table.Td>
                                                            <Text fw={500} c="blue.3" size="sm" style={{ cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }} onClick={() => handleCylinderClick(item.cylinderId)}>
                                                                {item.cylinderId}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" />
                                                        </Table.Td>
                                                        <Table.Td c="dimmed" fz="xs" style={{ maxWidth: '120px' }}>
                                                            <Text truncate size="xs">{item.memo}</Text>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                    {/* Mobile View */}
                                                    <Table.Tr hiddenFrom="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <Table.Td p="sm">
                                                            <Group justify="space-between" mb={4}>
                                                                <Text c="dimmed" size="xs">{dayjs(item.timestamp).format('YYYY. MM. DD.')}</Text>
                                                                <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" size="sm" />
                                                            </Group>
                                                            <Group justify="space-between" align="center">
                                                                <Text fw={500} c="blue.3" size="md" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleCylinderClick(item.cylinderId)}>
                                                                    {item.cylinderId}
                                                                </Text>
                                                                <Text c="dimmed" size="sm" style={{ flex: 1, textAlign: 'right', minWidth: 0 }} truncate="end">
                                                                    {item.memo}
                                                                </Text>
                                                            </Group>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                </Fragment>
                                            ))
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                         </Card>
                    </Grid.Col>
                )}
            </Grid>
            
            {/* Failure List (Full Width or standard based on viewMode) */}
            {(viewMode === 'ALL' || viewMode === 'FAIL') && (
                <Grid mt="xl">
                    <Grid.Col span={12}>
                         <Card withBorder bg="#25262B" p={0} style={{ borderColor: '#fa5252' }}>
                            <Group justify="space-between" bg="rgba(250, 82, 82, 0.15)" p="sm" style={{ borderBottom: '1px solid #fa5252' }}>
                                <Text fw={700} c="red.3">
                                    검사 불합격 ({historyData.failure.length})
                                    <Text span size="sm" c="dimmed" ml="sm" fw={500}>(폐기 / 재검사)</Text>
                                </Text>
                                <IconAlertTriangle size={18} color="#fa5252" />
                            </Group>
                            <ScrollArea h={300}>
                                <Table verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th c="dimmed" visibleFrom="xs">날짜</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">용기번호</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">가스</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">유형</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">사유(메모)</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">작업자</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {historyData.failure.length === 0 ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={6} align="center" c="dimmed" py="xl">내역 없음</Table.Td>
                                            </Table.Tr>
                                        ) : (
                                            historyData.failure.map((item: InspectionItem) => (
                                                <Fragment key={item.id}>
                                                    {/* Desktop View */}
                                                    <Table.Tr visibleFrom="xs">
                                                        <Table.Td c="white">{dayjs(item.timestamp).format('YYYY. MM. DD.')}</Table.Td>
                                                        <Table.Td>
                                                            <Text fw={500} c="blue.3" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleCylinderClick(item.cylinderId)}>
                                                                {item.cylinderId}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" />
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Badge color={item.type === '기타출고' ? 'red' : 'orange'} variant="light">
                                                                {item.type === '기타출고' ? '폐기' : '재검사'}
                                                            </Badge>
                                                        </Table.Td>
                                                        <Table.Td c="dimmed" fz="sm">
                                                            {item.memo ? item.memo.replace('검사 불합격으로 인한 폐기: ', '').replace('검사 불합격(재검요망): ', '') : '-'}
                                                        </Table.Td>
                                                        <Table.Td c="dimmed" fz="sm">
                                                            {userMap[item.workerId] || (item.workerId === 'admin' ? '관리자' : item.workerId)}
                                                        </Table.Td>
                                                    </Table.Tr>
                                                    {/* Mobile View */}
                                                    <Table.Tr hiddenFrom="xs" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <Table.Td p="sm">
                                                            <Group justify="space-between" mb={4}>
                                                                <Text c="dimmed" size="xs">{dayjs(item.timestamp).format('YYYY. MM. DD.')}</Text>
                                                                <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" size="sm" />
                                                            </Group>
                                                            <Group justify="space-between" align="center" mb={6}>
                                                                <Text fw={500} c="blue.3" size="md" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleCylinderClick(item.cylinderId)}>
                                                                    {item.cylinderId}
                                                                </Text>
                                                                <Badge color={item.type === '기타출고' ? 'red' : 'orange'} size="sm" variant="light">
                                                                    {item.type === '기타출고' ? '폐기' : '재검사'}
                                                                </Badge>
                                                            </Group>
                                                            <Text c="white" size="sm" bg="rgba(255,255,255,0.05)" p="xs" style={{ borderRadius: '4px' }}>
                                                                {item.memo ? item.memo.replace('검사 불합격으로 인한 폐기: ', '').replace('검사 불합격(재검요망): ', '') : '-'}
                                                            </Text>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                </Fragment>
                                            ))
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                         </Card>
                    </Grid.Col>
                </Grid>
            )}

        </Box>
      </Paper>

      {/* Inbound Date Modal */}
      <Modal 
        opened={inboundModalOpen} 
        onClose={handleInboundClose} 
        title="📅 차기 검사 만료일 설정" 
        centered
        styles={{ 
            content: { backgroundColor: '#1A1B1E', color: 'white' }, 
            header: { backgroundColor: '#1A1B1E', color: 'white' }
        }}
        
        >
          <Stack>
            <Text size="sm" c="dimmed">{scannedQr} 용기의 갱신할 만료일을 입력하세요.</Text>
            <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                <DateInput
                    value={nextExpiry}
                    onChange={(date) => setNextExpiry(date as Date | null)}
                    label="검사 만료일"
                    placeholder="날짜 선택"
                    size="md"
                    valueFormat="YYYY. MM. DD."
                    popoverProps={{ withinPortal: true, position: 'bottom-start' }}
                    inputMode="none"
                    styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }}
                />
            </DatesProvider>
            <Button fullWidth color="green" size="lg" onClick={processInbound}>
                갱신 및 입고 처리
            </Button>
          </Stack>
      </Modal>

      {/* Cylinder History Modal */}
      <CylinderHistoryModal 
        opened={historyModalOpen} 
        onClose={() => setHistoryModalOpen(false)} 
        cylinderId={selectedCylinder} 
      />


      {/* Failure Processing Modal */}
      <Modal 
        opened={failureModalOpen} 
        onClose={handleFailureClose} 
        title="⚠️ 검사 불합격 용기 처리" 
        centered
        styles={{ 
            content: { backgroundColor: '#1A1B1E', color: 'white' }, 
            header: { backgroundColor: '#1A1B1E', color: 'white' }
        }}
        
        >
          <Stack>
            <Text size="sm" c="dimmed">{scannedQr} 용기의 처리 방식을 선택하세요.</Text>
            
            <Textarea
                label="처리 사유 (메모)"
                placeholder="예: 밸브 파손, 용기 부식 심함 등"
                minRows={3}
                value={failureReason}
                onChange={(e) => setFailureReason(e.currentTarget.value)}
                styles={{ input: { backgroundColor: '#2C2E33', color: 'white', border: '1px solid #373A40' } }}
            />

            <Group grow>
                <Button 
                    color="red" 
                    size="lg" 
                    onClick={() => processFailure('SCRAP')}
                    leftSection={<IconX size={20} />}
                >
                    폐기 (SCRAP)
                </Button>
                <Button 
                    color="orange" 
                    size="lg" 
                    onClick={() => processFailure('REINSPECT')}
                    leftSection={<IconAnalyze size={20} />}
                >
                    재검사 (RE-INSPECT)
                </Button>
            </Group>
            
            <Text size="xs" c="dimmed" ta="center">
                * 폐기 시 해당 용기는 영구적으로 사용 불가 처리됩니다.<br/>
                * 재검사 시 &apos;불량&apos; 상태로 변경되며 수리 후 재검사를 진행할 수 있습니다.
            </Text>
          </Stack>
      </Modal>

      </PageTransition>
    </AppLayout>
  );
}
