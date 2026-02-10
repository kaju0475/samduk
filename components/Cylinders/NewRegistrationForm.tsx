import { useState, useEffect } from 'react';
import { Cylinder } from '@/lib/types';
import { Stack, TextInput, Autocomplete, Button, Group, SegmentedControl, Text, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconChevronDown, IconPrinter } from '@tabler/icons-react';
import { MonthPickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { RackCylinderManager } from './RackCylinderManager';
import { useDisclosure } from '@mantine/hooks';
import '@mantine/dates/styles.css';
import 'dayjs/locale/ko';

const GAS_OPTIONS = [
    '산소', '질소', '아르곤', '탄산', '헬륨', '수소', 'Air', 'LPG', '아세틸렌', '혼합가스'
];

interface NewRegistrationFormProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (newItem?: any, shouldPrint?: boolean) => void;
    onCancel: () => void;
    initialData?: Partial<Cylinder>; // For Edit Mode
    allCylinders?: Cylinder[]; // [New] For Rack Validation
}

// Helper to get YYYY-MM-DD
import dayjs from 'dayjs';

export function NewRegistrationForm({ onSuccess, onCancel, initialData, allCylinders = [] }: NewRegistrationFormProps) {
    const isEdit = !!initialData;
    const [loading, setLoading] = useState(false);
    
    // Core Data
    const [serialNumber, setSerialNumber] = useState(initialData?.serialNumber || '');
    const [containerType, setContainerType] = useState<string>(initialData?.containerType || 'CYLINDER'); // CYLINDER, SIPHON, LGC, RACK
    const [gasType, setGasType] = useState(initialData?.gasType || ''); // Default to blank as requested
    const [capacity, setCapacity] = useState(initialData?.capacity || ''); // Default to blank as requested
    const [owner, setOwner] = useState(initialData?.owner || 'SAMDUK');
    
    // [RACK STATE]
    const [bundleCount, setBundleCount] = useState<number>(initialData?.bundleCount || 12);
    const [childSerials, setChildSerials] = useState<string[]>(initialData?.childSerials || []);
    const [managerOpened, { open: openManager, close: closeManager }] = useDisclosure(false);

    // Dates (Initialize with dayjs for robustness)
    const [manufactureDate, setManufactureDate] = useState<Date | null>(
        initialData?.manufactureDate ? dayjs(initialData.manufactureDate).toDate() : null
    );
    const [chargingExpiryDate, setChargingExpiryDate] = useState<Date | null>(
        initialData?.chargingExpiryDate ? dayjs(initialData.chargingExpiryDate).toDate() : null
    );

    // [Fix] Sync state if initialData changes (Reliable Edit Mode)
    useEffect(() => {
        if (initialData) {
            setSerialNumber(initialData.serialNumber || '');
            setContainerType(initialData.containerType || 'CYLINDER');
            setGasType(initialData.gasType || '');
            setCapacity(initialData.capacity || '');
            setOwner(initialData.owner || 'SAMDUK');
            setBundleCount(initialData.bundleCount || 12);
            setChildSerials(initialData.childSerials || []);
            setManufactureDate(initialData.manufactureDate ? dayjs(initialData.manufactureDate).toDate() : null);
            setChargingExpiryDate(initialData.chargingExpiryDate ? dayjs(initialData.chargingExpiryDate).toDate() : null);
        }
    }, [initialData]);

    // Update capacity options based on container type
    useEffect(() => {
        if (containerType === 'LGC') {
            // If current capacity is not valid for LGC, clear it to force user selection
            if (capacity !== '175L' && capacity !== '80L') setCapacity('');
        } else if (containerType !== 'RACK') {
             // If switching back from LGC (high capacity), clear it.
             // If it was already a valid small capacity or empty, leave it alone.
             if (capacity === '175L' || capacity === '80L') setCapacity('');
        }
    }, [containerType, capacity]);

    // KGS Standard Expiry Calculation
    useEffect(() => {
        if (manufactureDate) {
            // [Fix] Prevent overwriting existing expiry date on initial load
            // Only recalculate if manufactureDate is different from initialData (meaning user changed it)
            // OR if there is no initialExpiryDate
            if (initialData?.manufactureDate && initialData?.chargingExpiryDate) {
                const initManuf = dayjs(initialData.manufactureDate);
                const currentManuf = dayjs(manufactureDate);
                
                // Compare Year-Month (since inputs are month-pickers)
                if (initManuf.format('YYYY-MM') === currentManuf.format('YYYY-MM')) {
                     // It is the initial date, so assume the initial expiry is correct/desired.
                     // Do NOT overwrite with auto-calculation.
                     return;
                }
            }

            const manufDateObj = dayjs(manufactureDate);
            
            if (manufDateObj.isValid()) {
                const today = dayjs();
                let cursorDate = manufDateObj; // Clone effectively

                // Exception: If ManufDate is in the future
                if (cursorDate.isAfter(today)) {
                    setChargingExpiryDate(cursorDate.toDate());
                    return;
                }

                while (true) {
                    const age = cursorDate.year() - manufDateObj.year();
                    let interval = 5;

                    if (containerType === 'LGC') {
                        if (age >= 20) interval = 1;
                        else if (age >= 15) interval = 2;
                        else interval = 5;
                    } else {
                        // Cylinder Rules
                        if (age > 10) interval = 3;
                        else interval = 5;
                    }

                    // Calculate next expiry candidate
                    const nextDate = cursorDate.add(interval, 'year');

                    // Compare total months to avoid day-level skips
                    const nextTotalMonths = nextDate.year() * 12 + nextDate.month();
                    const todayTotalMonths = today.year() * 12 + today.month();

                    cursorDate = nextDate;

                    // If the calculated expiry is NOT in the past (it's this month or future), stop.
                    if (nextTotalMonths >= todayTotalMonths) {
                        break;
                    }
                }
                
                setChargingExpiryDate(cursorDate.toDate());
            }
        }
    }, [manufactureDate, containerType, initialData]);

    // [Auto-complete] History State
    const [recentGasTypes, setRecentGasTypes] = useState<string[]>([]);
    const [recentCapacities, setRecentCapacities] = useState<string[]>([]);

    useEffect(() => {
        try {
            const loadedGas = JSON.parse(localStorage.getItem('RECENT_GAS_TYPES') || '[]');
            const loadedCaps = JSON.parse(localStorage.getItem('RECENT_CAPACITIES') || '[]');
            setRecentGasTypes(loadedGas);
            setRecentCapacities(loadedCaps);
        } catch (e) {
            console.error('Failed to load history', e);
        }
    }, []);

    // Merge defaults with history
    const gasOptions = [...new Set([...GAS_OPTIONS, ...recentGasTypes])];
    const defaultCapacities = containerType === 'LGC' ? ['175L', '80L'] : ['40L', '47L', '10L', '20L'];
    const capacityOptions = [...new Set([...defaultCapacities, ...recentCapacities])];


    const handleSubmit = async (shouldPrint: boolean = false) => {
        if (!serialNumber.trim()) {
            notifications.show({ title: '오류', message: '일련번호를 입력해주세요.', color: 'red' });
            return;
        }

        // [RACK VALIDATION]
        if (containerType === 'RACK') {
             // [Fix] Allow saving if count matches OR if it's 0 (User clearing the rack)
             // User Request: "If there are no sub-cylinders, I should be able to edit."
             if (childSerials.length > 0 && childSerials.length !== bundleCount) {
                 notifications.show({ title: '수량 불일치', message: `기준 수량(${bundleCount}개)과 등록된 용기 수(${childSerials.length}개)가 다릅니다.\n(0개이거나 기준 수량과 일치해야 합니다)`, color: 'red' });
                 return;
             }
        }

        if (!manufactureDate || !chargingExpiryDate) {
            notifications.show({ title: '오류', message: '제조년월과 충전기한을 입력해주세요.', color: 'red' });
            return;
        }

        setLoading(true);
        try {
            // [Auto-complete] Save to History (but don't auto-fill next time)
            if (gasType) {
                const newGasHistory = [...new Set([gasType, ...recentGasTypes])].slice(0, 10); // Keep top 10
                localStorage.setItem('RECENT_GAS_TYPES', JSON.stringify(newGasHistory));
                setRecentGasTypes(newGasHistory);
            }
            if (capacity && containerType !== 'RACK') {
                const newCapHistory = [...new Set([capacity, ...recentCapacities])].slice(0, 10);
                localStorage.setItem('RECENT_CAPACITIES', JSON.stringify(newCapHistory));
                setRecentCapacities(newCapHistory);
            }

            // Ensure dates are valid Date objects
            // Date formatting is handled directly in body construction using dayjs

            const body = {
                id: initialData?.id, // Includes ID if editing
                serialNumber,
                containerType,
                gasType,
                capacity,
                owner,
                manufactureDate: manufactureDate ? dayjs(manufactureDate).format('YYYY-MM') : '',
                chargingExpiryDate: chargingExpiryDate ? dayjs(chargingExpiryDate).format('YYYY-MM') : '',
                status: '공병', // Default status for new registration
                currentHolderId: '삼덕공장', // Default holder for new registration
                // [RACK FIELDS]
                bundleCount: containerType === 'RACK' ? bundleCount : undefined,
                childSerials: containerType === 'RACK' ? childSerials : undefined,
            };

            const method = isEdit ? 'PUT' : 'POST';
            const url = '/api/master/cylinders';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const result = await res.json();
            
            // [Check Duplicate]
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
                 return;
            }

            if (result.success) {
                notifications.show({ 
                    title: '성공', 
                    message: isEdit ? '용기 정보가 수정되었습니다.' : '용기가 정상적으로 등록되었습니다.', 
                    color: 'teal' 
                });
                onSuccess(result.data, shouldPrint);
            } else {
                throw new Error(result.message || '등록 실패');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '알 수 없는 오류';
            notifications.show({ title: '등록 실패', message, color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Stack gap="md">
            <TextInput
                label="일련번호 (Serial No.)"
                placeholder="예: O2-2024-001"
                required
                data-autofocus
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
            />

            <Stack gap={3}>
                <Text size="sm" fw={500}>용기 종류</Text>
                <SegmentedControl
                    value={containerType}
                    onChange={setContainerType}
                    data={[
                        { label: '실린더', value: 'CYLINDER' },
                        { label: '싸이폰', value: 'SIPHON' },
                        { label: '초저온 (LGC)', value: 'LGC' },
                        { label: '렉 (Rack)', value: 'RACK' },
                    ]}
                    color="blue"
                    fullWidth
                />
            </Stack>

            <Group grow align="flex-start">
                 <Autocomplete
                    label="가스 종류 (Gas Type)"
                    placeholder="선택하거나 직접 입력"
                    data={gasOptions}
                    required
                    value={gasType}
                    onChange={setGasType}
                    rightSection={<IconChevronDown size={14} style={{ opacity: 0.5 }} />}
                />

                {containerType === 'RACK' ? (
                     <NumberInput
                        label="기준 수량 (Bundle Qty)"
                        value={bundleCount}
                        onChange={(val) => setBundleCount(Number(val))}
                        min={1}
                        max={30}
                        allowNegative={false}
                     />
                ) : (
                    <Autocomplete
                        label="용기 용량 (Capacity)"
                        placeholder="선택하거나 직접 입력 (예: 100L)"
                        data={capacityOptions}
                        required
                        value={capacity}
                        onChange={setCapacity}
                        rightSection={<IconChevronDown size={14} style={{ opacity: 0.5 }} />}
                    />
                )}
            </Group>

            {containerType === 'RACK' && (
                <Button 
                    variant="light" 
                    color={childSerials.length === bundleCount ? 'teal' : 'orange'}
                    onClick={openManager}
                >
                    용기 관리 ({childSerials.length} / {bundleCount})
                </Button>
            )}

            <RackCylinderManager
                opened={managerOpened}
                onClose={closeManager}
                addedSerials={childSerials}
                onAdd={(serial) => setChildSerials(prev => [...prev, serial])}
                onRemove={(serial) => setChildSerials(prev => prev.filter(s => s !== serial))}
                maxCount={bundleCount}
                allCylinders={allCylinders}
            />

            <Stack gap="xs">
                <MonthPickerInput
                    label="제조 년월 (Manufacture Date)"
                    placeholder="제조년월 선택"
                    required
                    value={manufactureDate}
                    onChange={(date: unknown) => setManufactureDate(date as Date | null)}
                    locale="ko"
                    valueFormat="YYYY년 MM월"
                    maxDate={new Date()}
                />
                <MonthPickerInput
                    label="충전 기한 (Expiry Date)"
                    description={manufactureDate ? "KGS 기준 자동 계산됨 (수동 수정 가능)" : "제조년월을 먼저 선택하세요"}
                    placeholder="자동 계산 또는 선택"
                    required
                    value={chargingExpiryDate}
                    onChange={(date: unknown) => setChargingExpiryDate(date as Date | null)}
                    locale="ko"
                    valueFormat="YYYY년 MM월"
                />
            </Stack>

            <TextInput
                label="소유자 (Owner)"
                description="자사 용기인 경우 'SAMDUK' 유지"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
            />

            <Group justify="flex-end" mt="md" grow>
                <Button variant="light" color="gray" onClick={onCancel}>취소</Button>
                <Button 
                    loading={loading} 
                    leftSection={<IconDeviceFloppy size={18} />} 
                    color="teal" 
                    onClick={() => handleSubmit(false)}
                >
                    {isEdit ? '수정 저장' : '등록 완료'}
                </Button>
                <Button 
                    loading={loading} 
                    leftSection={<IconPrinter size={18} />} 
                    color="yellow" 
                    variant="outline"
                    onClick={() => handleSubmit(true)}
                >
                    {isEdit ? '저장 후 QR 인쇄' : '저장 후 QR 인쇄'}
                </Button>
            </Group>
        </Stack>
    );
}
