'use client';

import useSWR from 'swr';

import { AppLayout } from '@/components/Layout/AppLayout';
import { Paper, Text, ScrollArea, Badge, Flex, Button, Group, SimpleGrid, Box, Modal, Loader, Stack, Card, ActionIcon, Table, ThemeIcon, TextInput, LoadingOverlay } from '@mantine/core';
import { GasBadge } from '@/components/Common/GasBadge';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IconCamera, IconRefresh, IconBuildingSkyscraper, IconCalendar, IconX, IconAlertTriangle, IconKeyboard } from '@tabler/icons-react';

import dynamic from 'next/dynamic';
const QRScannerModal = dynamic(
  () => import('@/components/Common/QRScannerModal').then(mod => mod.QRScannerModal),
  { ssr: false }
);
import { PartnerSearchModal } from '@/components/Common/PartnerSearchModal';
import { CentralNotification } from '@/components/Common/CentralNotification';
import { useDisclosure } from '@mantine/hooks';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { Customer } from '@/lib/types';
import { DateInput, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/ko';
import dayjs from 'dayjs';
import { useScanner } from '@/app/hooks/useScanner';
import { DailyTransactionLedgerModal } from '@/components/History/DailyTransactionLedgerModal';
import { playSuccessSound, playErrorSound, playWarningSound, speak } from '@/app/utils/feedback';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { useUserMap } from '@/app/hooks/useUserMap';
import { getWorkerId } from '@/app/utils/authUtils';
import { resolveShortHolderName } from '@/app/utils/display';
import { WorkSessionStatsModal } from '@/components/Work/WorkSessionStatsModal';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';
import { SafetyConfirmModal, SafetyLevel } from '@/components/Common/SafetyConfirmModal';

import { StaggerContainer } from '@/components/UI/StaggerContainer';
import { EdgeLighting } from '@/components/UI/EdgeLighting'; // [NEW] Edge Lighting
import { useVisualFeedbackStore } from '@/store/visualFeedbackStore';



interface DeliveryRecord {
    id: string;
    customer: string;
    gas: string;
    gasColor?: string;
    type: '납품' | '회수';
    date: string;
    cylinderId: string;
    worker: string;
    memo?: string; // New field
    containerType?: string;
}

// [NEW] API Response Type for Scan
// [NEW] API Response Type for Scan
interface DeliveryScanData {
    id: string;
    // Customer fields
    name?: string;
    // Cylinder fields
    gasType?: string;
    status?: string;
    serialNumber?: string;
    containerType?: string;
    owner?: string;
    chargingExpiryDate?: string;
}

interface DeliveryScanResponse {
    success: boolean;
    message?: string;
    code?: string;
    data?: DeliveryScanData; // [FIX] Typed Data
    // Specific fields used in handlers
    currentHolderId?: string;
    currentHolder?: string;
    entityType?: 'CUSTOMER' | 'CYLINDER';
    action?: string;
    status?: string; // Sometimes at top level
}

type WorkMode = 'DELIVERY' | 'COLLECTION_EMPTY' | 'COLLECTION_FULL';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DeliveryPage() {
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>('DELIVERY');
  const { trigger, isActive: feedbackActive, type: feedbackType, message: feedbackMessage, subMessage: feedbackSubMessage } = useVisualFeedbackStore(); // [VISUAL_FEEDBACK_HOOK]

  // [State] Central Notification
  const [notification, setNotification] = useState<{
      opened: boolean;
      type: 'success' | 'error' | 'warning' | 'info';
      message: string;
      subMessage: string | undefined;
  }>({
      opened: false,
      type: 'info',
      message: '',
      subMessage: undefined
  });
  
  // [Action Color Map]
  const ACTION_COLORS = {
      납품: '#339AF0',      // Blue
      회수_EMPTY: '#40C057', // Green
      회수_FULL: '#FA5252',  // Red
      회수: '#40C057'     // Default (Green)
  };

  const [scannerOpened, setScannerOpened] = useState(false);
  const [partnerModalOpened, setPartnerModalOpened] = useState(false);
  const userMap = useUserMap();
  
  // Force Confirm State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const handleConfirmClose = useModalBackTrap(confirmOpen, () => setConfirmOpen(false), 'delivery-confirm-modal');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingQr, setPendingQr] = useState('');
  
  // [SESSION_MODE] Work Session State
  const [sessionCustomer, setSessionCustomer] = useState<Customer | null>(null);
  // [SESSION_PERSISTENCE] Loading Flag
  const [isLoaded, setIsLoaded] = useState(false);

  // History Modal State

  // History Modal State
  const [historyModalOpen, { open: openHistory, close: closeHistory }] = useDisclosure(false);
  const [ledgerModalOpen, { open: openLedger, close: closeLedger }] = useDisclosure(false); // Ledger State
  const [selectedCylinderId, setSelectedCylinderId] = useState<string | null>(null);

  // [MANUAL INPUT] PC Support
  const [manualInputOpened, setManualInputOpened] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // [NEW] Loading State


  // History Date Range - Default to Today (Set in useEffect to avoid Hydration Mismatch)
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // [SAFETY_MODAL_STATE]
  const [safetyModal, setSafetyModal] = useState({
      opened: false,
      level: 'info' as SafetyLevel,
      title: '',
      message: '',
      subMessages: [] as string[],
      pendingQr: ''
  });

  useEffect(() => {
      setDateRange([new Date(), new Date()]);
  }, []);

  // [NEW] Session Statistics Modal
  const [statsModalOpen, { open: openStatsModal, close: closeStatsModal }] = useDisclosure(false);
  const handleStatsClose = useModalBackTrap(statsModalOpen, closeStatsModal, 'delivery-stats-modal');
  
  // [NEW] Current Session Tracking - 현재 작업 세션만 추적
  const [currentSessionScans, setCurrentSessionScans] = useState<Array<{
    gasType: string;
    action: '납품' | '회수';
    serialNumber?: string; // [New] For Deduplication
    containerType?: string;
    memo?: string; // [New] For Status ('실병', '공병' etc)
  }>>([]);

  const handleHistoryClick = (id: string) => {
      setSelectedCylinderId(id);
      openHistory();
  };







  const startDateStr = dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
  const endDateStr = dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : startDateStr;
  
  const queryParams = new URLSearchParams();
  if (currentCustomer) queryParams.append('customerId', currentCustomer.id);
  queryParams.append('startDate', startDateStr);
  queryParams.append('endDate', endDateStr);

  const { data: swrData, mutate: mutateHistory } = useSWR(
      `/api/work/delivery?${queryParams.toString()}`,
      fetcher,
      {
          refreshInterval: 0,
          revalidateOnFocus: false,
          keepPreviousData: true,
          fallbackData: { success: true, data: [] }
      }
  );

  // [REFACTOR] Renamed for clarity - SWR Data
  const serverHistory: DeliveryRecord[] = useMemo(() => 
      swrData?.success ? swrData.data : [], 
  [swrData]);

  // [FIX] Optimistic UI: Merge Local Session Scans
  // Need to map Local Scan (Simplified) to Full Record (DeliveryRecord)
  const history = useMemo(() => {
      // Map local scans to DeliveryRecord shape
      const localRecords = currentSessionScans.map((scan, i) => ({
          id: `temp-${Date.now()}-${i}`,
          date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          cylinderId: scan.serialNumber || 'UNKNOWN',
          gas: scan.gasType,
          gasColor: 'gray', // Helper needed or accept default
          type: scan.action, // Now '납품' or '회수' matches exact types
          
          memo: scan.memo === '실병' ? 'COLLECTION_FULL' : 'COLLECTION_EMPTY',
          
          // Manual Type Mapping for Display (to avoid 'any')
          customer: sessionCustomer || { id: 'unknown', name: 'Unknown', buisnessNumber: '', address: '', owner: '' }, 
          worker: 'WORKER-LOCAL', 
          containerType: scan.containerType
      }));
      
      // Filter Server History to avoid duplicates
      const localIds = new Set(localRecords.map(r => r.cylinderId));
      const filteredServer = serverHistory.filter(h => !localIds.has(h.cylinderId));
      
      return [...localRecords, ...filteredServer];

  }, [serverHistory, currentSessionScans, sessionCustomer]);

  // [NEW] Session Statistics - 현재 작업 세션의 납품/회수 통계
  const sessionStats = useMemo(() => {
    if (!sessionCustomer) return null;

    const stats = {
      납품: {} as Record<string, number>,
      회수공병: {} as Record<string, number>,
      회수실병: {} as Record<string, number>
    };

    // 현재 세션에서 스캔한 데이터만 집계
    currentSessionScans.forEach(scan => {
      const { gasType, action, containerType, memo } = scan;
      
      const type = containerType || 'CYLINDER';
      const key = `${gasType}:${type}`;
      
      let statAciton: '납품' | '회수공병' | '회수실병' = '납품';
      if (action === '납품') statAciton = '납품';
      else statAciton = memo === '실병' ? '회수실병' : '회수공병';

      stats[statAciton][key] = (stats[statAciton][key] || 0) + 1;
    });

    return stats;
  }, [currentSessionScans, sessionCustomer]);

  // 거래처 변경 시 세션 초기화
  useEffect(() => {
    setCurrentSessionScans([]);
  }, [sessionCustomer]);





  // [SESSION_PERSISTENCE] Load State on Mount
  useEffect(() => {
      if (typeof window === 'undefined') return;
      
      const timer = setTimeout(() => {
        try {
            const savedSession = localStorage.getItem('SAMDUK_DELIVERY_SESSION');
            const savedCurrent = localStorage.getItem('SAMDUK_DELIVERY_CURRENT');
            const savedMode = localStorage.getItem('SAMDUK_DELIVERY_MODE');

            if (savedSession) {
                const session = JSON.parse(savedSession);
                setSessionCustomer(session);
                // Silent session recovery - user can see active session bar below
            }
            if (savedCurrent) setCurrentCustomer(JSON.parse(savedCurrent));
            if (savedMode) setWorkMode(savedMode as WorkMode);
        } catch (e) {
            console.warn("Failed to load session", e);
        } finally {
            setIsLoaded(true);
        }
      }, 0);

      return () => clearTimeout(timer);
  }, []);

  // [SESSION_PERSISTENCE] Save State on Change
  useEffect(() => {
      if (typeof window === 'undefined') return;
      if (!isLoaded) return; // Prevent overwriting before load
      if (sessionCustomer) {
          localStorage.setItem('SAMDUK_DELIVERY_SESSION', JSON.stringify(sessionCustomer));
      } else {
          localStorage.removeItem('SAMDUK_DELIVERY_SESSION');
      }
  }, [sessionCustomer, isLoaded]);

  useEffect(() => {
      if (typeof window === 'undefined') return;
      if (!isLoaded) return; // Prevent overwriting before load
      if (currentCustomer) {
          localStorage.setItem('SAMDUK_DELIVERY_CURRENT', JSON.stringify(currentCustomer));
      } else {
          localStorage.removeItem('SAMDUK_DELIVERY_CURRENT');
      }
  }, [currentCustomer, isLoaded]);

  useEffect(() => {
      if (typeof window === 'undefined') return;
      if (!isLoaded) return;
      localStorage.setItem('SAMDUK_DELIVERY_MODE', workMode);
  }, [workMode, isLoaded]);


  
  // [VISUAL_FEEDBACK] Hook is used inside component
  
  // [VISUAL_FEEDBACK] Hook is used inside component
  
  // [PERFORMANCE] Recent Scan Cache (Debounce Duplicates, Allow Parallel Different)
  // Store processed QRs with timestamp to ignore duplicates within 2 seconds
  const recentScans = useRef<Map<string, number>>(new Map());

  // [Helper] Client-Side QR Cleaning (Optimization)
  const cleanQrCode = (raw: string) => {
      if (!raw) return '';
      // 1. Strip URL
      let clean = raw.replace(/^https?:\/\/[^\/]+\/(cylinders\/?|auth\/login\?token=|customers\/)?/i, '');
      // [FIX] Robust Slash Cleanup (Handle relative paths or leftover slashes)
      clean = clean.replace(/^\//, '');
      
      // 2. Strip Prefixes (Aggressive)
      clean = clean.replace(/^(cust|sdg|cyl|user|worker|business)[:\-_]*/gi, '');
      clean = clean.replace(/^(st|u|s|w|c)[:\-_]+/gi, '');
      return clean.trim();
  };

  // [REUSABLE] Cylinder Success/Error Handlers
  const handleCylinderSuccess = (result: DeliveryScanResponse) => {
      // [NEW] Show Warning for Expiry Countdown (Soft Success)
      if (result.message && result.message.includes('[주의]')) {
           playWarningSound();
           trigger('warning', '충전기한 임박', result.message);
      } else {
          // [MOBILE AUDIO] Success sound
          playSuccessSound(); 
          const displaySerial = result.data?.serialNumber || '용기';
          trigger('success', '처리 완료', `${displaySerial} (${workMode === 'DELIVERY' ? '납품' : '회수'})`);
      }

      if (confirmOpen) setConfirmOpen(false);

      // [PERFORMANCE] Optimistic Update Logic Here if needed
      mutateHistory(); 
      
      // Track in current session
      if (sessionCustomer) {
          const isFull = result.data?.status === '실병' || result.data?.status === 'FULL' || result.status === 'FULL';
          const actionType = workMode === 'DELIVERY' ? '납품' : '회수';
          
          const newScan = {
            gasType: result.data?.gasType || '-',
            action: actionType as '납품' | '회수',
            serialNumber: result.data?.serialNumber || result.data?.id, // Use Serial if available
            containerType: result.data?.containerType,
            memo: isFull ? '실병' : '공병' // Render logic checks for '실병' in memo
          };
          
          setCurrentSessionScans(prev => {
               const exists = prev.some(s => s.serialNumber === newScan.serialNumber && s.action === newScan.action);
               if (exists) return prev;
               return [...prev, newScan];
          });
      }
      
      // [CONTINUOUS_SCAN] Ensure Modal is Open (Only if Scanner is CLOSED)
      if (!statsModalOpen && !scannerOpened) openStatsModal();
  };

  const handleCylinderError = (result: DeliveryScanResponse, cleanQr: string) => {
      // [CONTINUOUS_SCAN] Handling Errors without Blocking (Soft Errors)
      if (result.code === 'ALREADY_DELIVERED' || result.code === 'ALREADY_COLLECTED') {
          playWarningSound();
          
          if (result.code === 'ALREADY_DELIVERED') speak('이미 납품된 용기입니다');
          else speak('이미 회수된 용기입니다');
          
          // [UX Fix] Verify Customer Name Match for Clarity
          const isSameCustomer = currentCustomer && result.currentHolderId === currentCustomer.id;
          const title = isSameCustomer ? '중복 스캔' : '타 거래처 납품 건';
          const msg = isSameCustomer 
              ? '이미 해당 거래처에 납품된 용기입니다.' 
              : `다른 거래처(${result.currentHolder || '미확인'})에 납품되어 있습니다.`;

          trigger('warning', title, msg);
          return;
      }

      if (result.code === 'LOCATION_MISMATCH' || result.code === 'STATUS_MISMATCH' || result.code === 'IS_CHARGING') {
          // [FORCE_CONFIRM] Open blocking modal for these cases
          playWarningSound();
          
          if (result.code === 'LOCATION_MISMATCH') speak('위치가 다릅니다');
          else speak('확인이 필요합니다');
          if (result.code === 'STATUS_MISMATCH') speak('상태가 다릅니다');

          setPendingQr(cleanQr);
          setConfirmMessage(result.message || '');
          setConfirmOpen(true);
          return;
      } 
      
      if (result.message && !result.message.includes('중복')) {
          trigger('error', '오류', result.message);
      }

      playErrorSound();
      trigger('error', '오류', result.message || '알 수 없는 오류가 발생했습니다.');
      
      if (!statsModalOpen && !scannerOpened && sessionCustomer) {
          openStatsModal();
      }
  };

   const processScan = async (qr: string, force: boolean = false) => {
        if (!qr) return;
        
        // [OPTIMIZATION] Clean locally
        const cleanQr = cleanQrCode(qr);
        const now = Date.now();

        // [PERFORMANCE] Check Dupes (Debounce 1.5s)
        const lastScanTime = recentScans.current.get(cleanQr);
        if (lastScanTime && (now - lastScanTime < 1500)) {
            return; 
        }
        recentScans.current.set(cleanQr, now);

        if (!workMode) { 
            playWarningSound(); 
            trigger('warning', '작업 모드 미선택', '상단에서 작업 버튼을 먼저 눌러주세요.');
            recentScans.current.delete(cleanQr); 
            return;
        }

        const workerId = getWorkerId();
        if (!workerId) {
             trigger('error', '오류', '작업자 정보가 없습니다. 다시 로그인해주세요.');
             return;
        }

        // 0. Manual Deduplication (Immediate Visual Response)
        if (currentSessionScans.some(s => s.serialNumber?.toLowerCase() === cleanQr.toLowerCase() && s.action === (workMode === 'DELIVERY' ? '납품' : '회수'))) {
            setNotification({ opened: true, type: 'info', message: '중복 스캔', subMessage: '이 작업 세션에서 이미 처리된 용기입니다.' });
            return;
        }

        // Check for Customer Intent OR Ambiguous UUID (Could be Customer or Cylinder)
        const upperRaw = qr.toUpperCase();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQr);
        const isCustomerPrefix = upperRaw.startsWith('CUST') || upperRaw.startsWith('TEST-BIZ') || isUUID;
        
        // Case A: Customer Scan or Ambiguous (handled by backend SMART_SCAN)
        if (isCustomerPrefix || !currentCustomer) {
            try {
                setIsProcessing(true);
                const res = await fetch('/api/work/delivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'SMART_SCAN', qrCode: cleanQr, workerId, customerId: currentCustomer?.id, workMode, force })
                });
                setIsProcessing(false);
                const result = await res.json();

                if (result.success && result.entityType === 'CUSTOMER') {
                    if (sessionCustomer && sessionCustomer.id !== result.data.id) {
                        playWarningSound();
                        trigger('warning', '작업 중', `현재 '${sessionCustomer.name}' 세션을 먼저 완료해주세요.`);
                        return;
                    }
                    setCurrentCustomer(result.data);
                    setSessionCustomer(result.data);
                    trigger('success', '거래처 선택', result.data.name || '');
                    return;
                }
                
                // If backend resolved to cylinder but no customer selected
                if (result.success && result.entityType === 'CYLINDER' && !currentCustomer) {
                     playErrorSound();
                     trigger('error', '오류', '거래처를 먼저 선택해주세요.');
                     return;
                }
            } catch (e) {
                setIsProcessing(false);
                console.error(e);
            }
        }

        // Case B: Explicit Cylinder Action (with Interceptor)
        if (currentCustomer) {
            try {
                // [Interceptor]
                const checkRes = await fetch('/api/work/delivery/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: workMode, qrCode: qr, customerId: currentCustomer.id })
                });
                const checkData = await checkRes.json();

                if (checkData.success) {
                    if (checkData.data.safety.level === 'warning') {
                        setSafetyModal({
                            opened: true,
                            level: 'warning',
                            title: `주의: ${workMode === 'DELIVERY' ? '납품' : '회수'} 진행 확인`,
                            message: checkData.message,
                            subMessages: [
                                `용기번호: ${checkData.data.serialNumber}`,
                                `안전등급: ${checkData.data.safety.desc} (${checkData.data.safety.diffDays}일 남음)`
                            ],
                            pendingQr: qr
                        });
                    } else {
                        // All green -> execute
                        await executeDeliveryAction(qr);
                    }
                } else {
                    // Error/Red -> Show Blocking Modal
                    
                    // [UX] Dynamic Title based on Error Code
                    let errorTitle = `차단: ${workMode === 'DELIVERY' ? '납품' : '회수'} 불가`;
                    const code = checkData.code;
                    
                    if (code === 'EXPIRY_LIMIT') errorTitle = '⛔ 납품차단: 충전기한 만료';
                    else if (code === 'LOCATION_MISMATCH') errorTitle = '🚫 위치 불일치 (타 거래처)';
                    else if (code === 'STATUS_MISMATCH') errorTitle = '❌ 용기 상태 오류';
                    else if (code === 'DISCARDED') errorTitle = '⛔ 불량/폐기 용기';
                    else if (code === 'IS_CHARGING') errorTitle = '⏳ 충전 중인 용기';

                    setSafetyModal({
                        opened: true,
                        level: 'error',
                        title: errorTitle,
                        message: checkData.message,
                        subMessages: [
                            `용기번호: ${checkData.data.serialNumber || qr}`,
                            `상황: ${checkData.data.safety?.desc || '검증 실패'}`
                        ],
                        pendingQr: ''
                    });
                    playErrorSound();
                }
            } catch (e) {
                console.error('[DeliveryCheck] Failed', e);
                await executeDeliveryAction(qr); // Fallback
            }
        }
    };

    const executeDeliveryAction = async (qr: string, force: boolean = false) => {
        try {
            setIsProcessing(true);
            const res = await fetch('/api/work/delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'CYLINDER',
                    qrCode: cleanQrCode(qr),
                    customerId: currentCustomer?.id,
                    workMode,
                    force,
                    workerId: getWorkerId()
                })
            });
            setIsProcessing(false);
            const result = await res.json();

            if (res.ok && result.success) {
                handleCylinderSuccess(result);
            } else {
                handleCylinderError(result, cleanQrCode(qr));
            }
        } catch (e) {
            setIsProcessing(false);
            playErrorSound();
            console.error(e);
        }
    };



  // [HARDWARE_SCANNER] Hook Integration
  useScanner({
      onChange: (code) => {
          // Play a distinct sound for hardware scan if needed, or just process
          processScan(code);
      }
  });



  const handleCameraScan = (decodedText: string) => {
      // [CONTINUOUS_SCAN] Do not close automatically 
      processScan(decodedText);
  };

  const handlePartnerSelect = (customer: Customer) => {
    // [SESSION_MODE] Conflict Check
    if (sessionCustomer && sessionCustomer.id !== customer.id) {
        // Error: vibration will trigger
        setNotification({ 
            opened: true, 
            type: 'warning', 
            message: '작업 중', 
            subMessage: `현재 '${sessionCustomer.name}' 세션을 먼저 완료해주세요.` 
        });
        setPartnerModalOpened(false);
        return;
    }

    setCurrentCustomer(customer);
    setSessionCustomer(customer); // Start Session
    // Silent session start
  };

  // Mode Helper
  const getWorkModeLabel = (mode: string) => {
      switch(mode) {
          case 'DELIVERY': return '[납품]';
          case 'COLLECTION_EMPTY': return '[회수/공병]';
          case 'COLLECTION_FULL': return '[회수/실병]';
          case 'INSPECTION_OUT': return '[검사출고]';
          case 'INSPECTION_IN': return '[검사입고]';
          default: return '';
      }
  };

  return (
    <AppLayout title="납품 / 회수" themeColor="#339AF0">
      <PageTransition>
            {isProcessing && (
                <Box pos="fixed" top={0} left={0} w="100%" h="100%" style={{ zIndex: 2000 }}>
                    <LoadingOverlay 
                        visible={true} 
                        overlayProps={{ radius: "sm", blur: 2, backgroundOpacity: 0.5 }} 
                        loaderProps={{ children: <Text fw={700} c="blue">처리 중...</Text> }}
                    />
                </Box>
            )}
      <QRScannerModal 
        opened={scannerOpened} 
        onClose={() => setScannerOpened(false)} 
        onScan={handleCameraScan} 
        mode="continuous"
        titlePrefix={getWorkModeLabel(workMode)}
        sessionName={sessionCustomer?.name}
        totalCount={
            Object.values(sessionStats?.납품 || {}).reduce((a, b) => a + b, 0) + 
            Object.values(sessionStats?.회수공병 || {}).reduce((a, b) => a + b, 0) + 
            Object.values(sessionStats?.회수실병 || {}).reduce((a, b) => a + b, 0)
        }
        statsSections={[
            { 
                key: 'delivery', 
                label: '납품', 
                color: 'blue', 
                count: Object.values(sessionStats?.납품 || {}).reduce((a, b) => a + b, 0),
                items: sessionStats?.납품 || {}
            },
            { 
                key: 'collection_empty', 
                label: '회수 (공병)', 
                color: 'green', 
                count: Object.values(sessionStats?.회수공병 || {}).reduce((a, b) => a + b, 0),
                items: sessionStats?.회수공병 || {}
            },
            { 
                key: 'collection_full', 
                label: '회수 (실병)', 
                color: 'red', 
                count: Object.values(sessionStats?.회수실병 || {}).reduce((a, b) => a + b, 0),
                items: sessionStats?.회수실병 || {}
            }
        ]}
        paused={confirmOpen}
      />
      <PartnerSearchModal opened={partnerModalOpened} onClose={() => setPartnerModalOpened(false)} onSelect={handlePartnerSelect} />
       <CentralNotification 
           opened={notification.opened || (feedbackActive && !statsModalOpen && !!feedbackMessage)} 
           type={notification.opened ? notification.type : feedbackType} 
           message={notification.opened ? notification.message : feedbackMessage || ''} 
           subMessage={notification.opened ? notification.subMessage : feedbackSubMessage}
           onClose={() => setNotification({ ...notification, opened: false })}
       />

        <SafetyConfirmModal 
            opened={safetyModal.opened}
            level={safetyModal.level}
            title={safetyModal.title}
            message={safetyModal.message}
            subMessages={safetyModal.subMessages}
            onClose={() => setSafetyModal(prev => ({ ...prev, opened: false }))}
            onConfirm={() => {
                if (safetyModal.pendingQr) {
                    // processScan with force=true
                    executeDeliveryAction(safetyModal.pendingQr, true);
                }
            }}
            isBlocking={safetyModal.level === 'error'}
        />

        {/* [NEW] Session Statistics Modal - Only show if Scanner IS NOT Open (to avoid double modals) */}
        {!scannerOpened && <WorkSessionStatsModal 
            opened={statsModalOpen}
            onClose={handleStatsClose}
            totalCount={
                Object.values(sessionStats?.납품 || {}).reduce((a, b) => a + b, 0) + 
                Object.values(sessionStats?.회수공병 || {}).reduce((a, b) => a + b, 0) + 
                Object.values(sessionStats?.회수실병 || {}).reduce((a, b) => a + b, 0)
            }
            sections={[
                { 
                    key: 'delivery', 
                    label: '납품', 
                    color: 'blue', 
                    count: Object.values(sessionStats?.납품 || {}).reduce((a, b) => a + b, 0),
                    items: sessionStats?.납품 || {}
                },
                { 
                    key: 'collection_empty', 
                    label: '회수 (공병)', 
                    color: 'green', 
                    count: Object.values(sessionStats?.회수공병 || {}).reduce((a, b) => a + b, 0),
                    items: sessionStats?.회수공병 || {}
                },
                { 
                    key: 'collection_full', 
                    label: '회수 (실병)', 
                    color: 'red', 
                    count: Object.values(sessionStats?.회수실병 || {}).reduce((a, b) => a + b, 0),
                    items: sessionStats?.회수실병 || {}
                }
            ]}
            headerContent={
                sessionCustomer && (
                    <Box p="xs" style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderRadius: '8px',
                      border: '2px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <Text size="xs" c="dimmed">거래처</Text>
                      <Text fw={700} size="md" c="white">{sessionCustomer.name}</Text>
                    </Box>
                )
            }
        /> }

       {/* Force Confirm Modal - Consistent Premium Glass */}
       <Modal 
            opened={confirmOpen} 
            onClose={handleConfirmClose} 
            
            title={
                <Group gap="sm">
                    <ThemeIcon color="red" variant="transparent" size="lg"><IconAlertTriangle /></ThemeIcon>
                    <Text fw={700} size="lg" c="white">확인 필요</Text>
                </Group>
            }
            centered
            zIndex={2000} 
            styles={{ 
                content: { 
                    background: 'rgba(26, 27, 30, 0.95)', 
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(250, 82, 82, 0.5)',
                    boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                    borderRadius: '16px'
                }, 
                header: { backgroundColor: 'transparent', color: 'white' },
                body: { color: 'white' }
            }}
       >
           <Stack>
               <Text>{confirmMessage}</Text>
                <Text size="sm" c="dimmed">강제 처리 시 시스템 정보가 갱신됩니다. 진행하시겠습니까?</Text>
                <Group grow mt="md">
                   <Button color="gray" onClick={() => {
                       setConfirmOpen(false);
                       if (sessionCustomer) openStatsModal();
                   }}>취소</Button>
                   <Button color="red" onClick={() => processScan(pendingQr, true)}>강제 처리</Button>
               </Group>
           </Stack>
       </Modal>
      
      <Stack gap="md">
        {/* 1. Action Buttons - Moved to Top - Reduced Height for Mobile */}
            {/* Premium Work Mode Selectors */}
            <StaggerContainer>
            <SimpleGrid cols={{ base: 3, sm: 3 }} spacing={{ base: 8, sm: 'lg' }}>
                <GlassCard
                    variant={workMode === 'DELIVERY' ? 'active' : 'static'}
                    onClick={() => {
                        setWorkMode('DELIVERY');
                    }}
                    className={workMode !== 'DELIVERY' ? 'titanium-glass-hover' : ''}
                    style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        // Explicit override for active variant specific colors if needed, 
                        // but GlassCard active default is Blue. Delivery is Blue. Perfect.
                        borderColor: workMode === 'DELIVERY' ? 'rgba(51, 154, 240, 0.5)' : undefined,
                    }}
                    h={{ base: '70px', sm: '90px' }}
                    p={0} // Reset padding for this specific button layout
                >
                    <Text span size="xl" fw={800} c={workMode === 'DELIVERY' ? 'blue.2' : 'dimmed'} fz={{ base: '1.1rem', sm: '1.4rem' }}>납품</Text>
                     {workMode === 'DELIVERY' && <Box w={20} h={3} bg="blue.4" mt={4} style={{ borderRadius: '10px' }} />}
                </GlassCard>

                <GlassCard
                    variant={workMode === 'COLLECTION_EMPTY' ? 'active' : 'static'}
                    onClick={() => {
                        setWorkMode('COLLECTION_EMPTY');
                    }}
                    className={workMode !== 'COLLECTION_EMPTY' ? 'titanium-glass-hover' : ''}
                    style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        // Active override for Green
                        background: workMode === 'COLLECTION_EMPTY' ? 'linear-gradient(145deg, rgba(64, 192, 87, 0.2) 0%, rgba(64, 192, 87, 0.05) 100%)' : undefined,
                        borderColor: workMode === 'COLLECTION_EMPTY' ? 'rgba(64, 192, 87, 0.5)' : undefined,
                        boxShadow: workMode === 'COLLECTION_EMPTY' ? '0 0 15px rgba(64, 192, 87, 0.3)' : undefined,
                    }}
                    h={{ base: '70px', sm: '90px' }}
                    p={0}
                >
                    <Text span size="xl" fw={800} c={workMode === 'COLLECTION_EMPTY' ? 'green.2' : 'dimmed'} fz={{ base: '1.0rem', sm: '1.4rem' }}>회수(공병)</Text>
                    {workMode === 'COLLECTION_EMPTY' && <Box w={20} h={3} bg="green.4" mt={4} style={{ borderRadius: '10px' }} />}
                </GlassCard>

                <GlassCard
                    variant={workMode === 'COLLECTION_FULL' ? 'active' : 'static'}
                    onClick={() => {
                        setWorkMode('COLLECTION_FULL');
                    }}
                    className={workMode !== 'COLLECTION_FULL' ? 'titanium-glass-hover' : ''}
                    style={{ 
                       display: 'flex',
                       flexDirection: 'column',
                       alignItems: 'center',
                       justifyContent: 'center',
                       cursor: 'pointer',
                       // Active override for Red
                       background: workMode === 'COLLECTION_FULL' ? 'linear-gradient(145deg, rgba(250, 82, 82, 0.2) 0%, rgba(250, 82, 82, 0.05) 100%)' : undefined,
                       borderColor: workMode === 'COLLECTION_FULL' ? 'rgba(250, 82, 82, 0.5)' : undefined,
                       boxShadow: workMode === 'COLLECTION_FULL' ? '0 0 15px rgba(250, 82, 82, 0.3)' : undefined,
                    }}
                    h={{ base: '70px', sm: '90px' }}
                    p={0}
                >
                    <Text span size="xl" fw={800} c={workMode === 'COLLECTION_FULL' ? 'red.2' : 'dimmed'} fz={{ base: '1.0rem', sm: '1.4rem' }}>회수(실병)</Text>
                    {workMode === 'COLLECTION_FULL' && <Box w={20} h={3} bg="red.4" mt={4} style={{ borderRadius: '10px' }} />}
                </GlassCard>
            </SimpleGrid>
            </StaggerContainer>

        {/* [NEW] Edge Lighting Effect: Priority 1 (Alarm) Only */}
        <EdgeLighting 
            active={feedbackActive} 
            color={
                feedbackType === 'success' ? '#40C057' : // Green
                feedbackType === 'warning' ? '#FAB005' : // Yellow
                '#FA5252' // Red (Error)
            } 
        />

        {/* [SESSION_MODE] Active Session Status Bar */}
        {sessionCustomer && (
            <GlassCard variant="active" p="md" style={{ borderColor: '#339AF0' }}>
                <Group justify="space-between" align="flex-end">
                    <Group>
                        <Loader size="sm" color="white" type="bars" />
                        <Stack gap={0}>
                            <Text c="white" fw={700} size="lg">[{sessionCustomer.name}] 작업 진행 중...</Text>
                            <Text c="blue.1" size="xs">다른 거래처 스캔 시 경고가 표시됩니다.</Text>
                        </Stack>
                    </Group>
                    <Button 
                        color="red" 
                        variant="white" 
                        size="xs" 
                        onClick={() => {
                            setSessionCustomer(null);
                            setCurrentCustomer(null);
                        }}
                    >
                        작업 완료
                    </Button>
                </Group>
            </GlassCard>
        )}

        {/* 2. Partner Select Section (Only when No Session) */}
        {!sessionCustomer && (
            <GlassCard 
                variant="interactive"
                mb="md"
                p="sm"
                onClick={() => setPartnerModalOpened(true)}
                style={{ display: 'flex', alignItems: 'center' }}
            >
                <Group justify="space-between" align="center" w="100%">
                    <Group gap="sm">
                        <IconBuildingSkyscraper size={24} color={currentCustomer ? '#339AF0' : 'gray'} />
                        <Text size="lg" fw={700} c={currentCustomer ? 'white' : 'dimmed'} fz={{ base: '1.1rem', sm: '1.4rem' }} style={{ lineHeight: 1.2 }}>
                            {currentCustomer ? currentCustomer.name : '거래처를 선택하세요'}
                        </Text>
                    </Group>
                    {currentCustomer ? (
                         <ActionIcon 
                            color="gray" 
                            variant="transparent" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentCustomer(null);
                                setSessionCustomer(null); 
                            }}
                        >
                            <IconX size={22} />
                        </ActionIcon>
                    ) : (
                        <Group gap={18}>
                        <ActionIcon 
                            color="teal" 
                            variant="light" 
                            size="lg"
                            radius="md"
                            onClick={(e) => {
                                e.stopPropagation();
                                setScannerOpened(true);
                            }}
                        >
                            <IconCamera size={20} />
                        </ActionIcon>
                         
                         {/* [MANUAL INPUT] PC Support */}
                         <ActionIcon 
                            color="gray" 
                            variant="light" 
                            size="lg"
                            radius="md"
                            onClick={(e) => {
                                e.stopPropagation();
                                setManualInputOpened(true);
                            }}
                        >
                             <IconKeyboard size={20} />
                        </ActionIcon>
                        </Group>
                    )}
                </Group>
            </GlassCard>
        )}

        {/* 4. History List */}
        <StaggerContainer>
        <Paper p="md" shadow="sm" radius="md" style={{ 
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
           {/* History Header: Two-Row Layout */}
           <Stack gap="xs" mb="sm">
               {/* Row 1: Title & QR Scanner */}
               <Group justify="space-between" align="center">
                   <Group gap="xs">
                       <Text size="xl" fw={700} c="white" style={{ fontSize: '1.5rem' }}>
                           {currentCustomer ? (
                               <>
                                   {currentCustomer.name}
                                   <Text span ml={10} fw={500}>이력</Text>
                               </>
                           ) : '최근 작업 내역'}
                       </Text>
                   </Group>
                   
                   {/* QR Code Button (Top Right) */}
                   {/* QR Code Button (Top Right) - Converted to Badge Button */}
                   <Badge
                        variant="filled"
                        color="blue"
                        size="lg"
                        style={{ cursor: 'pointer', height: '30px', paddingLeft: '10px', paddingRight: '10px' }}
                        onClick={() => setScannerOpened(true)}
                        leftSection={<IconCamera size={16} style={{ marginTop: '4px' }} />}
                   >
                        QR
                   </Badge>
               </Group>

               {/* Row 2: Dates & Action Buttons */}
               <Group justify="flex-end" gap={5}>
                    <DatesProvider settings={{ locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] }}>
                        <Group align="center" gap={5}>
                            <DateInput
                                value={dateRange[0]}
                                onChange={(d) => setDateRange([d as Date | null, dateRange[1]])}
                                valueFormat="YYYY. MM. DD."
                                placeholder="시작일"
                                leftSection={<IconCalendar size={16} />}
                                locale="ko"
                                size="sm" 
                                w={140}
                                styles={{
                                    input: {
                                        backgroundColor: '#1A1B1E',
                                        border: '1px solid #373A40',
                                        color: 'white',
                                        textAlign: 'center',
                                    }
                                }}
                                popoverProps={{ position: 'bottom', withinPortal: true }}
                                inputMode="none"
                            />
                            <Text c="dimmed" size="xs">~</Text>
                            <DateInput
                                value={dateRange[1]}
                                onChange={(d) => setDateRange([dateRange[0], d as Date | null])}
                                valueFormat="YYYY. MM. DD."
                                placeholder="종료일"
                                leftSection={<IconCalendar size={16} />}
                                locale="ko"
                                size="sm"
                                w={140}
                                styles={{
                                    input: {
                                        backgroundColor: '#1A1B1E',
                                        border: '1px solid #373A40',
                                        color: 'white',
                                        textAlign: 'center',
                                    }
                                }}
                                popoverProps={{ position: 'bottom', withinPortal: true }}
                                inputMode="none"
                            />
                        </Group>
                    </DatesProvider>
                    <Button variant="subtle" color="gray" size="sm" onClick={() => mutateHistory()} h={36} w={36} p={0}>
                        <IconRefresh size={18} />
                    </Button>
                    <Button 
                        variant="light" 
                        color="orange" 
                        size="sm" 
                        disabled={!currentCustomer}
                        onClick={openLedger}
                        h={36}
                    >
                        장부
                    </Button>
               </Group>
           </Stack>

           <ScrollArea style={{ height: 'calc(100vh - 450px)', minHeight: '300px' }}>
               {history.length === 0 ? (
                   <Text c="dimmed" ta="center" py="xl">작업 내역이 없습니다.</Text>
               ) : (
                   <>
                       {/* Desktop Table View */}
                       <Box visibleFrom="sm">
                           <Table>
                               <Table.Thead>
                                   <Table.Tr>
                                       <Table.Th style={{ color: 'white', fontSize: '1.1rem' }}>날짜</Table.Th>
                                       <Table.Th style={{ color: 'white', fontSize: '1.1rem' }}>용기번호</Table.Th>
                                       <Table.Th style={{ color: 'white', fontSize: '1.1rem' }}>가스종류</Table.Th>
                                       <Table.Th style={{ color: 'white', fontSize: '1.1rem' }}>구분</Table.Th>
                                       <Table.Th style={{ color: 'white', fontSize: '1.1rem' }}>거래처</Table.Th>
                                       <Table.Th style={{ color: 'white', fontSize: '1.1rem' }}>작업자</Table.Th>
                                   </Table.Tr>
                               </Table.Thead>
                               <Table.Tbody>
                                   {history.map(row => (
                                       <Table.Tr key={row.id}>
                                           <Table.Td style={{ color: 'gray', fontSize: '1.1rem' }}>{row.date}</Table.Td>
                                           <Table.Td style={{ color: 'white', fontWeight: 500, fontSize: '1.1rem' }}>
                                                <Text 
                                                    span 
                                                    c="blue.4" 
                                                    style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                                                    onClick={() => handleHistoryClick(row.cylinderId)}
                                                >
                                                    {row.cylinderId}
                                                </Text>
                                           </Table.Td>
                                           <Table.Td style={{ color: 'white', fontSize: '1.1rem' }}>
                                                <GasBadge gasType={row.gas} color={row.gasColor} size="sm" isRack={row.containerType === 'RACK'} />
                                           </Table.Td>
                                            <Table.Td>
                                                <Badge size="lg" 
                                                    color={
                                                        row.type === '납품' ? ACTION_COLORS.납품 : 
                                                        (row.memo?.includes('COLLECTION_FULL') || row.memo?.includes('실병')) ? ACTION_COLORS.회수_FULL :
                                                        ACTION_COLORS.회수_EMPTY
                                                    } 
                                                    style={{ minWidth: '80px' }}
                                                >
                                                    {row.type === '납품' ? '납품' : 
                                                     (row.memo?.includes('COLLECTION_FULL') || row.memo?.includes('실병')) ? '회수(실병)' : '회수(공병)'}
                                                </Badge>
                                            </Table.Td>
                                           <Table.Td style={{ color: 'white', fontSize: '1.1rem' }}>{resolveShortHolderName(typeof row.customer === 'string' ? row.customer : row.customer?.name)}</Table.Td>
                                           <Table.Td style={{ color: 'gray', fontSize: '1.rem' }}>{userMap[row.worker] || (row.worker === 'WORKER-DEFAULT' ? '관리자' : row.worker)}</Table.Td>
                                       </Table.Tr>
                                   ))}
                               </Table.Tbody>
                           </Table>
                       </Box>

                        {/* Mobile Card View - Compact - Filtered by Worker */}
                        <Stack hiddenFrom="sm" gap="xs">
                            {history
                                // .filter(row => row.worker === 'WORKER-DEFAULT') // REMOVED: Show all history matching the search query
                                .map(row => {
                                const dateStr = row.date.split(' ')[0] || row.date;
                                const timeStr = row.date.length > 10 ? row.date.substring(11, 16) : '';
                                
                                // Determine specific type/color
                                let itemColor = ACTION_COLORS.회수;
                                let typeText = '회수';
                                if (row.type === '납품') {
                                    itemColor = ACTION_COLORS.납품;
                                    typeText = '납품';
                                } else if (row.type === '회수') {
                                    // Use memo to distinguish
                                    if (row.memo?.includes('COLLECTION_FULL') || row.memo?.includes('실병')) {
                                        itemColor = ACTION_COLORS.회수_FULL;
                                        typeText = '회수(실병)';
                                    } else {
                                        // Default to Empty (Green)
                                        itemColor = ACTION_COLORS.회수_EMPTY; 
                                        typeText = '회수(공병)';
                                    }
                                }

                                return (
                                <Card key={row.id} radius="md" p="xs" style={{ 
                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderLeft: `5px solid ${itemColor}`
                                }}>
                                    <Flex align="center" gap="sm">
                                        {/* 1. Date/Time (Left) */}
                                        <Stack gap={0} align="center" w={70} style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }} pr="xs">
                                            <Text fw={700} c="white" fz="0.8rem">{dateStr.substring(5)}</Text>
                                            <Text size="xs" c="dimmed" fz="0.75rem">{timeStr || '-'}</Text>
                                        </Stack>

                                        {/* 2. Main Info (Center) */}
                                        <Stack gap={1} style={{ flex: 1 }}>
                                             <Group gap="xs" align="center" mb={1}>
                                                {/* Status + Gas Type */}
                                                <Text fw={700} size="md" style={{ color: itemColor }}>
                                                    {typeText}
                                                </Text>
                                                <GasBadge gasType={row.gas} color={row.gasColor} size="sm" isRack={row.containerType === 'RACK'} />
                                             </Group>

                                             <Text 
                                                fw={800} 
                                                c="blue.4" 
                                                fz="1.1rem"
                                                style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                                                onClick={() => handleHistoryClick(row.cylinderId)}
                                             >
                                                {row.cylinderId}
                                             </Text>
                                             <Text size="sm" c="dimmed">거래처: <Text span c="white">{resolveShortHolderName(typeof row.customer === 'string' ? row.customer : row.customer?.name)}</Text></Text>
                                        </Stack>

                                        {/* 3. Worker (Right) */}
                                        <Badge variant="outline" color="gray" size="sm" style={{ alignSelf: 'center' }}>
                                            {userMap[row.worker] || (row.worker === 'WORKER-DEFAULT' ? '관리자' : row.worker.replace('WORKER-', ''))}
                                        </Badge>
                                    </Flex>
                                </Card>
                                );
                            })}
                        </Stack>
                   </>
               )}
           </ScrollArea>
        </Paper>
        </StaggerContainer>

      </Stack>
        <CylinderHistoryModal 
           opened={historyModalOpen} 
           onClose={closeHistory} 
           cylinderId={selectedCylinderId || ''} 
        />
        <DailyTransactionLedgerModal 
            opened={ledgerModalOpen}
            onClose={closeLedger}
            customer={currentCustomer}
        />

        {/* [MANUAL INPUT] Modal */}
        <Modal 
            opened={manualInputOpened} 
            onClose={() => setManualInputOpened(false)} 
            title={
                <Text fw={700} c="white">코드 직접 입력</Text>
            }
            centered
            // [FIX] Bias modal upwards to avoid mobile keyboard overlap
            styles={{ 
                content: { backgroundColor: '#1A1B1E', color: 'white', border: '1px solid #373A40', marginBottom: '20vh' },
                header: { backgroundColor: '#1A1B1E', color: 'white' }
            }}
        >
            <Stack>
                <TextInput 
                    placeholder="QR 코드 입력 (예: CUST:..., CYL:...)" 
                    value={manualCode}
                    onChange={(e) => setManualCode(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            processScan(manualCode);
                            setManualCode('');
                            setManualInputOpened(false);
                        }
                    }}
                    styles={{ input: { backgroundColor: '#2C2E33', color: 'white', borderColor: '#373A40', fontSize: '16px' } }} // 16px prevents iOS zoom
                    autoFocus
                />
                <Button fullWidth onClick={() => {
                    processScan(manualCode);
                    setManualCode('');
                    setManualInputOpened(false);
                }}>
                    입력 확인
                </Button>
            </Stack>
        </Modal>

      </PageTransition>
    </AppLayout>
  );
}
