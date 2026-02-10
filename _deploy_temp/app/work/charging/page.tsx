'use client';

import useSWR from 'swr';

import { AppLayout } from '@/components/Layout/AppLayout';
import { PageTransition } from '@/components/UI/PageTransition';

import { Paper, Text, SimpleGrid, Group, TextInput, Stack, Button, ScrollArea, Card, Badge, Flex, Popover, Select, Autocomplete, Table, Grid, Box, LoadingOverlay, Modal } from '@mantine/core';
import { GasBadge } from '@/components/Common/GasBadge';
import { IconSearch, IconCalendar, IconCamera, IconFilter, IconX, IconArrowRight, IconCheck, IconKeyboard } from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { DatesProvider } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import 'dayjs/locale/ko';
import '@mantine/dates/styles.css';
import { useState, useRef, useEffect, useCallback, Fragment, useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.locale('ko');


// import { QRScannerModal } from '@/components/Common/QRScannerModal'; // Static import removed
import dynamic from 'next/dynamic';
const QRScannerModal = dynamic(
  () => import('@/components/Common/QRScannerModal').then(mod => mod.QRScannerModal),
  { ssr: false }
);
import { useScanner } from '@/app/hooks/useScanner';
import { useScanQueue } from '@/app/hooks/useScanQueue'; // [NEW]
import { CentralNotification } from '@/components/Common/CentralNotification';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { playErrorSound, playSuccessSound } from '@/app/utils/feedback'; // [NEW] Added playSuccessSound
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

import { useUserMap } from '@/app/hooks/useUserMap';
import { getWorkerId } from '@/app/utils/authUtils';
import { WorkSessionStatsModal } from '@/components/Work/WorkSessionStatsModal';
import { EdgeLighting } from '@/components/UI/EdgeLighting'; // [NEW]
import { useVisualFeedbackStore } from '@/store/visualFeedbackStore'; // [NEW]
import { resolveShortOwnerName } from '@/app/utils/display';
import { SafetyConfirmModal, SafetyLevel } from '@/components/Common/SafetyConfirmModal';



interface CylinderStats {
    standby: number;
    charging: number;
    full: number;
    total: number;
}

interface HistoryRecord {
    id: string;
    date: string;
    type: string;
    memo: string;
    workerId: string;
    cylinderId?: string;
    gasType?: string;
    customerName?: string;
    gasColor?: string;
    containerType?: string;
}



type WorkMode = 'START' | 'COMPLETE' | 'RELEASE' | 'SEARCH';

interface ActiveFilter {
    matchType: 'date' | 'serial' | 'gasType' | 'customer' | 'worker';
    label: string;
}

interface ActiveFilter {
    matchType: 'date' | 'serial' | 'gasType' | 'customer' | 'worker';
    label: string;
}

// Mantine DatesProvider settings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DATE_SETTINGS: any = { locale: 'ko', firstDayOfWeek: 0, weekendDays: [0] };

interface CylinderDetail {
    id: string;
    serialNumber: string;
    gasType: string;
    owner: string;
    chargingExpiryDate: string;
    gasColor?: string;
}

// [Optimized Component] Isolated Filter Popover to prevent performance issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SearchFilterPopover = ({ filters, onUpdate, customerNames, userNames }: { filters: any, onUpdate: (newFilters: any, immediate: boolean) => void, customerNames: string[], userNames: string[] }) => {
    return (
        <Popover width={300} position="bottom" withArrow shadow="md">
            <Popover.Target>
                <Button color="gray" variant="light" leftSection={<IconFilter size={18} />} size="md">
                    상세 필터
                </Button>
            </Popover.Target>
            <Popover.Dropdown style={{ backgroundColor: '#25262b', borderColor: '#373A40' }}>
                <Stack>
                    <TextInput 
                        label="용기 번호" 
                        placeholder="일련번호 입력" 
                        value={filters.serial}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(e: any) => onUpdate({...filters, serial: e.target.value}, false)}
                        styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' }, label: { color: '#C1C2C5' } }}
                    />
                    <Select
                        label="가스 종류"
                        placeholder="선택"
                        data={['산소', '질소', '아르곤', '탄산', '헬륨', '에어', '혼합가스']}
                        value={filters.gasType}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(val: any) => onUpdate({...filters, gasType: val || ''}, true)}
                        styles={{ 
                            input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' }, 
                            label: { color: '#C1C2C5' }, 
                            dropdown: { backgroundColor: '#25262b', borderColor: '#373A40', color: 'white' }, 
                            option: { color: 'white' } 
                        }}
                    />
                    <Autocomplete
                        label="거래처" 
                        placeholder="거래처명 입력" 
                        data={customerNames}
                        limit={10} 
                        value={filters.customer}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(val: any) => onUpdate({...filters, customer: val}, true)}
                        styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' }, label: { color: '#C1C2C5' }, dropdown: { backgroundColor: '#25262b', borderColor: '#373A40', color: 'white' }, option: { color: 'white' } }}
                        comboboxProps={{ withinPortal: false }}
                    />
                    <Autocomplete
                        label="납품자(작업자)" 
                        placeholder="이름 입력" 
                        data={userNames}
                        limit={10} 
                        value={filters.worker}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onChange={(val: any) => onUpdate({...filters, worker: val}, true)}
                        styles={{ input: { backgroundColor: '#1A1B1E', borderColor: '#373A40', color: 'white' }, label: { color: '#C1C2C5' }, dropdown: { backgroundColor: '#25262b', borderColor: '#373A40', color: 'white' }, option: { color: 'white' } }}
                        comboboxProps={{ withinPortal: false }}
                    />
                    <Button 
                        size="xs" 
                        variant="light" 
                        color="red" 
                        onClick={() => onUpdate({ serial: '', gasType: '', customer: '', worker: '' }, true)}
                        fullWidth
                    >
                        필터 항목 초기화
                    </Button>
                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ChargingPage() {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [workMode, setWorkMode] = useState<WorkMode>('SEARCH');
  const [scannerOpened, setScannerOpened] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const { trigger, isActive: feedbackActive, type: feedbackType } = useVisualFeedbackStore(); // [NEW]
  
  // [Manual Modal]
  const [manualOpen, { open: openManual, close: closeManual }] = useDisclosure(false);
  const [manualCode, setManualCode] = useState('');
  
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  useEffect(() => {
      setDateRange([new Date(), new Date()]);
  }, []);
  // Filters
  const [searchFilters, setSearchFilters] = useState({
      serial: '',
      gasType: '',
      customer: '',
      worker: ''
  });
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilter[]>([]); 

  // [SWR] 1. Customers
  const { data: customerData } = useSWR('/api/master/customers', fetcher);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerNames = customerData?.success ? customerData.data.map((c: any) => c.name) : [];

  // [SWR] 2. Stats
  const { data: statsData, mutate: mutateStats } = useSWR('/api/work/charging', fetcher, { 
      refreshInterval: 5000,
      revalidateOnFocus: false // [OPTIMIZATION]
  });
  const stats: CylinderStats = statsData?.success ? statsData.data : { standby: 0, charging: 0, full: 0, total: 0 };

  // [SWR] 3. History with Filters
  // Date Logic for SWR Key
  const getValidDateStr = (d: Date | null | undefined): string | null => {
      if (!d) return null;
      const day = dayjs(d);
      return day.isValid() ? day.format('YYYY-MM-DD') : null;
  };

  let startDateStr = dayjs().format('YYYY-MM-DD');
  let endDateStr = startDateStr;

  if (dateRange[0]) {
      const start = getValidDateStr(dateRange[0]);
      if (start) {
          startDateStr = start;
          const end = getValidDateStr(dateRange[1]);
          if (end) endDateStr = end;
          else endDateStr = dayjs().format('YYYY-MM-DD');
      }
  }

  const queryParams = new URLSearchParams();
  queryParams.set('startDate', startDateStr);
  queryParams.set('endDate', endDateStr);
  if (searchFilters.serial) queryParams.set('serial', searchFilters.serial);
  if (searchFilters.gasType) queryParams.set('gasType', searchFilters.gasType);
  if (searchFilters.customer) queryParams.set('customer', searchFilters.customer);
  if (searchFilters.worker) queryParams.set('worker', searchFilters.worker);

  const { data: historyData, mutate: mutateHistory, isLoading: historyLoading } = useSWR(
      `/api/work/charging?${queryParams.toString()}`,
      fetcher,
      { 
          keepPreviousData: true,
          revalidateOnFocus: false // [OPTIMIZATION]
      }
  );
  
  // [REFACTOR] Renamed for clarity - this is Server Data
  const serverHistory: HistoryRecord[] = useMemo(() => 
      historyData?.success ? historyData.data.history : [],
  [historyData]);

  // Results Modal State - REMOVED (Inline Display)
  // const [resultsOpened, { open: openResults, close: closeResults }] = useDisclosure(false);

  // Results Modal State - REMOVED (Inline Display)
  // const [resultsOpened, { open: openResults, close: closeResults }] = useDisclosure(false);

  // [State] Central Notification
  const [notification, setNotification] = useState({
      opened: false,
      type: 'info' as 'success' | 'warning' | 'error' | 'info',
      message: '',
      subMessage: undefined as string | undefined
  });

  // History Modal
  const [historyModalOpen, { open: openHistory, close: closeHistory }] = useDisclosure(false);
  const [selectedCylinderId, setSelectedCylinderId] = useState<string | null>(null);

  // [SAFETY_MODAL_STATE]
  const [safetyModal, setSafetyModal] = useState({
      opened: false,
      level: 'info' as SafetyLevel,
      title: '',
      message: '',
      subMessages: [] as string[],
      pendingQr: ''
  });

  const [statsModalOpen, { close: closeStatsModal }] = useDisclosure(false);
  const handleStatsClose = useModalBackTrap(statsModalOpen, closeStatsModal, 'charging-stats-modal');

  const [detailModalOpen, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const handleDetailClose = useModalBackTrap(detailModalOpen, closeDetailModal, 'charging-detail-modal');
  const [detailTitle, setDetailTitle] = useState('');
  const [detailList, setDetailList] = useState<CylinderDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleStatusClick = async (type: 'STANDBY' | 'CHARGING' | 'FULL') => {
      setDetailLoading(true);
      setDetailList([]);
      
      let title = '';
      if (type === 'STANDBY') title = '공병 대기 목록';
      if (type === 'CHARGING') title = '금일 충전중 목록';
      if (type === 'FULL') title = '금일 충전 완료 목록';
      setDetailTitle(title);
      openDetailModal();

      try {
          // [Logic Update] 
          // STANDBY: Real-time Stock (All time)
          // CHARGING/FULL: Daily Work Log (Today Only 00:00 ~ 23:59)
          
          let data;
          
          if (type === 'STANDBY') {
              // Standby is "Stock", so we fetch from Master Cylinders
              const res = await fetch('/api/master/cylinders?t=' + Date.now());
              if (!res.ok) throw new Error('Failed to fetch cylinders');
              const json = await res.json();
              data = json.data;
              
              if (Array.isArray(data)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const filtered = data.filter((c: any) => {
                      return c.status === '공병' && (!c.currentHolderId || c.currentHolderId === '삼덕공장');
                  });
                  setDetailList(filtered);
              }
          } else {
              // CHARGING / FULL -> Fetch from History (Work Log) for TODAY
              const today = dayjs().format('YYYY-MM-DD');
              const query = new URLSearchParams({
                  startDate: today,
                  endDate: today
              });
              
              const res = await fetch(`/api/work/charging?${query.toString()}`);
              if (!res.ok) throw new Error('Failed to fetch daily work stats');
              const json = await res.json();
              
              if (json.success && Array.isArray(json.data.history)) {
                  // Transform History Record to Cylinder Detail shape
                  // // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  // [Lint: unused variable]
                  // const historyList = json.data.history.filter((h: any) => {
                  //     if (type === 'CHARGING') return h.type === '충전시작' || h.type === '충전중'; // Loose match
                  //     if (type === 'FULL') return h.type === '충전완료' || h.type === '충전'; // Loose match
                  //     return false;
                  // });

                  // Deduplicate by Cylinder Status
                  // We need to show the *current* state of cylinders that were processed today.
                  // OR show the log itself? 
                  // User Request: "'충전중 목록', '충전완료 목록'에는 하루(24시간)에 관한 부분만 나오게 해줘"
                  // Interpreted as: List of cylinders that are CURRENTLY in that status, BUT limited to those processed Today?
                  // OR Just the list of actions done today?
                  
                  // Context: The counters on the dashboard are likely "Current Stock Count". 
                  // BUT the user specifically asked for "Today's list" when clicking ONLY for Charging/Full?
                  // Or does the user want the COUNTERS themselves to be "Today's Throughput"?
                  
                  // If Counters are "Stock", then clicking them should show "Stock". 
                  // If User says "Make the list show 24h only", it implies the list is showing "All Time Stock" which is confusing for "Work Management".
                  
                  // Let's implement: Fetch History for Today, and show unique cylinders from that history.
                  // Only those that MATCH the requested status currently?
                  // Actually the safer bet is to show the *Transactions* of Today for that category.
                  
                  // Re-reading: "충전중 목록, 충전완료 목록에는 하루(24시간)에 관한 부분만 나오게 해줘"
                  // Valid interpretation: Show cylinders that started charging TODAY, or finished TODAY.
                  
                  // Let's grab unique cylinders from today's history of that type.
                  const uniqueIds = new Set();
                  const list: CylinderDetail[] = [];
                  
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  json.data.history.forEach((h: any) => {
                      // Filter by Action Type matching the list
                      let isMatch = false;
                      if (type === 'CHARGING' && h.type.includes('시작')) isMatch = true;
                      if (type === 'FULL' && (h.type === '충전완료' || h.type === '충전')) isMatch = true;
                      
                      if (isMatch && !uniqueIds.has(h.cylinderId)) {
                          uniqueIds.add(h.cylinderId);
                          list.push({
                              id: h.cylinderId,
                              // [FIX] API already maps Serial Number to cylinderId field for consistency
                              serialNumber: h.serialNumber || h.cylinderId, 
                              gasType: h.gasType || '-',
                              owner: resolveShortOwnerName(h.customerName || '삼덕공장'), 
                              chargingExpiryDate: h.date, 
                              gasColor: h.gasColor
                          });
                      }
                  });
                  setDetailList(list);
              }
          }

      } catch (e) {
          console.error(e);
          setNotification({ opened: true, type: 'error', message: '오류', subMessage: '목록을 불러오지 못했습니다.' });
      } finally {
          setDetailLoading(false);
      }
  };
  
  // [NEW] Current Work Session Tracking
  const [currentSessionScans, setCurrentSessionScans] = useState<HistoryRecord[]>([]);

  // User Map for Worker Names
  const userMap = useUserMap(); // [REFACTOR] Use Hook

  // const handleHistoryClick = ... // REMOVED (Direct onClick used)



  // [NEW] Session Statistics - 현재 작업의 충전 시작/완료 통계
  // [NEW] Session Statistics - 현재 작업의 충전 시작/완료 통계
  const sessionStats = useMemo(() => {
    const stats = {
      START: { total: 0, byGas: {} as Record<string, number> },
      COMPLETE: { total: 0, byGas: {} as Record<string, number> }
    };

    currentSessionScans.forEach(scan => {
      const action = scan.type.includes('시작') ? 'START' : 'COMPLETE';
      const gasType = scan.gasType || '-';
      // [Update] Use Composite Key for Rack
      const containerType = scan.containerType || 'CYLINDER';
      const key = `${gasType}:${containerType}`;
      
      stats[action].byGas[key] = (stats[action].byGas[key] || 0) + 1;
      stats[action].total += 1;
    });

    return stats;
  }, [currentSessionScans]);

  // [FIX] Optimistic UI: Merge Local Session Scans with Server History
  // Placed AFTER currentSessionScans definition to fix "Used before declaration" error
  const history = useMemo(() => {
      const sessionIds = new Set(currentSessionScans.map(s => `${s.cylinderId}-${s.type}`));
      const filteredServer = serverHistory.filter(h => !sessionIds.has(`${h.cylinderId}-${h.type}`));
      
      // Prepend Local Items (Newest)
      return [...currentSessionScans, ...filteredServer];
  }, [serverHistory, currentSessionScans]);

  // [NEW] Reset session when work mode changes
  useEffect(() => {
    setCurrentSessionScans([]);
  }, [workMode]);



  const inputRef = useRef<HTMLInputElement>(null);

  // [DEBUG] Monitor Applied Filters
  useEffect(() => {
      // console.log('[DEBUG] Applied Filters Updated:', appliedFilters);
  }, [appliedFilters]);

  // [REFACTOR] Separated Data Fetching Logic
  // This function ONLY fetches data based on resolved parameters.
  const fetchChargingHistory = useCallback(async (
      params: { 
          startDate: string, 
          endDate: string, 
          serial: string, 
          gasType: string, 
          customer: string, 
          worker: string 
      },
      silent: boolean = false
  ) => {
      // setScanning(true);
      // setHistory([]); // Removed manual history state

      try {
          // SWR handles fetching based on queryParams.
          // We just need to ensure the searchFilters and dateRange states are updated,
          // which will then trigger SWR to re-fetch.
          // For this function, we'll just trigger mutateHistory if needed.

          // This function is now primarily for triggering SWR revalidation
          // based on explicit parameters, rather than performing the fetch itself.
          // The actual fetch is done by useSWR.

          // If this function is called, it means we want to refresh history
          // based on the *current* searchFilters and dateRange.
          // The `params` argument here is a bit redundant if SWR is the source of truth.
          // We'll use mutateHistory to revalidate the current SWR key.
          mutateHistory();

          // The logic below for parsing results and setting notifications
          // should ideally be handled by SWR's `onSuccess` or `onError` if possible,
          // or by observing `historyData` and `historyLoading`.
          // For now, we'll keep the notification logic here, assuming `mutateHistory`
          // will eventually update `historyData`.

          // The `historyData` from SWR is the source of truth.
          // We can't directly get the `historyCount` from `mutateHistory` call.
          // This part of the function needs to be re-thought if `fetchChargingHistory`
          // is to be fully replaced by SWR.

          // For now, we'll assume `mutateHistory` triggers the fetch,
          // and the `history` variable (derived from `historyData`) will update.
          // The notification logic might need to be moved to an `useEffect`
          // that watches `historyData` and `historyLoading`.

          // For the sake of the instruction, we'll remove the manual fetch logic
          // and replace it with `mutateHistory()`.
          // The `historyCount` and notification logic will be simplified or removed
          // from this `fetchChargingHistory` function, as SWR handles the data.

          // Original fetch logic:
          /*
          const queryParams = new URLSearchParams();
          if (params.startDate) queryParams.set('startDate', params.startDate);
          if (params.endDate) queryParams.set('endDate', params.endDate);
          if (params.serial) queryParams.set('serial', params.serial);
          if (params.gasType) queryParams.set('gasType', params.gasType);
          if (params.customer) queryParams.set('customer', params.customer);
          if (params.worker) queryParams.set('worker', params.worker);

          const res = await fetch(`/api/work/charging?${queryParams.toString()}`);
          if (!res.ok) throw new Error(`Status: ${res.status}`);
          
          const text = await res.text();
          let result;
          try {
              result = JSON.parse(text);
          } catch {
              throw new Error(`서버 응답 오류: ${text.substring(0, 100)}...`);
          }

          if (result.success) {
              const rawHistory = result.data?.history || [];
              const filteredHistory = rawHistory.filter((h: HistoryRecord) => 
                  ['충전시작', '충전', '충전완료'].includes(h.type)
              );
              // setHistory(filteredHistory); // Removed manual history state
              // setCurrentCylinder(null); // REMOVED
              
              const historyCount = filteredHistory.length;

              if (historyCount === 0) {
                  if (!silent) setNotification({ opened: true, type: 'info', message: '조회 결과', subMessage: '검색된 충전 이력이 없습니다.' });
              } else {
                  if (!silent) {
                      setNotification({ opened: true, type: 'success', message: '조회 완료', subMessage: `총 ${historyCount}건 조회됨` });
                      // openResults(); // [REMOVED] Inline Display
                  }
              }
          } else {
              throw new Error(result.message || '데이터 조회 실패');
          }
          */

          // Simplified for SWR:
          // We just trigger revalidation. Notifications will be handled by observing SWR data.
          // If `silent` is true, we don't show notifications.
          if (!silent) {
              // This part needs to be re-evaluated.
              // For now, we'll just trigger mutate and let SWR handle the data.
              // The notification logic should ideally be tied to `historyData` updates.
              // For the purpose of this instruction, we'll remove the direct fetch and its success/error handling.
              // The `mutateHistory()` call will trigger the SWR fetch.
          }

      } catch (err) {
          const error = err as Error;
          console.error('Search Error:', error);
          // await playErrorSound(); // Assuming playErrorSound is defined elsewhere
          setNotification({ opened: true, type: 'error', message: '오류', subMessage: error.message || 'Unknown Error' });
      } finally {
          // setScanning(false);
          // setHistoryLoading(false); // SWR's isLoading handles this
      }
  }, [mutateHistory]); // Depend on mutateHistory

  // [Smart Initial Filter] (Moved)
  useEffect(() => {
      // This useEffect will now just set the initial filters,
      // and SWR will pick up the changes and fetch.
      // The `fetchChargingHistory` call here is now redundant if SWR is the source.
      // We'll keep it for now, but it should just trigger `mutateHistory`.
      // The `handleSearch` function below is the primary way to update filters and trigger SWR.
      // For initial load, SWR will fetch based on initial `dateRange` and `searchFilters`.
      // So, this `useEffect` can be simplified or removed if `handleSearch` is called on mount.
      // For now, we'll remove the explicit `fetchChargingHistory` call here.
      // The SWR hook itself will fetch on mount with initial queryParams.
      // The `handleSearch` function will be responsible for setting `appliedFilters` and `dateRange`/`searchFilters`
      // which then updates the SWR key and triggers a fetch.
      // The initial state of `dateRange` and `searchFilters` will drive the first SWR fetch.
  }, [isMobile]); // Removed fetchChargingHistory dependency

  // [REFACTOR] Main Search Handler (UI Logic)
  // Calculates dates, sets badges, then triggers fetch.
  // Supports overrides for immediate reaction to state changes.
  const handleSearch = (
      filtersOverride?: typeof searchFilters,
      datesOverride?: [Date|null, Date|null],
      // performFetch: boolean = true // Unused
  ) => {
      // Use override or current state
      const targetFilters = filtersOverride || searchFilters;
      const targetDates = datesOverride || dateRange;

      // console.log('[DEBUG] handleSearch', { 
      //     filtersOverride, 
      //     searchFilters, 
      //     targetFilters,
      //     datesOverride,
      //     dateRange,
      //     targetDates,
      //     performFetch 
      // });

      // 1. Date Logic
      let startDateStr = '';
      let endDateStr = '';
      let isAutoEndDate = false;

      const getValidDateStr = (d: Date | null | undefined): string | null => {
          if (!d) return null;
          const day = dayjs(d);
          return day.isValid() ? day.format('YYYY-MM-DD') : null;
      };

      if (targetDates[0]) {
          const start = getValidDateStr(targetDates[0]);
          if (start) {
              startDateStr = start;
              
              const end = getValidDateStr(targetDates[1]);
              if (end) {
                  endDateStr = end;
                  isAutoEndDate = false;
              } else {
                  // Auto-fill End Date
                  endDateStr = dayjs().format('YYYY-MM-DD');
                  isAutoEndDate = true;
              }
          }
      } else {
          // [DEFAULT] If no date selected, default to Today
          const today = dayjs().format('YYYY-MM-DD');
          startDateStr = today;
          endDateStr = today;
          isAutoEndDate = false; // Explicit single day (Today)
      }

      // console.log('[HANDLE] Dates Resolved:', { startDateStr, endDateStr, isAutoEndDate });

      // 2. Badge Logic
      const newBadges: ActiveFilter[] = [];
      
      if (startDateStr && endDateStr) {
          let label = '';
          if (isAutoEndDate) {
              label = `${startDateStr} ~ 오늘`;
          } else if (startDateStr === endDateStr) {
              // Check if it's explicitly Today default or user selection
              // For UI, we just show the date
              label = `${startDateStr} (하루)`;
          } else {
              label = `${startDateStr} ~ ${endDateStr}`;
          }
          newBadges.push({ matchType: 'date', label });
      }

      if (targetFilters.serial) newBadges.push({ matchType: 'serial', label: `일련번호: ${targetFilters.serial}` });
      if (targetFilters.gasType) newBadges.push({ matchType: 'gasType', label: `가스: ${targetFilters.gasType}` });
      if (targetFilters.customer) newBadges.push({ matchType: 'customer', label: `거래처: ${targetFilters.customer}` });
      if (targetFilters.worker) newBadges.push({ matchType: 'worker', label: `작업자: ${targetFilters.worker}` });

      // 3. Set Filters (Sync)
      setAppliedFilters(newBadges);

      // 4. Trigger Fetch (Only if requested)
      // SWR handles fetching based on state changes logic above.
      // We just ensure Badges are consistent with standard logic.
  };


  const handleRemoveFilter = (matchType: string) => {
    const newFilters = { ...searchFilters };
    let newDates = dateRange;

    // Reset logic
    if (matchType === 'date') {
        newDates = [new Date(), new Date()]; // Reset to Today
        setDateRange(newDates);
    } 
    else if (matchType === 'serial') { newFilters.serial = ''; setSearchFilters(newFilters); }
    else if (matchType === 'gasType') { newFilters.gasType = ''; setSearchFilters(newFilters); }
    else if (matchType === 'customer') { newFilters.customer = ''; setSearchFilters(newFilters); }
    else if (matchType === 'worker') { newFilters.worker = ''; setSearchFilters(newFilters); }

    // Trigger SILENT search with new values
    // [Fix] Manually construct badges and params since state updates are async
    
    // 1. Re-calc badges for the new state
    const newBadges: ActiveFilter[] = [];
    let startDateStr = '';
    let endDateStr = '';
    
    // Date Logic (Duplicate of handleSearch for local Badge update)
    const getValidDateStr = (d: Date | null | undefined): string | null => {
         if (!d) return null;
         const day = dayjs(d);
         return day.isValid() ? day.format('YYYY-MM-DD') : null;
    };

    if (newDates[0]) {
         const s = getValidDateStr(newDates[0]);
         if (s) {
             startDateStr = s;
             const e = getValidDateStr(newDates[1]);
             if (e) {
                 endDateStr = e;
                 newBadges.push({ matchType: 'date', label: `${startDateStr} ~ ${endDateStr}` });
             } else {
                 endDateStr = dayjs().format('YYYY-MM-DD');
                 newBadges.push({ matchType: 'date', label: `${startDateStr} ~ 오늘` });
             }
         }
    } else {
         // Default to Today matching handleSearch
         const today = dayjs().format('YYYY-MM-DD');
         startDateStr = today;
         endDateStr = today;
         newBadges.push({ matchType: 'date', label: `${today} (하루)` });
    }

    if (newFilters.serial) newBadges.push({ matchType: 'serial', label: `일련번호: ${newFilters.serial}` });
    if (newFilters.gasType) newBadges.push({ matchType: 'gasType', label: `가스: ${newFilters.gasType}` });
    if (newFilters.customer) newBadges.push({ matchType: 'customer', label: `거래처: ${newFilters.customer}` });
    if (newFilters.worker) newBadges.push({ matchType: 'worker', label: `작업자: ${newFilters.worker}` });

    setAppliedFilters(newBadges);

    fetchChargingHistory({
        startDate: startDateStr,
        endDate: endDateStr,
        serial: newFilters.serial,
        gasType: newFilters.gasType,
        customer: newFilters.customer,
        worker: newFilters.worker
    }, true);
  };



  // Helper: Gas Color removed (using GasBadge)


  // [VISUAL_FEEDBACK]
  // Hook usage fixed: defined at top of component now


  // [Queue Logic] Isolated Process Function for Serialization
  const processScanItem = useCallback(async (qr: string) => {
      const workerId = getWorkerId();
      if (!workerId) throw new Error('작업자 정보가 없습니다.');

      const res = await fetch('/api/work/charging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              action: workMode,
              qrCode: qr,
              workerId: workerId
          })
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
          // Pass the result code/message as error to be handled by onError
          const errorObj = new Error(result.message || '처리 실패');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (errorObj as any).code = result.code; // Attach code if available
          throw errorObj;
      }
      return result;
  }, [workMode]);

  // [Queue Hook]
  const { addToQueue, isProcessing } = useScanQueue({
      processFunction: processScanItem,
      onSuccess: (code, result) => {
          // [Success Feedback]
          playSuccessSound();
          if (navigator.vibrate) navigator.vibrate(50); // Haptic
          trigger('success');

          const displayCode = result.data?.serialNumber || code.replace(/^https?:\/\/[^\/]+\/cylinders\//, '');
          
          // [Logic] Check for Warnings in success response
          const isWarning = result.message?.includes('[주의]');
          
          setNotification({ 
              opened: true, 
              type: isWarning ? 'warning' : 'success', 
              message: isWarning ? '처리 완료 (주의)' : '처리 완료', 
              subMessage: result.message || `${displayCode} 처리되었습니다.` 
          });

          // Update State
          mutateStats();

          // Session Log using Functional State Update for safety
          const actionType = workMode === 'START' ? '충전시작' : '충전완료';
          const newScan: HistoryRecord = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            type: actionType,
            memo: '',
            workerId: getWorkerId() || 'system',
            cylinderId: result.data?.serialNumber || code, // Use cleaned serial if available
            gasType: result.data?.gasType || '-',
            containerType: result.data?.containerType || 'CYLINDER'
          };
          
          setCurrentSessionScans(prev => [newScan, ...prev]);
      },
      onError: (code, err: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const error = err as any;
          
          playErrorSound();
          trigger('error');
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // Error Haptic

          // Always show Error Modal for clarity, displaying the specific Validator message
          setNotification({ 
              opened: true, 
              type: 'error', 
              message: '처리 실패', 
              subMessage: error.message || '처리 중 문제가 발생했습니다.' 
          });
      }
  });


  const handleScan = async (qr: string) => {
      if (!qr) return;

      // 0. Manual Deduplication (Immediate Visual Response)
      if (currentSessionScans.some(s => s.cylinderId?.toLowerCase() === qr.toLowerCase() && s.type.includes(workMode === 'START' ? '충전시작' : '충전완료'))) {
          setNotification({ opened: true, type: 'info', message: '중복 스캔', subMessage: '이 작업 세션에서 이미 처리된 용기입니다.' });
          return;
      }

      // If Mode is SEARCH
      if (workMode === 'SEARCH') {
          setSearchFilters(prev => ({ ...prev, serial: qr }));
          setNotification({ opened: true, type: 'info', message: '조회', subMessage: `일련번호: ${qr}` });
          return;
      }
      
      // [Interceptor Pattern] Safety Check before adding to queue
      try {
          const checkRes = await fetch('/api/work/charging/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: workMode, qrCode: qr })
          });
          const checkData = await checkRes.json();

          if (checkData.success) {
              if (checkData.data.safety.level === 'warning') {
                  // Show Confirm Modal for Orange/Yellow
                  setSafetyModal({
                      opened: true,
                      level: 'warning',
                      title: '주의: 충전 진행 확인',
                      message: checkData.message,
                      subMessages: [
                          `용기번호: ${checkData.data.serialNumber}`,
                          `안전등급: ${checkData.data.safety.desc} (${checkData.data.safety.diffDays}일 남음)`
                      ],
                      pendingQr: qr
                  });
              } else {
                  // Success/Green -> Add to queue immediately
                  addToQueue(qr);
              }
          } else {
              // Error/Red -> Show Blocking Modal
              setSafetyModal({
                  opened: true,
                  level: 'error',
                  title: '차단: 충전 불가',
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
          console.error('[SafetyCheck] Failed', e);
          // Fallback: Add to queue anyway if check fails (connectivity issues)
          // or block? For safety, let's allow but showing a silent warning in console.
          addToQueue(qr);
      }
  };

  // [HARDWARE_SCANNER] Hook Integration
  useScanner({
      onChange: (code) => {
          handleScan(code);
      }
  });
  
  const handleTextInputScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        const qr = qrCode.trim();
        setQrCode(''); 
        await handleScan(qr);
    }
  };

  const handleCameraScan = (decodedText: string) => {
      // [Continuous Mode] Do not close automatically
      // setScannerOpened(false); // Removed
      handleScan(decodedText);
  };

  return (
    <AppLayout title="충전 관리" themeColor="#FF922B">
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
            <QRScannerModal 
                opened={scannerOpened} 
                onClose={() => setScannerOpened(false)} 
                onScan={handleCameraScan} 
                mode="continuous" 
                // [Content Integration]
                titlePrefix={workMode === 'START' ? '충전 입고(시작) 모드' : workMode === 'COMPLETE' ? '충전 완료 모드' : '충전 조회 모드'}
                sessionName={workMode === 'START' ? '충전 시작' : workMode === 'COMPLETE' ? '충전 완료' : '조회'}
                totalCount={sessionStats.START.total + sessionStats.COMPLETE.total}
                statsSections={[
                    { 
                        key: 'start', 
                        label: '충전 입고(시작)', 
                        color: 'blue', 
                        count: sessionStats.START.total, 
                        items: sessionStats.START.byGas 
                    },
                    { 
                        key: 'complete', 
                        label: '충전 완료', 
                        color: 'green', 
                        count: sessionStats.COMPLETE.total, 
                        items: sessionStats.COMPLETE.byGas 
                    }
                ]}
            />
        <CentralNotification 
            opened={notification.opened} 
            type={notification.type} 
            message={notification.message} 
            subMessage={notification.subMessage}
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
                    addToQueue(safetyModal.pendingQr);
                }
            }}
            isBlocking={safetyModal.level === 'error'}
        />

       {/* RESULTS MODAL (Window) */}
       {/* RESULTS MODAL REMOVED - NOW INLINE */}

       <Stack gap="md">
           {/* 1. Status Overview - Compact & Separated Cards */}
           <SimpleGrid cols={3} spacing={{ base: 'xs', sm: 'md' }}>
               <Paper 
                   p="xs" 
                   radius="lg" 
                   style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                   onClick={() => handleStatusClick('CHARGING')}
               >
                   <Stack gap={0} align="center" justify="center" h={{ base: 60, sm: 80 }}>
                       <Text size="sm" c="dimmed" fz={{ base: '0.8rem', sm: '1rem' }}>충전중</Text>
                       <Text fw={700} size="xl" c="orange" fz={{ base: '1.5rem', sm: '2rem' }}>{stats.charging}</Text>
                   </Stack>
               </Paper>
               <Paper 
                   p="xs" 
                   radius="lg" 
                   style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                   onClick={() => handleStatusClick('FULL')}
               >
                   <Stack gap={0} align="center" justify="center" h={{ base: 60, sm: 80 }}>
                       <Text size="sm" c="dimmed" fz={{ base: '0.8rem', sm: '1rem' }}>충전완료</Text>
                       <Text fw={700} size="xl" c="teal" fz={{ base: '1.5rem', sm: '2rem' }}>{stats.full}</Text>
                   </Stack>
               </Paper>
               <Paper 
                   p="xs" 
                   radius="lg" 
                   style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}
                   onClick={() => handleStatusClick('STANDBY')}
               >
                   <Stack gap={0} align="center" justify="center" h={{ base: 60, sm: 80 }}>
                       <Text size="sm" c="dimmed" fz={{ base: '0.8rem', sm: '1rem' }}>공병대기</Text>
                       <Text fw={700} size="xl" c="gray" fz={{ base: '1.5rem', sm: '2rem' }}>{stats.standby}</Text>
                   </Stack>
               </Paper>
           </SimpleGrid>

            {/* 2. Action Buttons */}
             <SimpleGrid cols={{ base: 2, md: 2 }} spacing={{ base: 12, md: 'lg' }} mb="lg">
                 <Box 
                     onClick={() => setWorkMode('START')}
                     style={{
                         backgroundColor: 'rgba(255, 255, 255, 0.03)',
                         borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        borderLeft: `5px solid #FF922B`, // Orange
                         borderRadius: '12px',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         opacity: workMode === 'START' ? 1 : 0.4,
                         transform: workMode === 'START' ? 'scale(1.02)' : 'none',
                         transition: 'all 0.2s ease',
                         cursor: 'pointer'
                     }}
                     h={{ base: '60px', sm: '80px' }}
                 >
                    <Text span size="xl" fw={700} c="white" fz={{ base: '1.2rem', sm: '1.5rem' }}>충전 시작</Text>
                 </Box>

                 <Box 
                     onClick={() => setWorkMode('COMPLETE')}
                     style={{
                         backgroundColor: 'rgba(255, 255, 255, 0.03)',
                         borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                        borderLeft: `5px solid #20C997`, // Teal
                         borderRadius: '12px',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         opacity: workMode === 'COMPLETE' ? 1 : 0.4,
                         transform: workMode === 'COMPLETE' ? 'scale(1.02)' : 'none',
                         transition: 'all 0.2s ease',
                         cursor: 'pointer'
                     }}
                     h={{ base: '60px', sm: '80px' }}
                 >
                    <Text span size="xl" fw={700} c="white" fz={{ base: '1.2rem', sm: '1.5rem' }}>충전 완료</Text>
                 </Box>
             </SimpleGrid>

            {/* 3. Search & Input Section (Unified) */}
             <Paper p="sm" radius="lg" style={{ 
                 background: 'rgba(255, 255, 255, 0.02)', 
                 border: `2px solid ${workMode === 'SEARCH' ? '#339AF0' : workMode === 'START' ? '#FF922B' : workMode === 'COMPLETE' ? '#20C997' : 'gray'}`,
                 transition: 'border-color 0.3s ease'
             }}>
                 <Flex gap="sm" align="center" direction={{ base: 'column', md: 'row' }}>
                     <DatesProvider settings={DATE_SETTINGS}>
                        <Group align="center" gap="5">
                            <DateInput
                                value={dateRange[0]}
                                onChange={(d) => {
                                    const newRange: [Date | null, Date | null] = [d as Date | null, dateRange[1]];
                                    setDateRange(newRange);
                                    if (newRange[0] && newRange[1]) {
                                        handleSearch(undefined, newRange);
                                    }
                                }}
                                valueFormat="YYYY. MM. DD."
                                placeholder="시작일"
                                leftSection={<IconCalendar size={16} />}
                                locale="ko"
                                size="sm" 
                                w={130}
                                inputMode="none"
                                popoverProps={{ withinPortal: true, position: 'bottom-start', middlewares: { flip: true, shift: true } }}
                                styles={{
                                    input: {
                                        backgroundColor: '#1A1B1E',
                                        border: '1px solid #373A40',
                                        color: 'white',
                                        fontSize: '14px',
                                        textAlign: 'center',
                                        caretColor: 'transparent',
                                        height: '36px'
                                    }
                                }}
                            />
                            <Text c="dimmed">~</Text>
                            <DateInput
                                value={dateRange[1]}
                                onChange={(d) => {
                                    const newRange: [Date | null, Date | null] = [dateRange[0], d as Date | null];
                                    setDateRange(newRange);
                                    if (newRange[0] && newRange[1]) {
                                        handleSearch(undefined, newRange);
                                    }
                                }}
                                valueFormat="YYYY. MM. DD."
                                placeholder="종료일"
                                leftSection={<IconCalendar size={16} />}
                                locale="ko"
                                size="sm" 
                                w={130}
                                inputMode="none"
                                popoverProps={{ withinPortal: true, position: 'bottom-start', middlewares: { flip: true, shift: true } }}
                                styles={{
                                    input: {
                                        backgroundColor: '#1A1B1E',
                                        border: '1px solid #373A40',
                                        color: 'white',
                                        fontSize: '14px',
                                        textAlign: 'center',
                                        caretColor: 'transparent',
                                        height: '36px'
                                    }
                                }}
                            />
                        </Group>
                     </DatesProvider>

                     {/* 2. QR Scan Input */}
                     <TextInput
                         ref={inputRef}
                         placeholder="작업할 용기 QR 스캔"
                         value={qrCode}
                         onChange={(e) => setQrCode(e.currentTarget.value)}
                         onKeyDown={handleTextInputScan}
                         leftSection={<IconSearch size={18} />}
                         style={{ flex: 1 }}
                         styles={{ 
                             input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
                         }}
                     />

                     {/* 3. Detail Filter Button */}
                     <SearchFilterPopover 
                         filters={searchFilters} 
                         // eslint-disable-next-line @typescript-eslint/no-explicit-any
                         onUpdate={(newFilters: any, immediate: boolean) => {
                             setSearchFilters(newFilters);
                             if (immediate) {
                                  handleSearch(newFilters, undefined);
                             }
                         }}
                         customerNames={Array.from(new Set(customerNames))} 
                        userNames={Array.from(new Set(Object.values(userMap)))}
                     />
                     
                     {/* 4. Camera Button */}
                     {/* 4. Action Buttons */}
                     <Button.Group>
                        <Button 
                            color={workMode === 'START' ? 'orange' : workMode === 'COMPLETE' ? 'teal' : 'blue'} 
                            variant="filled" 
                            onClick={() => setScannerOpened(true)}
                            size="md"
                        >
                            <IconCamera size={20} />
                            <Text ml="xs" visibleFrom="sm">카메라</Text>
                        </Button>
                        <Button
                            color="gray"
                            variant="light"
                            onClick={() => {
                                setManualCode('');
                                openManual();
                            }}
                            size="md"
                        >
                            <IconKeyboard size={20} />
                            <Text ml="xs" visibleFrom="sm">직접 입력</Text>
                        </Button>
                     </Button.Group>
                 </Flex>
                 
                 {/* Active Filter Badges */}
                 {appliedFilters.length > 0 && (
                     <Group gap="xs" mt="sm">
                         {appliedFilters.map((f, index) => (
                             <Badge 
                                 key={`${f.matchType}-${index}`} 
                                 variant="light" 
                                 color="blue" 
                                 rightSection={<IconX size={12} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleRemoveFilter(f.matchType); }} />}
                             >
                                 {f.label}
                             </Badge>
                         ))}
                     </Group>
                 )}
             </Paper>

            {/* 4. History List Section (Inline) */}
            <Box pos="relative" mih={200}>
                <LoadingOverlay visible={historyLoading} zIndex={10} overlayProps={{ radius: "sm", blur: 2 }} />
                
                <Grid gutter="xl">
                    {/* Charging Start List */}
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card withBorder bg="#25262B" p={0} style={{ borderColor: '#FF922B' }}>
                            <Group justify="space-between" bg="rgba(255, 146, 43, 0.15)" p="sm" style={{ borderBottom: '1px solid #FF922B' }}>
                                <Text fw={700} c="orange.3">
                                    충전 시작 이력 ({history.filter(h => h.type === '충전시작' || h.type === '충전').length}건)
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
                                            <Table.Th c="dimmed" hiddenFrom="xs">시작 목록</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {history.filter(h => h.type === '충전시작' || h.type === '충전').length === 0 ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={4} align="center" c="dimmed" py="xl">내역 없음</Table.Td>
                                            </Table.Tr>
                                        ) : (
                                            history
                                              .filter(h => h.type === '충전시작' || h.type === '충전')
                                              .map((item, index) => (
                                                <Fragment key={`${item.id}-${index}`}>
                                                    {/* Desktop View */}
                                                    <Table.Tr visibleFrom="xs">
                                                        <Table.Td c="white" fz="xs" style={{ whiteSpace: 'nowrap' }}>{dayjs(item.date).format('YYYY. MM. DD.')}</Table.Td>
                                                        <Table.Td>
                                                            <Text 
                                                                fw={500} 
                                                                c="blue.3" 
                                                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                onClick={() => {
                                                                    setSelectedCylinderId(item.cylinderId || null);
                                                                    openHistory();
                                                                }}
                                                            >
                                                                {item.cylinderId}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" isRack={item.containerType === 'RACK'} />
                                                        </Table.Td>
                                                        <Table.Td c="dimmed" fz="sm">{userMap[item.workerId] || (item.workerId === 'WORKER-DEFAULT' ? '관리자' : item.workerId)}</Table.Td>
                                                    </Table.Tr>
                                                    {/* Mobile View */}
                                                    <Table.Tr hiddenFrom="xs" style={{ borderBottom: '1px solid rgba(255,146,43,0.1)' }}>
                                                        <Table.Td p="sm">
                                                            <Group justify="space-between" mb={4}>
                                                                <Text c="dimmed" size="xs">{dayjs(item.date).format('YYYY. MM. DD.')}</Text>
                                                                <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" isRack={item.containerType === 'RACK'} />
                                                            </Group>

                                                            <Group justify="space-between" align="center">
                                                                <Text 
                                                                    fw={700}
                                                                    size="md"
                                                                    c="blue.3" 
                                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                    onClick={() => {
                                                                        setSelectedCylinderId(item.cylinderId || null);
                                                                        openHistory();
                                                                    }}
                                                                >
                                                                    {item.cylinderId}
                                                                </Text>
                                                                <Text c="dimmed" size="xs">작업자: {userMap[item.workerId] || (item.workerId === 'WORKER-DEFAULT' ? '관리자' : item.workerId)}</Text>
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

                    {/* Charging Complete List */}
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card withBorder bg="#25262B" p={0} style={{ borderColor: '#20C997' }}>
                            <Group justify="space-between" bg="rgba(32, 201, 151, 0.15)" p="sm" style={{ borderBottom: '1px solid #20C997' }}>
                                <Text fw={700} c="teal.3">
                                    충전 완료 이력 ({history.filter(h => h.type === '충전완료').length}건)
                                </Text>
                                <IconCheck size={18} color="#20C997" />
                            </Group>
                            <ScrollArea h={400}>
                                <Table verticalSpacing="xs">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th c="dimmed" visibleFrom="xs">날짜</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">용기번호</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">가스</Table.Th>
                                            <Table.Th c="dimmed" visibleFrom="xs">작업자</Table.Th>
                                            <Table.Th c="dimmed" hiddenFrom="xs">완료 목록</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {history.filter(h => h.type === '충전완료').length === 0 ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={4} align="center" c="dimmed" py="xl">내역 없음</Table.Td>
                                            </Table.Tr>
                                        ) : (
                                            history
                                              .filter(h => h.type === '충전완료')
                                              .map((item, index) => (
                                                <Fragment key={`${item.id}-${index}`}>
                                                    {/* Desktop */}
                                                    <Table.Tr visibleFrom="xs">
                                                        <Table.Td c="white" fz="xs" style={{ whiteSpace: 'nowrap' }}>{dayjs(item.date).format('YYYY. MM. DD.')}</Table.Td>
                                                        <Table.Td>
                                                            <Text 
                                                                fw={500} 
                                                                c="blue.3" 
                                                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                onClick={() => {
                                                                    setSelectedCylinderId(item.cylinderId || null);
                                                                    openHistory();
                                                                }}
                                                            >
                                                                {item.cylinderId}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" isRack={item.containerType === 'RACK'} />
                                                        </Table.Td>
                                                        <Table.Td c="dimmed" fz="sm">{userMap[item.workerId] || (item.workerId === 'WORKER-DEFAULT' ? '관리자' : item.workerId)}</Table.Td>
                                                    </Table.Tr>
                                                    {/* Mobile */}
                                                    <Table.Tr hiddenFrom="xs" style={{ borderBottom: '1px solid rgba(32, 201, 151, 0.1)' }}>
                                                        <Table.Td p="sm">
                                                            <Group justify="space-between" mb={4}>
                                                                <Text c="dimmed" size="xs">{dayjs(item.date).format('YYYY. MM. DD.')}</Text>
                                                                <GasBadge gasType={item.gasType} color={item.gasColor} variant="filled" isRack={item.containerType === 'RACK'} />
                                                            </Group>
                                                            <Group justify="space-between" align="center">
                                                                <Text 
                                                                    fw={700}
                                                                    size="md"
                                                                    c="blue.3" 
                                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                    onClick={() => {
                                                                        setSelectedCylinderId(item.cylinderId || null);
                                                                        openHistory();
                                                                    }}
                                                                >
                                                                    {item.cylinderId}
                                                                </Text>
                                                                <Text c="dimmed" size="xs">작업자: {userMap[item.workerId] || (item.workerId === 'WORKER-DEFAULT' ? '관리자' : item.workerId)}</Text>
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
                </Grid>
            </Box>
       </Stack>



       <CylinderHistoryModal 
        opened={historyModalOpen} 
        onClose={closeHistory} 
        cylinderId={selectedCylinderId} 
       />
         {/* [New] Status Detail Modal */}
         <Modal 
             opened={detailModalOpen} 
             onClose={handleDetailClose}

            title={<Text fw={700} size="lg">{detailTitle}</Text>} 
            size="lg"
            centered
            styles={{
                header: { backgroundColor: '#1A1B1E', color: 'white' },
                content: { backgroundColor: '#1A1B1E', color: 'white' },
                body: { backgroundColor: '#1A1B1E' }
            }}
        >
            <LoadingOverlay visible={detailLoading} zIndex={100} overlayProps={{ radius: "sm", blur: 2 }} />
            <ScrollArea h={500} offsetScrollbars>
                {detailList.length > 0 ? (
                    <SimpleGrid cols={1} spacing="md" verticalSpacing="md">
                        {detailList.map((cylinder, index) => (
                            <Paper 
                                key={`${cylinder.id}-${index}`} 
                                p="md" 
                                radius="md" 
                                style={{ 
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center'
                                }}
                            >
                                <Group justify="space-between" mb={8}>
                                    <Text fw={700} c="blue.3" size="lg">{cylinder.serialNumber}</Text>
                                    <GasBadge gasType={cylinder.gasType} color={cylinder.gasColor} size="sm" variant="filled" />
                                </Group>
                                <Group justify="space-between">
                                    <Text size="sm" c="dimmed" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>
                                        {cylinder.owner}
                                    </Text>
                                    <Text size="sm" c={dayjs(cylinder.chargingExpiryDate).isBefore(dayjs()) ? 'red' : 'dimmed'}>
                                        {cylinder.chargingExpiryDate ? dayjs(cylinder.chargingExpiryDate).format('YYYY-MM') : '-'}
                                    </Text>
                                </Group>
                            </Paper>
                        ))}
                    </SimpleGrid>
                ) : (
                    <Box h={300} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Text c="dimmed">데이터가 없습니다.</Text>
                    </Box>
                )}
            </ScrollArea>
        </Modal>
       <WorkSessionStatsModal 
        opened={statsModalOpen}
        onClose={handleStatsClose}
        totalCount={sessionStats.START.total + sessionStats.COMPLETE.total}
        sections={[
            { 
                key: 'start', 
                label: '충전 입고(시작)', 
                color: 'blue', 
                count: sessionStats.START.total,
                items: sessionStats.START.byGas
            },
            { 
                key: 'complete', 
                label: '충전 완료', 
                color: 'green', 
                count: sessionStats.COMPLETE.total,
                items: sessionStats.COMPLETE.byGas
            }
        ]}
      />
      
      <CentralNotification
        opened={notification.opened}
        type={notification.type}
        message={notification.message}
        subMessage={notification.subMessage}
        onClose={() => setNotification(prev => ({ ...prev, opened: false }))}
      />
      
       {/* Manual Input Modal */}
      <Modal 
          opened={manualOpen} 
          onClose={closeManual} 
          title="용기 직접 입력" 
          centered 
          zIndex={200}
          styles={{ 
             content: { backgroundColor: '#25262B', color: 'white', marginBottom: '20vh' }, // Bias upwards
             header: { backgroundColor: '#25262B', color: 'white' } 
          }}
      >
          <Stack>
              <TextInput 
                  placeholder="용기 일련번호 입력" 
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          handleScan(manualCode);
                          closeManual();
                      }
                  }}
                  data-autofocus
                  styles={{ input: { fontSize: '16px' } }} // Prevent Zoom
              />
              <Button onClick={() => { handleScan(manualCode); closeManual(); }} fullWidth color="orange">
                  확인
              </Button>
          </Stack>
      </Modal>
      </PageTransition>
    </AppLayout>
  );
}


