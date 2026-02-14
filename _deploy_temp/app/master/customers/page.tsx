'use client';

import { AppLayout } from '@/components/Layout/AppLayout';
import { PageTransition } from '@/components/UI/PageTransition';
import { GlassCard } from '@/components/UI/GlassCard';
import { 
  Paper, Text, Button, Table, Modal, TextInput, Select, NativeSelect, 
  ActionIcon, Group, Badge, Stack, Box, ScrollArea, Pagination, Center, Checkbox
} from '@mantine/core';
import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import { IconPlus, IconEdit, IconTrash, IconQrcode, IconArrowUp, IconArrowDown, IconArrowsSort, IconLock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Customer } from '@/lib/types';
import { CustomerDetailModal } from './CustomerDetailModal';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';
import { QRPrintModal } from '@/components/Common/QRPrintModal';
// import { IconPrinter } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useSmartPolling } from '@/app/hooks/useSmartPolling';
import { modals } from '@mantine/modals';
import { useSearchParams, useRouter } from 'next/navigation';
import { ReadOnlyBanner } from '@/components/PermissionBanner';

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [opened, setOpened] = useState(false); // For Create Modal
  
  // Detail Modal State
  const [detailOpened, setDetailOpened] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [qrModalOpened, { open: openQrModal, close: closeQrModal }] = useDisclosure(false);
  const [printTarget, setPrintTarget] = useState<Customer | null>(null); // [New] For immediate printing
  const [isAdmin, setIsAdmin] = useState(false);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledSearchQuery = useRef<string | null>(null);

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
              // [Changed] Non-Admin can now view existing customers (Read-Only)
          } else {
              // No User: Redirect to Login
              router.replace('/auth/login');
          }
      }
  }, [router]);

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // [Performance] "Instant" Input with Deferred Filtering (Max Responsiveness)
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // [Sorting State]
  type SortDirection = 'asc' | 'desc' | null;
  type SortField = 'ledgerNumber' | 'name' | 'type' | 'address' | 'paymentType' | null;
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
  }, [sortField, sortDirection]);

  // Sortable Header Component
  const SortableHeader = ({ field, label, style }: { field: SortField; label: string; style?: React.CSSProperties }) => (
    <Table.Th 
      style={{ 
        ...style, 
        cursor: 'pointer', 
        userSelect: 'none',
        color: sortField === field ? '#228be6' : 'rgba(255,255,255,0.5)',
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

  // [Sync URL Search]
  useEffect(() => {
    const q = searchParams.get('search');
    // Only sync if URL has a value. 
    // If URL is empty, we don't force empty (let user type). 
    // But if URL *changes* to something, update input.
    if (q) {
        setSearchQuery(q);
    }
  }, [searchParams]); // Removed searchQuery to fix infinite revert loop

  // [Auto-Open Detail & Handle Search Params]
  useEffect(() => {
    const q = searchParams.get('search');
    const action = searchParams.get('action');
    const tab = searchParams.get('tab');

    // 1. Direct Detail Open
    if (q && customers.length > 0) {
        if (handledSearchQuery.current === q && !tab) return; // Skip if handled, unless tab changed? actually just skip.

        const exactMatch = customers.find(c => c.name === q);
        if (exactMatch) {
            setSelectedCustomer(exactMatch);
            setDetailOpened(true);
            handledSearchQuery.current = q;
        }
    } else if (!q) {
        handledSearchQuery.current = null;
    }

    // 2. Action Handling (Admin Only)
    if (action === 'create') {
        if (isAdmin) {
            setOpened(true);
            // Clean URL action param to avoid re-trigger
            const params = new URLSearchParams(searchParams.toString());
            params.delete('action');
            if (typeof window !== 'undefined') window.history.replaceState(null, '', `?${params.toString()}`);
        } else {
             // Optional: Show "Admin Only" warning? 
             // notifications.show({ message: '관리자 권한이 필요합니다.', color: 'red' });
        }
    } else if (action === 'qr') {
        if (isAdmin) {
            openQrModal();
             // Clean URL action param
            const params = new URLSearchParams(searchParams.toString());
            params.delete('action');
            if (typeof window !== 'undefined') window.history.replaceState(null, '', `?${params.toString()}`);
        }
    }

  }, [customers, searchParams, isAdmin, openQrModal]);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newBusinessNumber, setNewBusinessNumber] = useState('');
  const [newCorporateId, setNewCorporateId] = useState('');
  const [newRepresentative, setNewRepresentative] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFax, setNewFax] = useState('');
  
  const [newType, setNewType] = useState<'BUSINESS' | 'INDIVIDUAL'>('BUSINESS');
  const [newPaymentType, setNewPaymentType] = useState<string>('card');

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/master/customers');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCustomers(prev => {
             // [Optimization] Fast Equality Check for Polling
             if (prev.length !== data.data.length) return data.data;
             if (prev.length > 0 && data.data.length > 0) {
                 if (prev[0].id !== data.data[0].id) return data.data; 
                 // Simple Last-Modified Check (using last item ID as proxy for append)
                 if (prev[prev.length - 1].id !== data.data[data.data.length - 1].id) return data.data;
             }
             // For deep changes (edits), we might miss them with this simple check.
             // But for "Reaction Speed", avoiding stringify is key.
             // Let's rely on stringify ONLY if lengths match, which is rarer during active updates?
             // Or just swallow the cost? 277 items stringify is ~1ms on PC, but on mobile?
             // Let's assume standard React behavior is fine if we just optimize the *render* side.
             // Actually, the main cost is likely the Re-Render of the Table.
             // If data is identical, setState bails out? -> No, object ref differs.
             
             // Let's use stringify but only if lengths match.
             if (JSON.stringify(prev) !== JSON.stringify(data.data)) return data.data;
             return prev;
        });
      } else {
         // Console error or silent
      }
    } catch {
    //   console.error("Failed to fetch customers");
    }
  }, []);

  useSmartPolling({
    callback: fetchCustomers,
    activeInterval: 2000,
    idleInterval: 30000,
    idleTimeout: 5000
  });

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Close Handler that cleans URL
  const handleCloseDetailAction = useCallback(() => {
    setDetailOpened(false);
    
    // [Fix] Use native replaceState to clean URL without triggering Next.js Router stack quirks
    // This prevents "extra" history entries being created during popstate handling
    if (typeof window !== 'undefined') {
        const newUrl = window.location.pathname; // /master/customers
        // Preserve existing state object but update URL
        window.history.replaceState({ ...window.history.state }, '', newUrl);
    }
    
    // Manually sync internal state since we bypassed Router
    setSearchQuery(''); 
  }, []);

  // Back Button Logic
  // [Fix] If source=ai, we disable the Trap for the Detail Modal.
  const isSourceAi = searchParams.get('source') === 'ai';
  
  // Memoize close handler to prevent effect loop in hook
  const closeCreateModal = useCallback(() => setOpened(false), []);
  const handleCloseCreate = useModalBackTrap(opened, closeCreateModal, 'create-customer');
  
  const handleCloseDetail = useModalBackTrap(detailOpened && !isSourceAi, handleCloseDetailAction, 'detail');

  const handleAddCustomer = async (shouldPrint: boolean = false) => {
    if (!newName) {
        notifications.show({ title: '오류', message: '거래처명은 필수입니다', color: 'red' });
        return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/master/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: newName, 
            type: newType, 
            paymentType: newPaymentType,
            address: newAddress,
            phone: newPhone,
            businessNumber: newBusinessNumber,
            corporateId: newCorporateId,
            representative: newRepresentative,
            fax: newFax,
            // ledgerNumber is auto-generated by server
            // balance removed
        }),
      });

      const result = await res.json(); // Read json once

      if (res.ok) {
        notifications.show({ title: '성공', message: '거래처가 추가되었습니다', color: 'blue' });
        
        // Use the hook handler to close cleanly (pops history if needed)
        handleCloseCreate();

        await fetchCustomers(); // Wait for fetch

        // Reset form
        setNewName('');
        setNewBusinessNumber('');
        setNewCorporateId('');
        setNewRepresentative('');
        setNewAddress('');
        setNewPhone('');
        setNewFax('');
        setNewType('BUSINESS');
        setNewPaymentType('card');

        // [New] Handle Print
        if (shouldPrint && result.data) {
             // We need to match the structure expected by QRPrintModal's data mapping, but here we just set the raw customer
             // and let the modal props handle the mapping logic or map it right here.
             // Simpler: Set the raw printTarget and logic in the render.
             setPrintTarget(result.data);
             setTimeout(() => openQrModal(), 100); // Small delay to ensure modal transition
        } else {
             setPrintTarget(null);
        }

      } else {
        if (res.status === 409) {
             modals.open({
                title: <Text fw={700} c="red">중복 알림</Text>,
                children: (
                    <Stack>
                        <Text size="sm">{result.message}</Text>
                        <Button fullWidth onClick={() => modals.closeAll()} color="red">확인</Button>
                    </Stack>
                ),
                centered: true
             });
        } else {
             notifications.show({ title: '오류', message: result.message || '거래처 추가 실패', color: 'red' });
        }
      }
    } catch (error) {
       console.error(error); 
       notifications.show({ title: '오류', message: '네트워크 오류', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = useCallback((customer: Customer) => {
    // Reuse bulk logic or just call API but handle confirm internally
    // Simpler to just use confirm modal then call API.
    modals.openConfirmModal({
        title: '삭제 확인',
        children: (
            <Text size="sm">정말로 {customer.name}(을)를 삭제하시겠습니까? (안전 삭제)</Text>
        ),
        labels: { confirm: '예', cancel: '아니요' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
            setLoading(true);
            try {
                const doDelete = async (force: boolean) => {
                    const searchParams = new URLSearchParams();
                    searchParams.set('id', customer.id);
                    if (force) searchParams.set('force', 'true');

                    const res = await fetch(`/api/master/customers?${searchParams.toString()}`, { method: 'DELETE' });
                    const result = await res.json();
                    
                    if (res.ok) {
                        notifications.show({ title: '성공', message: '거래처가 삭제되었습니다', color: 'blue' });
                        fetchCustomers();
                    } else if (res.status === 409 && result.requiresForce) {
                        if (confirm(result.message)) {
                            await doDelete(true);
                        }
                    } else {
                        notifications.show({ title: '오류', message: result.message || '삭제 실패', color: 'red' });
                    }
                };
                await doDelete(false);
            } catch {
                notifications.show({ title: '오류', message: '네트워크 오류', color: 'red' });
            } finally {
                setLoading(false);
            }
        }
    });
  }, [fetchCustomers]);

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    let result = customers.filter(customer => 
      (customer.name && customer.name.includes(deferredSearchQuery)) ||
      (customer.phone && customer.phone.includes(deferredSearchQuery)) ||
      (customer.address && customer.address.includes(deferredSearchQuery)) ||
      (customer.businessNumber && customer.businessNumber.includes(deferredSearchQuery)) ||
      (customer.representative && customer.representative.includes(deferredSearchQuery)) ||
      (customer.ledgerNumber && customer.ledgerNumber.includes(deferredSearchQuery))
    );

    // Apply sorting with proper Korean collation
    if (sortField && sortDirection) {
      const koreanCollator = new Intl.Collator('ko', { sensitivity: 'base' });
      
      // Helper to check if name has (주) or 주) prefix
      const hasCompanyPrefix = (name: string): boolean => {
        return /^[\(（]?주[\)）]/.test(name);
      };
      
      // Helper to extract text after (주) prefix for sorting
      const getNameForSorting = (name: string): string => {
        return name.replace(/^[\(（]?주[\)）]\s*/, '').trim();
      };
      
      result = [...result].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'ledgerNumber':
            // Numeric sorting for ledger numbers
            const aLedger = parseInt(a.ledgerNumber || '0') || 0;
            const bLedger = parseInt(b.ledgerNumber || '0') || 0;
            comparison = aLedger - bLedger;
            break;
          case 'name':
            // Group (주) companies first, then sort by text after prefix
            const aHasPrefix = hasCompanyPrefix(a.name || '');
            const bHasPrefix = hasCompanyPrefix(b.name || '');
            
            if (aHasPrefix && !bHasPrefix) {
              comparison = -1; // (주) comes first
            } else if (!aHasPrefix && bHasPrefix) {
              comparison = 1; // (주) comes first
            } else {
              // Both have or both don't have prefix - sort by name content
              const aName = getNameForSorting(a.name || '');
              const bName = getNameForSorting(b.name || '');
              comparison = koreanCollator.compare(aName, bName);
            }
            break;
          case 'type':
            comparison = koreanCollator.compare(a.type || '', b.type || '');
            break;
          case 'address':
            comparison = koreanCollator.compare(a.address || '', b.address || '');
            break;
          case 'paymentType':
            // Convert to Korean labels for consistent sorting
            const getPaymentLabel = (type: string) => {
              switch(type) {
                case 'card': return '카드';
                case 'cash': return '현금';
                case 'transfer': return '이체';
                case 'tax_invoice': return '세금';
                default: return type || '';
              }
            };
            comparison = koreanCollator.compare(getPaymentLabel(a.paymentType || ''), getPaymentLabel(b.paymentType || ''));
            break;
          default:
            return 0;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [customers, deferredSearchQuery, sortField, sortDirection]);

  // [Pagination & Selection State]
  const [pageSize, setPageSize] = useState<number>(20);
  const [activePage, setActivePage] = useState(1);
  const [selectionMode, setSelectionMode] = useState<'NONE' | 'DELETE' | 'QR'>('NONE');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // [Performance] Simple slice for display
  const displayCustomers = useMemo(() => {
    if (pageSize === -1) return filteredCustomers;
    const start = (activePage - 1) * pageSize;
    const end = start + pageSize;
    return filteredCustomers.slice(start, end);
  }, [filteredCustomers, pageSize, activePage]);

  // Reset page on filter change
  useEffect(() => { setActivePage(1); }, [searchQuery, pageSize]);

  // [Bulk Actions] Handlers
  const toggleSelectionMode = (mode: 'DELETE' | 'QR') => {
      if (selectionMode === mode) {
          setSelectionMode('NONE');
          setSelectedIds(new Set());
      } else {
          setSelectionMode(mode);
          setSelectedIds(new Set());
      }
  };

  const handleSelectAll = useCallback((checked: boolean) => {
      const newSet = new Set(selectedIds);
      if (checked) {
          displayCustomers.forEach(c => newSet.add(c.id));
      } else {
          displayCustomers.forEach(c => newSet.delete(c.id));
      }
      setSelectedIds(newSet);
  }, [selectedIds, displayCustomers]);

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
      const newSet = new Set(selectedIds);
      if (checked) {
          newSet.add(id);
      } else {
          newSet.delete(id);
      }
      setSelectedIds(newSet);
  }, [selectedIds]);

  const isAllSelected = displayCustomers.length > 0 && displayCustomers.every(c => selectedIds.has(c.id));
  const isIndeterminate = displayCustomers.some(c => selectedIds.has(c.id)) && !isAllSelected;

  const handleBulkDelete = async (force: boolean = false) => {
      if (selectedIds.size === 0) return;
      if (!force && !confirm(`${selectedIds.size}개의 거래처를 삭제하시겠습니까?`)) return;
      
      setLoading(true);
      try {
          const ids = Array.from(selectedIds);
          // Use New Bulk API (Comma separated)
          const searchParams = new URLSearchParams();
          searchParams.set('ids', ids.join(','));
          if (force) searchParams.set('force', 'true');

          const res = await fetch(`/api/master/customers?${searchParams.toString()}`, { method: 'DELETE' });
          const result = await res.json();

          if (res.ok) {
              notifications.show({ title: '완료', message: result.message, color: 'blue' });
              fetchCustomers();
              setSelectionMode('NONE');
              setSelectedIds(new Set());
          } else {
               // [Handle Force Requirement]
               if (res.status === 409 && result.requiresForce) {
                   if (confirm(result.message)) {
                       // Retry with force
                       await handleBulkDelete(true);
                       return;
                   }
               }
               notifications.show({ title: '오류', message: result.message || '삭제 실패', color: 'red' });
          }
      } catch {
          notifications.show({ title: '오류', message: '오류 발생', color: 'red' });
      } finally {
          setLoading(false);
      }
  };

  const handleBulkQr = () => {
    if (selectedIds.size === 0) return;
    openQrModal();
  };

  // Desktop Table Rows
  const rows = useMemo(() => displayCustomers.map((customer, index) => (
    <Table.Tr key={customer.id} 
        data-testid="customer-row"
        style={{ 
            background: 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            // Animation
            animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            opacity: 0,
            animationDelay: `${Math.min(index * 15, 300)}ms`,
            cursor: 'pointer',
            transition: 'background 0.2s'
        }}
        // Use data attribute for hover style in global css or Generic hover
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {selectionMode !== 'NONE' && (
          <Table.Td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
              <Checkbox 
                checked={selectedIds.has(customer.id)}
                onChange={(e) => handleSelectRow(customer.id, e.currentTarget.checked)}
              />
          </Table.Td>
      )}
      <Table.Td style={{color: 'white', fontSize: '0.9rem', textAlign: 'center', whiteSpace: 'nowrap'}}>{customer.ledgerNumber || '-'}</Table.Td>
      <Table.Td style={{color: 'white', fontSize: '0.9rem'}}>
          <Text 
            truncate 
            onClick={(e) => {
                if (!isAdmin) {
                    e.preventDefault();
                    e.stopPropagation();
                    notifications.show({
                        title: '접근 제한',
                        message: '관리자만 상세 정보를 조회할 수 있습니다.',
                        color: 'yellow',
                        icon: <IconLock size={16} />
                    });
                    return;
                }
                setSelectedCustomer(customer);
                setDetailOpened(true);
            }}
            style={{ 
                fontSize: '0.9rem', 
                maxWidth: '180px', 
                cursor: isAdmin ? 'pointer' : 'not-allowed',
                textDecoration: isAdmin ? 'underline' : 'none',
                textUnderlineOffset: '3px',
                opacity: isAdmin ? 1 : 0.6,
                transition: 'opacity 0.2s'
            }}
          >
            {customer.name}
          </Text>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
          <ActionIcon 
            variant="transparent" 
            color="gray" 
            size="sm"
            onClick={(e) => {
                e.stopPropagation();
                setPrintTarget(customer);
                openQrModal();
            }}
          >
            <IconQrcode size={18} />
          </ActionIcon>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Badge 
            variant="dot" 
            color={customer.type === 'BUSINESS' ? 'blue' : 'green'}
            size="md"
        >
            {customer.type === 'BUSINESS' ? '사업자' : '개인'}
        </Badge>
      </Table.Td>
      <Table.Td style={{color: 'white', fontSize: '0.9rem', textAlign: 'center', whiteSpace: 'nowrap'}}>{customer.businessNumber || '-'}</Table.Td>
      <Table.Td style={{color: 'white', fontSize: '0.9rem', textAlign: 'center', whiteSpace: 'nowrap'}}>
          <Text truncate style={{ fontSize: '0.9rem', maxWidth: '90px' }}>{customer.representative || '-'}</Text>
      </Table.Td>
      <Table.Td style={{color: 'white', fontSize: '0.9rem', textAlign: 'center', whiteSpace: 'nowrap'}}>{customer.phone || '-'}</Table.Td>
      <Table.Td style={{color: 'white', fontSize: '0.9rem'}}>
        <Text truncate style={{ fontSize: '0.9rem', maxWidth: '300px' }}>{customer.address || '-'}</Text>
      </Table.Td>
       <Table.Td style={{color: 'white', fontSize: '0.9rem', textAlign: 'center', whiteSpace: 'nowrap'}}>
        {customer.paymentType === 'card' ? '카드' : 
         customer.paymentType === 'cash' ? '현금' : 
         customer.paymentType === 'transfer' ? '이체' : '세금'}
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        {isAdmin && (
            <Group gap={4} justify="center" wrap="nowrap">
            <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => {
                setSelectedCustomer(customer);
                setDetailOpened(true);
            }}>
                <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteCustomer(customer)}>
                <IconTrash size={16} />
            </ActionIcon>
            </Group>
        )}
      </Table.Td>
    </Table.Tr>
  )), [displayCustomers, isAdmin, openQrModal, handleDeleteCustomer, selectionMode, selectedIds, handleSelectRow]);

  const typeData = [{ value: 'BUSINESS', label: '사업자' }, { value: 'INDIVIDUAL', label: '개인' }];
  const paymentData = [
      { value: 'tax_invoice', label: '세금계산서' },
      { value: 'cash', label: '현금' }, 
      { value: 'card', label: '카드' }, 
      { value: 'transfer', label: '계좌이체' },
  ];

  return (
    <AppLayout title="거래처 관리" themeColor="#4C6EF5">
      <PageTransition>
      {/* Read-Only Banner for non-admin users */}
      {!isAdmin && <ReadOnlyBanner />}
      
      <Group justify="space-between" mb="lg">
        <Text c="dimmed" style={{ fontSize: '1.2rem' }} visibleFrom="sm">총 {filteredCustomers.length}개의 거래처가 등록되어 있습니다.</Text>
        <Group gap="xs" style={{ flex: 1, justifyContent: 'flex-end' }} align="stretch">
             <TextInput 
                placeholder="거래처명, 대표자, 번호 검색" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                rightSection={
                    searchQuery ? (
                        <ActionIcon variant="transparent" color="gray" onClick={() => {
                            setSearchQuery('');
                            // Also clear URL to prevent state desync
                            if (typeof window !== 'undefined') {
                                const newUrl = window.location.pathname;
                                window.history.replaceState(null, '', newUrl);
                            }
                        }}>
                            <IconTrash size={16} />
                        </ActionIcon>
                    ) : null
                }
                style={{ flex: 1 }}
                w={{ base: 'auto', sm: '250px' }}
                miw={{ base: '150px', sm: '250px' }}
                size="md" // Standardize size
            />
            {isAdmin && (
                <Button 
                    leftSection={<IconPlus size={20}/>} 
                    onClick={() => setOpened(true)} 
                    color="blue" 
                    size="md"
                    h="auto"
                >
                    <Text fw={700} style={{ fontSize: '1rem' }} visibleFrom="sm">신규 등록</Text>
                    <Text fw={700} style={{ fontSize: '0.9rem' }} hiddenFrom="sm">등록</Text>
                </Button>
            )}
            {isAdmin && (
                <Group gap={4}>
                    {selectionMode === 'DELETE' ? (
                        <Button.Group>
                            <Button color="red" size="md" onClick={() => handleBulkDelete(false)} disabled={selectedIds.size === 0}>
                                <Text visibleFrom="sm">선택 삭제 ({selectedIds.size})</Text>
                                <Text hiddenFrom="sm">삭제 ({selectedIds.size})</Text>
                            </Button>
                            <Button color="gray" size="md" onClick={() => toggleSelectionMode('DELETE')}>취소</Button>
                        </Button.Group>
                    ) : (
                         <Button
                            onClick={() => toggleSelectionMode('DELETE')}
                            color="red"
                            variant="outline"
                            size="md"
                            disabled={selectionMode !== 'NONE'}
                        >
                            <Text fw={700} style={{ fontSize: '1rem' }} visibleFrom="sm">삭제</Text>
                            <Text fw={700} style={{ fontSize: '0.9rem' }} hiddenFrom="sm">삭제</Text>
                        </Button>
                    )}
                
                    {/* [FIX] QR Button Hidden on Mobile */}
                    <Button
                        onClick={selectionMode === 'QR' ? handleBulkQr : () => toggleSelectionMode('QR')}
                        color="yellow"
                        variant={selectionMode === 'QR' ? 'filled' : 'outline'}
                        size="md"
                        visibleFrom="sm"
                        disabled={selectionMode === 'DELETE'}
                    >
                        {selectionMode === 'QR' ? `선택 출력 (${selectedIds.size})` : 'QR 출력'}
                    </Button>
                    {selectionMode === 'QR' && (
                         <Button color="gray" size="md" onClick={() => toggleSelectionMode('QR')} visibleFrom="sm">취소</Button>
                    )}
                </Group>
            )}
        </Group>
      </Group>

      {/* Pagination Controls */}
      <Group justify="flex-end" mb="xs">
         <Button.Group>
            <Button variant={pageSize === 10 ? 'filled' : 'default'} onClick={() => setPageSize(10)} size="xs">10</Button>
            <Button variant={pageSize === 20 ? 'filled' : 'default'} onClick={() => setPageSize(20)} size="xs">20</Button>
            <Button variant={pageSize === 50 ? 'filled' : 'default'} onClick={() => setPageSize(50)} size="xs">50</Button>
            <Button variant={pageSize === -1 ? 'filled' : 'default'} onClick={() => setPageSize(-1)} size="xs">전체</Button>
         </Button.Group>
      </Group>

      {/* Desktop View */}
      <Paper p="md" radius="lg" visibleFrom="sm" style={{ 
            background: 'rgba(37, 38, 43, 0.7)', // Unified Dark Glass
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
      <div style={{ 
          overflow: 'auto', 
          height: 'calc(100vh - 250px)', 
          // Applies global scrollbar styles
        }}>
            <Table verticalSpacing="xs" highlightOnHover style={{ minWidth: '1000px' }}>
            <Table.Thead>
                <Table.Tr>
                {selectionMode !== 'NONE' && (
                    <Table.Th w={40} style={{ textAlign: 'center' }}>
                         <Checkbox 
                            checked={isAllSelected}
                            indeterminate={isIndeterminate}
                            onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                        />
                    </Table.Th>
                )}
                <SortableHeader field="ledgerNumber" label="장부번호" style={{fontSize: '0.9rem', width: '70px', textAlign: 'center', whiteSpace: 'nowrap'}} />
                <SortableHeader field="name" label="거래처명" style={{fontSize: '0.9rem', width: '180px', whiteSpace: 'nowrap'}} />
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', width: '50px', textAlign: 'center'}}><IconQrcode size={16} /></Table.Th>
                <SortableHeader field="type" label="유형" style={{fontSize: '0.9rem', width: '90px', textAlign: 'center', whiteSpace: 'nowrap'}} />
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', width: '120px', textAlign: 'center', whiteSpace: 'nowrap'}}>사업자번호</Table.Th>
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', width: '90px', textAlign: 'center', whiteSpace: 'nowrap'}}>대표자</Table.Th>
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', width: '130px', textAlign: 'center', whiteSpace: 'nowrap'}}>전화번호</Table.Th>
                <SortableHeader field="address" label="주소" style={{fontSize: '0.9rem', whiteSpace: 'nowrap'}} />
                <SortableHeader field="paymentType" label="결제" style={{fontSize: '0.9rem', width: '90px', textAlign: 'center', whiteSpace: 'nowrap'}} />
                <Table.Th style={{color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', width: '80px', textAlign: 'center', whiteSpace: 'nowrap'}}>관리</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
            </Table>
        </div>
        {/* Pagination Footer */}
         {pageSize !== -1 && filteredCustomers.length > pageSize && (
             <Center mt="md">
                 <Pagination 
                    total={Math.ceil(filteredCustomers.length / pageSize)} 
                    value={activePage} 
                    onChange={setActivePage} 
                    color="blue"
                 />
             </Center>
         )}
      </Paper>

      {/* Mobile Card View */}
      <Box hiddenFrom="sm">
          <ScrollArea h="calc(100vh - 180px)" offsetScrollbars>
          <Stack gap="md" p="xs">
            {displayCustomers.map((customer) => (
             <GlassCard key={customer.id} variant="interactive" p="md" 
                 onClick={() => {
                     // [FIX] Mobile Selection Logic
                     if (selectionMode === 'DELETE') {
                         handleSelectRow(customer.id, !selectedIds.has(customer.id));
                     } else {
                         setSelectedCustomer(customer);
                         setDetailOpened(true);
                     }
                 }}
                 style={{
                     border: selectionMode === 'DELETE' && selectedIds.has(customer.id) 
                         ? '1px solid #FA5252' 
                         : undefined
                 }}
             >
                 <Group justify="space-between" mb={4} align="center">
                         <Group gap={6} style={{ flex: 1 }}>
                             {/* [FIX] Checkbox on Left */}
                             {selectionMode === 'DELETE' && (
                                 <Checkbox 
                                     checked={selectedIds.has(customer.id)}
                                     onChange={() => {}}
                                     color="red"
                                     mr="xs"
                                     style={{ pointerEvents: 'none' }}
                                 />
                             )}
                             
                             {customer.ledgerNumber && <Badge variant="outline" color="gray" size="xs">{customer.ledgerNumber}</Badge>}
                             <Text fw={700} size="lg" c="white">{customer.name}</Text>
                             <Badge color={customer.type === 'BUSINESS' ? 'blue' : 'green'} size="sm" variant="light">
                                 {customer.type === 'BUSINESS' ? '사업자' : '개인'}
                             </Badge>
                         </Group>

                         {/* Status Badge (Right) - Hide in Delete Mode to reduce clutter? Or Keep? Rules say nothing. 
                             Previous logic replaced Badge with Checkbox. 
                             Now Checkbox is on Left. 
                             If I keep Badge on Right, it might look busy. 
                             But user asked to move checkbox to left. 
                             I'll show badge ONLY if NOT delete mode, same as before, to imply "Select Mode" replaces "View Mode". 
                         */}
                         {selectionMode !== 'DELETE' && (
                             <Badge color="gray" variant="outline" size="xs">{customer.paymentType === 'card' ? '카드' : '현금'}</Badge>
                         )}
                 </Group>
                    
                    <Stack gap={2} mb="xs">
                        {customer.businessNumber && (
                             <Group justify="space-between">
                                <Text size="xs" c="dimmed">사업자번호</Text>
                                <Text size="xs" c="white">{customer.businessNumber}</Text>
                            </Group>
                        )}
                        {customer.representative && (
                             <Group justify="space-between">
                                <Text size="xs" c="dimmed">대표자</Text>
                                <Text size="xs" c="white">{customer.representative}</Text>
                            </Group>
                        )}
                         <Group justify="space-between">
                            <Text size="xs" c="dimmed">전화번호</Text>
                            <Text size="xs" c="white">{customer.phone || '-'}</Text>
                        </Group>
                        <Group justify="space-between" align="flex-start">
                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>주소</Text>
                            <Text size="xs" c="white" style={{ textAlign: 'right', flex: 1, marginLeft: '10px' }}>{customer.address || '-'}</Text>
                        </Group>
                         <Group justify="space-between">
                            <Text size="xs" c="dimmed">결제유형</Text>
                            <Text size="xs" c="white">
                                {customer.paymentType === 'card' ? '카드' : 
                                 customer.paymentType === 'cash' ? '현금' : 
                                 customer.paymentType === 'transfer' ? '계좌이체' : '세금계산서'}
                            </Text>
                        </Group>
                    </Stack>

                    <Group grow>
                        <Button variant="light" color="blue" size="sm">수정</Button>
                        <Button variant="light" color="red" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(customer);
                        }}>삭제</Button>
                    </Group>
                </GlassCard>
            ))}
          </Stack>
          </ScrollArea>
      </Box>
      <Box hiddenFrom="sm" p="md">
        {pageSize !== -1 && filteredCustomers.length > pageSize && (
            <Center>
                <Pagination 
                total={Math.ceil(filteredCustomers.length / pageSize)} 
                value={activePage} 
                onChange={setActivePage} 
                color="blue"
                size="sm"
                siblings={1}
                />
            </Center>
        )}
      </Box>

      {/* Add Customer Modal */}
      <Modal opened={opened} onClose={handleCloseCreate} title="신규 거래처 등록" centered size="lg"
        styles={{ 
            content: { backgroundColor: '#1A1B1E', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }, 
            body: { backgroundColor: '#1A1B1E', color: 'white' }
        }}
        overlayProps={{
            backgroundOpacity: 0.55,
            blur: 3,
        }}
        
      >
        <Stack gap="md">
            {/* Split UI for Type Selection */}
            <Box visibleFrom="sm">
                <Select label="유형" data={typeData} 
                    value={newType} onChange={(v) => setNewType(v as 'BUSINESS' | 'INDIVIDUAL')}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }, dropdown: { backgroundColor: '#25262B', border: '1px solid rgba(255,255,255,0.1)' }, option: { color: 'white' } }}
                />
            </Box>
            <Box hiddenFrom="sm">
                <NativeSelect label="유형" data={typeData}
                    value={newType} onChange={(e) => setNewType(e.currentTarget.value as 'BUSINESS' | 'INDIVIDUAL')}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
                />
            </Box>

            {/* Split UI for Payment Selection - Moved to 2nd position */}
            <Box visibleFrom="sm">
                <Select label="결제 유형" data={paymentData}
                    value={newPaymentType} onChange={(v) => setNewPaymentType(v as string)}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }, dropdown: { backgroundColor: '#25262B', border: '1px solid rgba(255,255,255,0.1)' }, option: { color: 'white' } }}
                />
            </Box>
            <Box hiddenFrom="sm">
                <NativeSelect label="결제 유형" data={paymentData}
                    value={newPaymentType} onChange={(e) => setNewPaymentType(e.currentTarget.value)}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem', height: '50px' } }}
                />
            </Box>

            <TextInput label="거래처명" placeholder="상호명 입력" required 
                value={newName} onChange={(e) => setNewName(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem', height: '50px' } }}
            />
            
             <TextInput label="사업자 번호" placeholder="000-00-00000"
                value={newBusinessNumber} onChange={(e) => setNewBusinessNumber(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
             <TextInput label="법인등록번호" placeholder="000000-0000000"
                value={newCorporateId} onChange={(e) => setNewCorporateId(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
             <TextInput label="대표자" placeholder="대표자 성명"
                value={newRepresentative} onChange={(e) => setNewRepresentative(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
            <TextInput label="주소" placeholder="주소 입력"
                value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
            />
            <Group grow>
                <TextInput label="전화1" placeholder="010-0000-0000"
                    value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
                />
                 <TextInput label="팩스" placeholder="02-000-0000"
                    value={newFax} onChange={(e) => setNewFax(e.target.value)}
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } }}
                />
            </Group>
            
            <Group grow mt="md">
                <Button onClick={() => handleAddCustomer(false)} loading={loading} color="blue" size="lg">등록대장에 저장</Button>
                {isAdmin && (
                    <Button onClick={() => handleAddCustomer(true)} loading={loading} color="yellow" size="lg" variant="outline">저장 후 QR 인쇄</Button>
                )}
            </Group>
        </Stack>
      </Modal>

      </PageTransition>

      <CustomerDetailModal 
        opened={detailOpened} 
        onClose={handleCloseDetail} 
        customer={selectedCustomer}
        onUpdate={fetchCustomers}
        initialTab={searchParams.get('tab') || 'inventory'} // Pass URL Param
        isAdmin={isAdmin}
      />
      {/* QR Modal */}
      <QRPrintModal
          opened={qrModalOpened}
          onClose={() => {
              closeQrModal();
              setPrintTarget(null); // Instant reset
          }}
          title={selectionMode === 'QR' ? `선택된 거래처 (${selectedIds.size})` : (printTarget ? "거래처" : "전체 거래처")} 
          data={
               (selectionMode === 'QR' && selectedIds.size > 0 
                ? filteredCustomers.filter(c => selectedIds.has(c.id))
                : printTarget 
                  ? [printTarget] 
                  : filteredCustomers
               ).map(c => ({
                   // [Immutable QR] Use UUID (c.id)
                   // Old: `CUST-${c.ledgerNumber || c.id}` (Mutable & Inconsistent)
                   id: c.id,
                   label: c.name,
                   subLabel: c.representative,
                   desc: c.address
               }))
          }
      />
    </AppLayout>
  );
}
