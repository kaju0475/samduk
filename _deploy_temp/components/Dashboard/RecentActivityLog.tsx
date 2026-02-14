'use client';

import { Paper, Text, Group, Stack, Flex, Badge, Button, SegmentedControl } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSmartPolling } from '@/app/hooks/useSmartPolling';
import { CylinderHistoryModal } from '@/components/History/CylinderHistoryModal';
import { CustomerDetailModal } from '@/app/master/customers/CustomerDetailModal';
import { UserHistoryModal } from '@/components/History/UserHistoryModal';
import { Customer } from '@/lib/types';
import { useDisclosure } from '@mantine/hooks';
import { GasBadge } from '@/components/Common/GasBadge';
import { resolveShortHolderName } from '@/app/utils/display';

interface Log {
  code: string;
  desc: string;
  time: string;
  color: string;
  rawType?: string;
  worker?: string;
  workerId?: string;
  gasType?: string;
  gasTypeColor?: string;
  customerId?: string;
}

export function RecentActivityLog() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState('ALL');

  // Modals
  const [cylinderModalOpen, { open: openCylinderHistory, close: closeCylinderHistory }] = useDisclosure(false);
  const [selectedCylinderId, setSelectedCylinderId] = useState<string | null>(null);

  const [detailModalOpen, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [userModalOpen, { open: openUserHistory, close: closeUserHistory }] = useDisclosure(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>('');

  const handleCylinderClick = (id: string) => {
      setSelectedCylinderId(id);
      openCylinderHistory();
  };

  const handleCustomerClick = async (customerId: string) => {
      if (!customerId) return;
      try {
          const res = await fetch('/api/master/customers'); 
          const json = await res.json();
          if (json.success) {
              const found = json.data.find((c: Customer) => c.id === customerId);
              if (found) {
                  setSelectedCustomer(found);
                  openDetail();
              }
          }
      } catch(e) {
          console.error(e);
      }
  };

  const handleWorkerClick = (workerId: string, workerName: string) => {
      if (!workerId) return;
      setSelectedUserId(workerId);
      setSelectedUserName(workerName);
      openUserHistory();
  };

  const fetchLogs = useCallback(async (currentFilter?: string) => {
    try {
      const targetFilter = currentFilter || filter; 
      const logsRes = await fetch(`/api/dashboard/logs?filter=${targetFilter}`);
      if (!logsRes.ok) return;
      const logsData = await logsRes.json();
      if (Array.isArray(logsData)) {
          setLogs(logsData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard logs', error);
    }
  }, [filter]);

  // [Power Optimization] Use Smart Polling (Stops when hidden, slows when idle)
  useSmartPolling({
      callback: () => fetchLogs(filter),
      activeInterval: 5000,   // Active: 5s
      idleInterval: 15000,    // Idle: 15s (Slower)
      hiddenInterval: 0,      // Hidden: STOP
      idleTimeout: 30000      // Time until consider idle: 30s
  });

  useEffect(() => {
    // Initial fetch on mount or filter change (Immediate)
    const timer = setTimeout(() => {
        void fetchLogs(); 
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  return (
    <>
        <Paper p={{ base: 'md', md: 'lg' }} radius="lg" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative', 
            boxShadow: 'none', 
            zIndex: 1
        }}>
            <Group justify="space-between" mb="sm">
                <Group gap="xs">
                    <Text fw={700} size="xl" c="white" style={{ letterSpacing: '-0.5px' }} fz={{ base: '1.25rem', md: '1.75rem' }}>최근 상세 활동 로그</Text>
                    <Button variant="subtle" color="gray" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => fetchLogs(filter)}>
                        새로고침
                    </Button>
                </Group>
               
                <Group>
                    <SegmentedControl
                      value={filter}
                      onChange={(value) => {
                          setFilter(value);
                          fetchLogs(value); 
                      }}
                      data={[
                        { label: '전체', value: 'ALL' },
                        { label: '납품 / 회수', value: 'DELIVERY' },
                        { label: '충전 관리', value: 'CHARGING' },
                        { label: '검사 입고/출고', value: 'INSPECTION' },
                      ]}
                      size="sm"
                      radius="md"
                      bg="#25262B"
                      color="blue"
                      styles={{
                          root: { border: '1px solid rgba(255,255,255,0.1)' },
                          label: { color: '#C1C2C5' }
                      }}
                    />
                </Group>
            </Group>
            <Stack gap="xs">
                {logs.length > 0 ? (
                     logs.filter(log => log && log.desc && (!log.desc.includes('Included in RACK') && !log.desc.includes(')에 포함'))).map((log, i) => {
                          let itemColor = '#adb5bd'; 
                          const type = (log.rawType || '');
                         
                         if (type === 'START' || type === '충전 시작' || type === '충전시작' || type === 'CHARGING_START') itemColor = '#FF922B'; 
                         else if (type === 'COMPLETE' || type === 'CHARGE' || type === '충전 완료' || type === '충전완료' || type === '충전' || type === 'CHARGING_COMPLETE') itemColor = '#20C997'; 
                         else if (type === 'INSPECTION_IN' || type === '검사입고' || type === 'INSPECTION_RETURN') itemColor = '#BE4BDB'; 
                         else if (type === 'INSPECTION_OUT' || type === '검사출고' || type === 'INSPECTION_SEND') itemColor = '#F06595'; 
                         else if (type === 'DELIVERY' || type === '납품') itemColor = '#339AF0'; 
                         else if (type.includes('COLLECTION') || type.includes('회수')) itemColor = '#40C057'; 
                         
                         const timeStr = log.time || '';
                         const parts = timeStr.split('. '); 
                         const dateStr = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : timeStr;

                         const workerNameDisplay = (log.worker === 'WORKER-DEFAULT' || log.worker === 'DEFAULT') ? '관리자' : (log.worker || 'WORKER').replace('WORKER-', '');

                         return (
                            <Paper key={i} p={{ base: 'xs', md: 'sm' }} radius="md" style={{ 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                borderLeft: `5px solid ${itemColor}`
                            }}>
                                <Flex align="center" gap={{ base: 'xs', md: 'md' }}>
                                    <Stack gap={2} align="center" w={{ base: 50, md: 70 }} style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }} pr="xs">
                                        <Text fw={700} c="white" fz={{ base: '0.8rem', md: '0.9rem' }}>{dateStr}</Text>
                                        {log.gasType && (
                                            <GasBadge gasType={log.gasType} size="xs" style={{ padding: '0 4px', height: '18px' }} />
                                        )}
                                    </Stack>

                                    <Stack gap={2} style={{ flex: 1 }}>
                                        <Group gap="xs" align="center">
                                            <Text 
                                                size="lg" 
                                                fw={700} 
                                                style={{ color: itemColor, cursor: 'pointer', textDecoration: 'underline' }} 
                                                fz={{ base: '0.95rem', md: '1rem' }}
                                                onClick={() => handleCylinderClick(log.code)}
                                            >
                                                {log.code}
                                            </Text>
                                        </Group>
                                        <Group gap={4} align="center" wrap="nowrap">
                                             <Text 
                                                size="sm" 
                                                c="dimmed" 
                                                fz={{ base: '0.8rem', md: '0.9rem' }} 
                                                truncate
                                                style={log.customerId ? { cursor: 'pointer', textDecoration: 'underline' } : {}}
                                                onClick={() => log.customerId && handleCustomerClick(log.customerId)}
                                            >
                                                {resolveShortHolderName(log.desc)}
                                            </Text>
                                        </Group>
                                    </Stack>

                                    {/* Worker Badge - Clickable */}
                                    <Badge 
                                        variant="light" 
                                        color="gray" 
                                        size="sm" 
                                        radius="sm" 
                                        visibleFrom="xs"
                                        style={log.workerId ? { cursor: 'pointer' } : {}}
                                        onClick={() => log.workerId && handleWorkerClick(log.workerId, workerNameDisplay)}
                                    >
                                        {workerNameDisplay}
                                    </Badge>
                                </Flex>
                            </Paper>
                         );
                    })
                ) : (
                   <Text c="dimmed" size="xl" ta="center" py="xl">최근 활동 내역이 없습니다.</Text>
                )}
            </Stack>
        </Paper>

        <CylinderHistoryModal 
            opened={cylinderModalOpen} 
            onClose={closeCylinderHistory} 
            cylinderId={selectedCylinderId || ''} 
        />
        <CustomerDetailModal
            opened={detailModalOpen}
            onClose={closeDetail}
            customer={selectedCustomer}
            onUpdate={() => fetchLogs()}
        />
        <UserHistoryModal 
            opened={userModalOpen} 
            onClose={closeUserHistory} 
            userId={selectedUserId || ''} 
            userName={selectedUserName} 
        />
    </>
  );
}
