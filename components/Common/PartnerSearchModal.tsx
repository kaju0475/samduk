import { Modal, TextInput, Stack, Text, Button, ScrollArea, Group, Badge } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { Customer } from '@/lib/types';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PartnerSearchModalProps {
    opened: boolean;
    onClose: () => void;
    onSelect: (customer: Customer) => void;
}

import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

export function PartnerSearchModal({ opened, onClose, onSelect }: PartnerSearchModalProps) {
    // [STATE] Restore Query State
    const [searchQuery, setSearchQuery] = useState('');

    const closeWithCleanup = () => {
        setSearchQuery('');
        onClose();
    };
    
    const handleClose = useModalBackTrap(opened, closeWithCleanup, 'partner-search');
    
    // [OPTIMIZATION] Use SWR for caching (Instant open after first load)
    const { data: swrData, isLoading } = useSWR('/api/master/customers', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60000, // Cache for 1 minute
        keepPreviousData: true
    });

    const customers: Customer[] = useMemo(() => swrData?.success ? swrData.data : [], [swrData]);



    // Filter Logic including Ledger Number & ID
    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        return customers.filter(c => {
            const query = searchQuery.toLowerCase();
            const target = query.replace(/cust-/i, '');
            
            return (
                c.name.toLowerCase().includes(query) || 
                (c.businessNumber && c.businessNumber.includes(query)) ||
                (c.ledgerNumber && c.ledgerNumber.toString().includes(target)) || 
                c.id.toLowerCase().includes(target) || 
                c.id.toLowerCase().includes(query)
            );
        });
    }, [customers, searchQuery]);

    // [Smart Scanner] Auto-select if scan detected and unique match found
    useEffect(() => {
        const isScan = /^(cust-|test-)/i.test(searchQuery);

        if (isScan && filteredCustomers.length === 1) {
            const match = filteredCustomers[0];
            notifications.show({ 
                title: '스캐너 감지', 
                message: `${match.name} 거래처가 선택되었습니다.`, 
                color: 'green',
                autoClose: 1500 
            });
            onSelect(match);
            handleClose();
        }
    }, [searchQuery, filteredCustomers, onSelect, onClose, handleClose]);

    return (
        <Modal 
            opened={opened} 
            onClose={handleClose} 
            title="거래처 검색" 
            centered 
            size="lg"
            styles={{
                content: { backgroundColor: '#1A1B1E', color: 'white', border: '1px solid rgba(255,255,255,0.1)' },
                header: { backgroundColor: '#1A1B1E', color: 'white' },
                body: { backgroundColor: '#1A1B1E', color: 'white' }
            }}
            closeOnEscape={false}
        >
            <Stack>
                <TextInput
                    placeholder="거래처명 또는 사업자번호 검색"
                    leftSection={<IconSearch size={20} />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size="md"
                    styles={{ input: { backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.2rem', height: '50px' } }}
                    data-autofocus
                />

                <ScrollArea h={300} type="always">
                    <Stack gap="xs">
                        {isLoading ? (
                            <Text c="dimmed" ta="center" py="xl">로드 중...</Text>
                        ) : filteredCustomers.length === 0 ? (
                            <Text c="dimmed" ta="center" py="xl">검색 결과가 없습니다.</Text>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <Button
                                    key={customer.id}
                                    variant="light"
                                    color="gray"
                                    fullWidth
                                    h="auto"
                                    py="md"
                                    styles={{ 
                                        root: { height: 'auto', padding: '12px' }, 
                                        inner: { justifyContent: 'flex-start' }, 
                                        label: { width: '100%', whiteSpace: 'normal', overflow: 'hidden', textAlign: 'left' } 
                                    }}
                                    onClick={() => {
                                        onSelect(customer);
                                        handleClose();
                                    }}
                                >
                                    <Group justify="space-between" w="100%">
                                        <Stack gap={2}>
                                            <Text size="md" fw={700} style={{ fontSize: '1.2rem' }}>{customer.name}</Text>
                                            <Text size="sm" c="dimmed" style={{ fontSize: '1rem' }}>{customer.address || '주소 없음'}</Text>
                                        </Stack>
                                        {customer.type === 'BUSINESS' && <Badge color="blue" size="sm" variant="outline">사업자</Badge>}
                                    </Group>
                                </Button>
                            ))
                        )}
                    </Stack>
                </ScrollArea>
            </Stack>
        </Modal>
    );
}
