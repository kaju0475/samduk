"use client";

import { AppLayout } from "@/components/Layout/AppLayout";
import {
  Paper,
  Text,
  Group,
  Button,
  Table,
  Badge,
  Modal,
  TextInput,
  ScrollArea,
  Stack,
  Box,
  Flex,
  ActionIcon,
  Pagination,
  Center,
  Checkbox,
  SimpleGrid,
} from "@mantine/core";
import { useDisclosure, useDebouncedValue } from "@mantine/hooks";
import { IconSearch, IconPlus, IconQrcode, IconTrash, IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react';
import { GasBadge } from '@/components/Common/GasBadge';
import { useState, useEffect, useCallback, useMemo, Suspense, Fragment } from "react";
import { useSmartPolling } from '@/app/hooks/useSmartPolling';
import { notifications } from "@mantine/notifications";
import { Cylinder, Customer } from "@/lib/types";
import { TransactionValidator } from "@/lib/transaction-validator";
import { NewRegistrationForm } from "@/components/Cylinders/NewRegistrationForm";

import { CylinderHistoryModal } from "@/components/History/CylinderHistoryModal";
// import { CylinderQRModal } from "@/components/Common/CylinderQRModal"; // Static import removed
import dynamic from 'next/dynamic';

const CylinderQRModal = dynamic(
  () => import('@/components/Common/CylinderQRModal').then(mod => mod.CylinderQRModal),
  { ssr: false }
);
import { formatExpiryDate, resolveShortHolderName, resolveShortOwnerName } from '@/app/utils/display';
import { getKoreanGasName } from '@/app/utils/gas'; // [NEW] Import

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useModalBackTrap } from "@/app/hooks/useModalBackTrap";

function CylinderMasterContent() { 
  const [cylinders, setCylinders] = useState<Cylinder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);
  const [pageSize, setPageSize] = useState<number>(20); // Pagination
  const [activePage, setActivePage] = useState(1);
  const [totalCount, setTotalCount] = useState(0); // [New] Total records from server

  // [Sorting State]
  type SortDirection = 'asc' | 'desc' | null;
  type SortField = 'serialNumber' | 'gasType' | 'capacity' | 'location' | 'status' | 'expiryDate' | 'owner' | null;
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    // Reset to page 1 when sorting changes
    setActivePage(1);
  }, [sortField, sortDirection]);

  // Sortable Header Component
  const SortableHeader = ({ field, label, style }: { field: SortField; label: string | React.ReactNode; style?: React.CSSProperties }) => (
    <Table.Th 
      style={{ 
        ...style, 
        cursor: 'pointer', 
        userSelect: 'none',
        color: sortField === field ? '#228be6' : '#fff',
        transition: 'color 0.2s'
      }}
      onClick={() => handleSort(field)}
    >
      <Group gap={4} wrap="nowrap">
        <span>{label}</span>
        {sortField === field ? (
          sortDirection === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />
        ) : (
          <IconArrowsSort size={14} style={{ opacity: 0.3 }} />
        )}
      </Group>
    </Table.Th>
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filter Type is directly from URL
  const filterType = (searchParams.get('filter') || 'ALL').toUpperCase();

  const [opened, { open, close }] = useDisclosure(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [printTarget, setPrintTarget] = useState<Cylinder | null>(null);
  
  // History Modal State
  const [historyModalOpen, { open: openHistory, close: closeHistory }] = useDisclosure(false);
  const [qrModalOpen, { open: openQrModal, close: closeQrModal }] = useDisclosure(false);
  const [selectedCylinderId, setSelectedCylinderId] = useState<string | null>(null); // For History
  
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
          const sessionUser = sessionStorage.getItem('currentUser');
          const localUser = localStorage.getItem('currentUser');
          let user = null;
          
          if (sessionUser) {
              try { user = JSON.parse(sessionUser); } catch {}
          } else if (localUser) {
              try { user = JSON.parse(localUser); } catch {}
          }

          if (user) {
              if (user.role === '관리자' || user.role === 'ADMIN') {
                  setIsAdmin(true);
              }
          } else {
              router.replace('/auth/login');
          }
    }
  }, [router]);

  // Back Button Logic
  const handleCloseCreate = useModalBackTrap(opened, close, 'create-cylinder');

  const updateFilter = (newFilter: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newFilter === 'ALL') {
         params.delete('filter');
      } else {
         params.set('filter', newFilter);
      }
      // Reset to page 1 on filter change
      setActivePage(1);
      router.replace(`${pathname}?${params.toString()}`);
  };



  const handleQrClick = (cylinder: Cylinder, e: React.MouseEvent) => {
      e.stopPropagation();
      setPrintTarget(cylinder);
      openQrModal();
  };

  // [Server-Side Fetch]
  const fetchCylinders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', activePage.toString());
      params.set('pageSize', pageSize.toString());
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterType !== 'ALL') params.set('filter', filterType);
      // [NEW] Server-side sorting
      if (sortField) params.set('sortField', sortField);
      if (sortDirection) params.set('sortDirection', sortDirection);

      const [cylRes, custRes] = await Promise.all([
          fetch(`/api/master/cylinders?${params.toString()}`, { cache: 'no-store' }),
          fetch("/api/master/customers", { cache: 'no-store' })
      ]);
      
      if (!cylRes.ok || !custRes.ok) throw new Error('Failed to fetch data');

      const cylData = await cylRes.json();
      const custData = await custRes.json();

      if (cylData.success) {
        setCylinders(cylData.data);
        if (cylData.pagination) {
            setTotalCount(cylData.pagination.total);
        }
      }
      if (custData.success) {
         setCustomers(custData.data);
      }
    } catch (e) {
      console.error(e);
      notifications.show({
        title: "오류",
        message: "데이터를 불러오지 못했습니다.",
        color: "red",
      });
    }
  }, [activePage, pageSize, debouncedSearch, filterType, sortField, sortDirection]);

  // [Smart Sync] Polling uses current params (including sort)
  const pollCylinders = useCallback(async () => {
    if (searchTerm) return; // Skip if typing

    try {
      const params = new URLSearchParams();
      params.set('page', activePage.toString());
      params.set('pageSize', pageSize.toString());
      if (filterType !== 'ALL') params.set('filter', filterType);
      // Include sort params for consistent sorting during polling
      if (sortField) params.set('sortField', sortField);
      if (sortDirection) params.set('sortDirection', sortDirection);

      const [cylRes, custRes] = await Promise.all([
          fetch(`/api/master/cylinders?${params.toString()}`, { cache: 'no-store' }),
          fetch("/api/master/customers", { cache: 'no-store' })
      ]);
      
      if (cylRes.ok) {
          const cylData = await cylRes.json();
          if (cylData.success) {
            setCylinders(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(cylData.data)) return cylData.data;
                return prev;
            });
            if (cylData.pagination) {
                setTotalCount(cylData.pagination.total);
            }
          }
      }
      if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.success) {
             setCustomers(prev => {
                 if (JSON.stringify(prev) !== JSON.stringify(custData.data)) return custData.data;
                 return prev;
             });
          }
      }
    } catch { }
  }, [activePage, pageSize, filterType, searchTerm, sortField, sortDirection]);

  useSmartPolling({
    callback: pollCylinders,
    activeInterval: 1000,
    idleInterval: 30000,
    idleTimeout: 5000
  });

  // Initial & Dependency Fetch
  useEffect(() => {
     fetchCylinders();
  }, [fetchCylinders]);

  // [Performance] Pre-calculate expiry info (Logic preserved)
  const cylinderExpiryInfo = useMemo(() => {
    const infoMap = new Map<string, {
      diffDays: number | null;
      color: string;
      needsInspection: boolean;
      statusDesc: string;
    }>();
    
    // Calculate only for CURRENT PAGE items
    cylinders.forEach(c => {
      const status = TransactionValidator.getInspectionStatus(c.chargingExpiryDate);
      
      infoMap.set(c.serialNumber, {
        diffDays: null,
        color: status.color,
        needsInspection: status.needsInspection,
        statusDesc: status.desc
      });
    });
    
    return infoMap;
  }, [cylinders]);


  // [Pagination] Reset page on filter change
  // Note: Done in updateFilter, but search needs effect
  useEffect(() => {
      if (debouncedSearch) setActivePage(1);
  }, [debouncedSearch]);


  // [Cache]
  const nameCache = useMemo(() => {
    const holderMap = new Map<string, string>();
    customers.forEach(c => holderMap.set(c.id, c.name));
    return holderMap;
  }, [customers]);

  const getHolderName = useCallback((id: string) => {
      if (nameCache.has(id)) return resolveShortHolderName(nameCache.get(id)!);
      return resolveShortHolderName(id);
  }, [nameCache]);
  const getOwnerName = useCallback((owner: string) => resolveShortOwnerName(owner), []);

  // Sync URL search param
  useEffect(() => {
    const searchParam = searchParams.get('search');
    // Sync only if URL has a value (One-way binding from URL -> State)
    if (searchParam) {
        setSearchTerm(searchParam);
    }
  }, [searchParams]); // Removed searchTerm to prevent loop

  // Auto-Open History if authentic search match
  useEffect(() => {
    const searchParam = searchParams.get('search');
    if (searchParam && cylinders.length > 0 && !searchParams.get('action')) {
        const match = cylinders.find(c => c.serialNumber === searchParam);
        if (match) {
            setSelectedCylinderId(match.serialNumber);
            openHistory();
        }
    }
  }, [cylinders, searchParams, openHistory]);

  // Helper State for Bulk
  const [selectionMode, setSelectionMode] = useState<'NONE' | 'DELETE' | 'QR'>('NONE');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectionMode = (mode: 'DELETE' | 'QR' | 'NONE') => {
      if (mode === 'NONE') {
          setSelectionMode('NONE');
          setSelectedIds(new Set());
          return;
      }
      if (selectionMode === mode) {
          setSelectionMode('NONE');
          setSelectedIds(new Set());
      } else {
          setSelectionMode(mode);
          setSelectedIds(new Set());
      }
  };

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          const newSet = new Set(selectedIds);
          cylinders.forEach(c => newSet.add(c.id));
          setSelectedIds(newSet);
      } else {
          const newSet = new Set(selectedIds);
          cylinders.forEach(c => newSet.delete(c.id));
          setSelectedIds(newSet);
      }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
      const newSet = new Set(selectedIds);
      if (checked) {
          newSet.add(id);
      } else {
          newSet.delete(id);
      }
      setSelectedIds(newSet);
  };

  const isAllSelected = cylinders.length > 0 && cylinders.every(c => selectedIds.has(c.id));
  const isIndeterminate = cylinders.some(c => selectedIds.has(c.id)) && !isAllSelected;

  const handleBulkDelete = async () => {
      if (selectedIds.size === 0) return;
      if (!confirm(`${selectedIds.size}개의 용기를 삭제하시겠습니까?`)) return;
      const ids = Array.from(selectedIds);

      // Optimistic
      const previousCylinders = [...cylinders];
      setCylinders(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectionMode('NONE');
      setSelectedIds(new Set());

      try {
          const searchParams = new URLSearchParams();
          searchParams.set('ids', ids.join(','));
          const res = await fetch(`/api/master/cylinders?${searchParams.toString()}`, { method: 'DELETE' });
          const result = await res.json();

          if (res.ok) {
              notifications.show({ title: '완료', message: result.message, color: 'blue' });
              fetchCylinders(); 
          } else {
              throw new Error(result.message);
          }
      } catch (e) {
          setCylinders(previousCylinders); // Rollback
          const msg = e instanceof Error ? e.message : 'Error';
          notifications.show({ title: '오류', message: msg, color: 'red' });
      }
  };

  const handleBulkQr = () => {
    if (selectedIds.size === 0) return;
    openQrModal();
  };



  return (
     <>
        <AppLayout title="용기 관리 대장" themeColor="#40C057">
           <Stack gap="xs">
             <Box mb="xs">
                 <Stack gap="xs" visibleFrom="xs">
                      <Group justify="space-between" align="center">
                           <Group gap="xs">
                             <Text c="dimmed">총 {totalCount}개</Text>
                             <Text c="dimmed" size="xs">|</Text>
                             <Group gap={5}>
                               <Text c="dimmed" size="xs">표시:</Text>
                               <Button.Group>
                                 <Button variant={pageSize === 10 ? 'filled' : 'default'} onClick={() => setPageSize(10)} size="xs">10</Button>
                                 <Button variant={pageSize === 20 ? 'filled' : 'default'} onClick={() => setPageSize(20)} size="xs">20</Button>
                                 <Button variant={pageSize === 50 ? 'filled' : 'default'} onClick={() => setPageSize(50)} size="xs">50</Button>
                               </Button.Group>
                             </Group>
                           </Group>
                          <Group>
                             <Button.Group>
                                 <Button variant={filterType === 'ALL' ? 'filled' : 'default'} onClick={() => updateFilter('ALL')} size="xs" color="gray">전체</Button>
                                 <Button variant={filterType === 'FACTORY' ? 'filled' : 'default'} onClick={() => updateFilter('FACTORY')} size="xs" color="teal">공장내</Button>
                                 <Button variant={filterType === 'PARTNER' ? 'filled' : 'default'} onClick={() => updateFilter('PARTNER')} size="xs" color="blue">거래처</Button>
                                 <Button variant={filterType === 'NEEDS_INSPECTION' ? 'filled' : 'default'} onClick={() => updateFilter('NEEDS_INSPECTION')} size="xs" color="orange">검사대상</Button>
                                 <Button variant={filterType === 'LOST' ? 'filled' : 'default'} onClick={() => updateFilter('LOST')} size="xs" color="red">미아용기 조회</Button>
                             </Button.Group>

                              {isAdmin && <Button leftSection={<IconPlus size={16} />} onClick={open} color="teal" size="xs">신규</Button>}
                              {isAdmin && (
                                 <Group gap={4}>
                                      {selectionMode === 'DELETE' ? (
                                          <Button.Group>
                                              <Button color="red" size="xs" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
                                                  선택 삭제 ({selectedIds.size})
                                              </Button>
                                              <Button color="gray" size="xs" onClick={() => toggleSelectionMode('DELETE')}>취소</Button>
                                          </Button.Group>
                                      ) : (
                                          <Button variant="outline" color="red" onClick={() => toggleSelectionMode('DELETE')} size="xs" disabled={selectionMode !== 'NONE'}>
                                              삭제
                                          </Button>
                                      )}

                                     <Button 
                                         variant={selectionMode === 'QR' ? "filled" : "outline"} 
                                         color="yellow" 
                                         onClick={selectionMode === 'QR' ? handleBulkQr : () => toggleSelectionMode('QR')} 
                                         size="xs" 
                                         fw={700}
                                         disabled={selectionMode === 'DELETE'}
                                     >
                                         {selectionMode === 'QR' ? `선택 출력 (${selectedIds.size})` : 'QR 출력'}
                                     </Button>
                                     {selectionMode === 'QR' && (
                                         <Button color="gray" size="xs" onClick={() => toggleSelectionMode('QR')}>취소</Button>
                                     )}
                                 </Group>
                              )}
                          </Group>
                      </Group>
                  </Stack>

                  <Stack gap="xs" hiddenFrom="xs">
                      {/* Row 1: Filters (Scrollable Ribbon) */}
                      <Group justify="space-between" align="center" wrap="nowrap" gap={0}>
                          <ScrollArea type="never" style={{ flex: 1 }} offsetScrollbars={false}>
                            <Button.Group style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
                                <Button variant={filterType === 'ALL' ? 'filled' : 'default'} onClick={() => updateFilter('ALL')} size="xs" color="gray">전체</Button>
                                <Button variant={filterType === 'FACTORY' ? 'filled' : 'default'} onClick={() => updateFilter('FACTORY')} size="xs" color="teal">공장내</Button>
                                <Button variant={filterType === 'PARTNER' ? 'filled' : 'default'} onClick={() => updateFilter('PARTNER')} size="xs" color="blue">거래처</Button>
                                <Button variant={filterType === 'NEEDS_INSPECTION' ? 'filled' : 'default'} onClick={() => updateFilter('NEEDS_INSPECTION')} size="xs" color="orange">검사대상</Button>
                                <Button variant={filterType === 'LOST' ? 'filled' : 'default'} onClick={() => updateFilter('LOST')} size="xs" color="red">미아</Button>
                            </Button.Group>
                          </ScrollArea>
                          <Text size="xs" c="dimmed" ml={4} style={{ whiteSpace: 'nowrap' }}>← 밀어서</Text>
                      </Group>

                      {/* Row 2: Actions (Grid) */}
                      {isAdmin && (
                          <SimpleGrid cols={selectionMode === 'NONE' ? 3 : 1} spacing={5}>
                            {selectionMode === 'NONE' ? (
                                <>
                                    <Button variant="filled" leftSection={<IconPlus size={14} />} onClick={open} color="teal" size="xs" h={36}>신규</Button>
                                    <Button variant="outline" color="red" onClick={() => toggleSelectionMode('DELETE')} size="xs" h={36}>삭제</Button>
                                    <Button variant="outline" color="yellow" onClick={() => toggleSelectionMode('QR')} size="xs" fw={700} h={36}>QR</Button>
                                </>
                            ) : (
                                <Group gap={5} grow>
                                    {selectionMode === 'DELETE' && (
                                        <Button color="red" size="xs" onClick={handleBulkDelete} disabled={selectedIds.size === 0} h={36}>
                                            삭제({selectedIds.size})
                                        </Button>
                                    )}
                                    {selectionMode === 'QR' && (
                                        <Button color="yellow" size="xs" onClick={handleBulkQr} disabled={selectedIds.size === 0} h={36}>
                                            출력({selectedIds.size})
                                        </Button>
                                    )}
                                    <Button color="gray" variant="light" size="xs" onClick={() => toggleSelectionMode('NONE')} h={36}>취소</Button>
                                </Group>
                            )}
                          </SimpleGrid>
                      )}
                  </Stack>
              </Box>

              <TextInput
                  placeholder="검색 (용기번호, 소유자, 위치)"
                  leftSection={<IconSearch size={16} />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.currentTarget.value)}
                  rightSection={
                     searchTerm ? (
                         <ActionIcon variant="transparent" color="gray" onClick={() => {
                             setSearchTerm('');
                              if (typeof window !== 'undefined') {
                                 const newUrl = window.location.pathname;
                                 const params = new URLSearchParams(window.location.search);
                                 params.delete('search');
                                 const finalUrl = params.toString() ? `${newUrl}?${params.toString()}` : newUrl;
                                 window.history.replaceState(null, '', finalUrl);
                             }
                         }}>
                             <IconTrash size={16} />
                         </ActionIcon>
                     ) : null
                  }
                  size="md"
              />

              <Box>
                 <Group gap="xs" align="center" mb={0} px={4} hiddenFrom="sm">
                      <Text fw={700} size="sm">목록 ({cylinders.length}/{totalCount})</Text>
                     <Text size="sm" c="dimmed" fw={400}>(총 {totalCount}개)</Text>
                 </Group>

                 <Paper shadow="sm" radius="md" withBorder p={0} style={{ overflow: 'hidden' }}>
                 <ScrollArea h="calc(100vh - 280px)" type="auto" offsetScrollbars>
                   <Table striped highlightOnHover stickyHeader layout="fixed" style={{ minWidth: '1000px' }}>
                       <Table.Thead bg="#25262B">
                         <Table.Tr>
                           {selectionMode !== 'NONE' && (
                               <Table.Th w={40} style={{ textAlign: 'center' }}>
                                   <Checkbox 
                                     checked={isAllSelected}
                                     indeterminate={isIndeterminate}
                                     onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                                     color="teal"
                                   />
                               </Table.Th>
                           )}
                           <SortableHeader field="serialNumber" label="용기번호" style={{ width: '165px' }} />
                         <Table.Th style={{ color: '#fff', width: '36px', textAlign: 'center' }}><IconQrcode size={16} /></Table.Th>
                         <SortableHeader field="gasType" label="가스" style={{ width: '160px' }} />
                         <SortableHeader field="capacity" label="규격" style={{ width: '90px', textAlign: 'center' }} />
                         <SortableHeader field="location" label="위치" style={{ width: '140px' }} />
                         <SortableHeader field="status" label="상태" style={{ width: '80px', textAlign: 'center' }} />
                         <SortableHeader field="expiryDate" label="기한" style={{ width: '85px', textAlign: 'center' }} />
                         <SortableHeader field="owner" label="소유자" style={{ width: '130px' }} />
                       </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>
                        {cylinders.map((cylinder, index) => {
                                 // [Layout Fix] Parse Gas Name & Capacity
                                 const rawGas = cylinder.gasType || '';
                                 const parts = rawGas.split('-');
                                 let displayGasName = rawGas;
                                 let displayCapacity = cylinder.capacity || '';

                                 if (parts.length > 1) {
                                     // e.g., Ar-40L
                                     const potentialCap = parts[parts.length - 1];
                                     if (potentialCap.length <= 5) {
                                         displayCapacity = displayCapacity || potentialCap;
                                         displayGasName = parts.slice(0, -1).join('-');
                                     }
                                 }
                                 
                                 // [FIX] Translate to Korean (e.g. Ar -> 아르곤)
                                 displayGasName = getKoreanGasName(displayGasName);
                                 
                                 const expiryStatus = cylinderExpiryInfo.get(cylinder.serialNumber);

                                 return (
                                 <Fragment key={cylinder.id}>
                                     <Table.Tr 
                                       style={{ 
                                         animation: 'fadeInUp 0.3s ease forwards',
                                         animationDelay: `${index * 0.05}s`, // Simplified delay
                                         opacity: 0
                                       }} 
                                     >
                                        {selectionMode !== 'NONE' && (
                                           <Table.Td style={{ textAlign: 'center' }}>
                                               <Checkbox 
                                                 checked={selectedIds.has(cylinder.id)}
                                                 onChange={(e) => handleSelectRow(cylinder.id, e.currentTarget.checked)}
                                                 onClick={(e) => e.stopPropagation()}
                                               />
                                           </Table.Td>
                                       )}
                                       <Table.Td>
                                           <Text 
                                               span 
                                               c="blue.4" 
                                               fw={700}
                                               style={{ textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer' }}
                                               fz="sm"
                                               onClick={() => {
                                                   setSelectedCylinderId(cylinder.serialNumber);
                                                   openHistory();
                                               }}
                                           >
                                               {cylinder.serialNumber}
                                           </Text>
                                       </Table.Td>
                                       <Table.Td style={{ textAlign: 'center' }}>
                                           <ActionIcon 
                                             variant="transparent" 
                                             color="gray" 
                                             size="sm"
                                             onClick={(e) => handleQrClick(cylinder, e)}
                                           >
                                               <IconQrcode size={18} />
                                           </ActionIcon>
                                       </Table.Td>
                                       <Table.Td>
                                           <GasBadge 
                                             gasType={displayGasName} 
                                             color={cylinder.gasColor} 
                                             size="sm" 
                                             isRack={cylinder.containerType === 'RACK'} 
                                             rackInfo={cylinder.parentRackId}
                                           />
                                       </Table.Td>
                                       <Table.Td style={{ textAlign: 'center' }}>
                                           <Text size="sm">{displayCapacity}</Text>
                                       </Table.Td>
                                       <Table.Td style={{ 
                                           color: cylinder.currentHolderId === '삼덕공장' ? '#40C057' : 
                                                  cylinder.currentHolderId === 'INSPECTION_AGENCY' ? '#FD7E14' : '#339AF0',
                                           fontWeight: 600,
                                           fontSize: '0.9rem'
                                       }}>
                                           <Text truncate fz="sm">
                                             {cylinder.locationName ? resolveShortHolderName(cylinder.locationName) : getHolderName(cylinder.currentHolderId || '삼덕공장')}
                                           </Text>
                                       </Table.Td>
                                       <Table.Td>
                                         <Flex justify="center" w="100%">
                                             <Badge 
                                                 size="sm"
                                                 color={
                                                     cylinder.status === '실병' ? 'blue' :
                                                     cylinder.status === '공병' ? 'green' :
                                                     cylinder.status === '충전중' ? 'yellow' : 
                                                     cylinder.status === '납품' ? 'cyan' : 'gray'
                                                 }
                                             >
                                                 {cylinder.status}
                                             </Badge>
                                         </Flex>
                                       </Table.Td>
                                       <Table.Td style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }}>
                                           <Stack gap={0} align="center">
                                               <Text fz="sm" c={expiryStatus?.color || 'dimmed'}>
                                                   {formatExpiryDate(cylinder.chargingExpiryDate)}
                                               </Text>
                                               {expiryStatus?.needsInspection && (
                                                 <Text c={expiryStatus.color} size="xs" fw={700}>
                                                     {expiryStatus.statusDesc}
                                                 </Text>
                                               )}
                                           </Stack>
                                       </Table.Td>
                                       <Table.Td style={{ whiteSpace: 'nowrap' }}>{getOwnerName(cylinder.owner || '')}</Table.Td>
                                     </Table.Tr>
                                 </Fragment>
                                 );
                        })}
                     </Table.Tbody>
                   </Table>
                 </ScrollArea>
              </Paper>

              {/* Pagination Footer */}
              {pageSize !== -1 && totalCount > pageSize && (
                  <Center mt="md">
                      <Pagination 
                         total={Math.ceil(totalCount / pageSize)} 
                         value={activePage} 
                         onChange={setActivePage} 
                         color="teal"
                      />
                  </Center>
              )}
            </Box>
            </Stack>

             <Modal opened={opened} onClose={handleCloseCreate} title="용기 신규 등록" centered size="lg">
                <NewRegistrationForm 
                     onCancel={close} 
                     onSuccess={(newItem, shouldPrint) => {
                         fetchCylinders();
                         close();
                         if (shouldPrint && newItem) {
                             setPrintTarget(newItem);
                             setTimeout(() => openQrModal(), 100);
                         } else {
                             setPrintTarget(null);
                         }
                     }} 
                     allCylinders={cylinders}
                 />
             </Modal>
            
            <CylinderHistoryModal 
                opened={historyModalOpen} 
                onClose={closeHistory} 
                cylinderId={selectedCylinderId} 
                isAdmin={isAdmin}
            />


         </AppLayout>
        <CylinderQRModal
           opened={qrModalOpen}
           onClose={() => {
               closeQrModal();
               setPrintTarget(null);
           }}
           serial={printTarget?.serialNumber || null} 
           id={printTarget?.id || null} // [Immutable QR] Pass ID
           owner={printTarget?.owner || null}
           // [Fix] If Selection Mode is QR, pass selected items.
           // If Mode is NONE and printTarget exists -> Single (handled by single props or array).
           // If Mode is NONE and no printTarget -> All Filtered.
           cylinders={
               selectionMode === 'QR' && selectedIds.size > 0 
               ? cylinders.filter(c => selectedIds.has(c.id)) // Cylinder objects already have ID
               : printTarget 
                 ? [printTarget] 
                 : cylinders
           }
       />
     </>
  );
}

export default function CylinderMasterPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CylinderMasterContent />
        </Suspense>
    );
}
