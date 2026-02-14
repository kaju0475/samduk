'use client';

import { Modal, Table, Button, Group, Text, ScrollArea, LoadingOverlay, Box } from '@mantine/core';
import { Fragment, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconPrinter } from '@tabler/icons-react';
import { DatesProvider, MonthPickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

import { Customer, GasItem } from '@/lib/types';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';


// --- Interfaces Definitions (Moved to Top) ---
interface DeliveryRecord {
    id: string;
    customer: string;
    gas: string;
    type: '납품' | '회수';
    date: string;
    cylinderId: string;
    worker: string;
    customerId?: string;
    containerType?: string; 
    capacity?: string; // [NEW] Capacity for precise ledger tracking
}

interface LedgerRowData {
    full: number;
    empty: number;
    balance: number;
}

interface LedgerRow {
    date: number;
    dateStr: string;
    worker: string;
    data: Record<number, LedgerRowData>; // Keyed by slot index
}

interface DailyTransactionLedgerModalProps {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null; 
}

export function DailyTransactionLedgerModal({ opened, onClose, customer }: DailyTransactionLedgerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const handleClose = useModalBackTrap(opened, onClose, 'daily-ledger');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<DeliveryRecord[]>([]);
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const initialPinchDistRef = useRef<number | null>(null); 
  const [lastZoom, setLastZoom] = useState(1);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current && tableContainerRef.current) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = dist / initialPinchDistRef.current;
        let targetZoom = lastZoom * delta;
        targetZoom = Math.min(Math.max(targetZoom, 0.5), 2.0);
        const effectiveScale = targetZoom / lastZoom;

        tableContainerRef.current.style.transform = `scale(${effectiveScale})`;
        tableContainerRef.current.style.transformOrigin = 'top left';
    }
  };

  const handleTouchEnd = () => {
    if (initialPinchDistRef.current && tableContainerRef.current) {
        const finalTransform = tableContainerRef.current.style.transform;
        const match = finalTransform.match(/scale\((.+)\)/);
        if (match) {
            const effectiveScale = parseFloat(match[1]);
            let newZoom = lastZoom * effectiveScale;
            newZoom = Math.min(Math.max(newZoom, 0.5), 2.0);
            setZoomLevel(newZoom);
            setLastZoom(newZoom);
            tableContainerRef.current.style.transform = '';
        }
    }
    initialPinchDistRef.current = null;
  };
 
    const BASE_HEADER_HEIGHT = 65;
    const currentFontSize = `${Math.max(10, Math.floor(12 * zoomLevel))}px`;
    const currentHeaderHeight = `${Math.ceil(BASE_HEADER_HEIGHT * zoomLevel)}px`; 
    const currentCellPadding = `${Math.max(1, Math.floor(4 * zoomLevel))}px`;

  // Calculate Data
  useEffect(() => {
    if (opened && customer) {
        const fetchData = async () => {
             setLoading(true);
            try {
                const [txRes] = await Promise.all([
                    fetch('/api/work/delivery')
                ]);
                
                const txData = await txRes.json();

                if (txData.success) {
                    const allTx = (txData.data as DeliveryRecord[]).filter(tx => 
                        tx.customer === customer.name || tx.customerId === customer.id
                    );
                    setTransactions(allTx);
                }
            } catch (error) {
                console.error("Failed to fetch ledger data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }
  }, [opened, customer]);

  const handlePrint = () => {
    window.print();
  };

  // Define a local extended type for slot management
  type ExtendedGasItem = GasItem & { type: 'FIXED' | 'DYNAMIC' | 'ADHOC' };

  const getDailyRows = (): { rows: LedgerRow[], slots: (ExtendedGasItem | null)[] } => {
      if (!selectedDate || !customer) return { rows: [], slots: [] };
      
      const currentMonth = dayjs(selectedDate);
      const startOfMonth = currentMonth.startOf('month');
      const daysInMonth = currentMonth.daysInMonth();
      
      // 1. Identify Unique Pairs of (Gas + Capacity)
      // We group by "GasName|Capacity" to distinguish between CO2 40kg and CO2 20kg
      const uniqueGasPairs = new Map<string, { gas: string, capacity: string }>();
      transactions.forEach(t => {
          const cap = t.capacity || '기본';
          const key = `${t.gas}|${cap}`;
          if (!uniqueGasPairs.has(key)) {
              uniqueGasPairs.set(key, { gas: t.gas, capacity: cap });
          }
      });
      
      const pairs = Array.from(uniqueGasPairs.values());
      const slots: (ExtendedGasItem | null)[] = Array(8).fill(null);
      
      // Priority Assignment: "산소" and "알곤"
      const o2Match = pairs.find(p => p.gas === '산소');
      const arMatch = pairs.find(p => p.gas === '알곤');

      if (o2Match) {
          slots[0] = { id: 'fixed-o2', name: o2Match.gas, capacity: o2Match.capacity, type: 'FIXED' } as ExtendedGasItem;
      } else {
          slots[0] = { id: 'fixed-o2', name: '산소', capacity: '', type: 'FIXED' } as ExtendedGasItem;
      }

      if (arMatch) {
          slots[1] = { id: 'fixed-ar', name: arMatch.gas, capacity: arMatch.capacity, type: 'FIXED' } as ExtendedGasItem;
      } else {
          slots[1] = { id: 'fixed-ar', name: '알곤', capacity: '', type: 'FIXED' } as ExtendedGasItem;
      }
      
      // Dynamic Assignment (Remaining slots)
      let dynamicIndex = 2;
      pairs.forEach(p => {
          // Skip if already assigned as fixed
          const isO2Fixed = slots[0]?.name === p.gas && slots[0]?.capacity === p.capacity;
          const isArFixed = slots[1]?.name === p.gas && slots[1]?.capacity === p.capacity;
          if (isO2Fixed || isArFixed) return;

          if (dynamicIndex < 8) {
              slots[dynamicIndex] = { 
                  id: `dynamic-${p.gas}-${p.capacity}`, 
                  name: p.gas, 
                  capacity: p.capacity, 
                  type: 'DYNAMIC' 
              } as ExtendedGasItem;
              dynamicIndex++;
          }
      });

      // 2. Calculate Initial Balance (Before Start of Month)
      const prevTx = transactions.filter(tx => dayjs(tx.date).isBefore(startOfMonth));
      const initialBalances: Record<number, number> = {}; 

      slots.forEach((gas, idx) => {
          if (!gas || !gas.name) return; 
          let bal = 0;
          prevTx.filter(tx => tx.gas === gas.name && (tx.capacity || '기본') === (gas.capacity || '기본')).forEach(tx => {
              if (tx.containerType === 'RACK') return;
              if (tx.type === '납품') bal -= 1; 
              else if (tx.type === '회수') bal += 1; 
          });
          initialBalances[idx] = bal; 
      });

      // 3. Build Daily Rows
      const rows: LedgerRow[] = [];
      const runningBalances = { ...initialBalances };

      for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = currentMonth.date(day).format('YYYY-MM-DD');
          const dayTx = transactions.filter(tx => tx.date.startsWith(dateStr));
          
          const rowData: LedgerRow = { date: day, dateStr: dateStr, data: {}, worker: '' };
          const workers = Array.from(new Set(dayTx.map(t => t.worker))).join(', ');
          rowData.worker = workers;

          slots.forEach((gas, idx) => {
              if (!gas || (gas.type === 'FIXED' && !pairs.some(p => p.gas === gas.name))) {
                   rowData.data[idx] = { full: 0, empty: 0, balance: runningBalances[idx] || 0 };
                   return;
              }

              const gasTx = dayTx.filter(tx => tx.gas === gas.name && (tx.capacity || '기본') === (gas.capacity || '기본'));
              let full = 0;
              let empty = 0;

              gasTx.forEach(tx => {
                  if (tx.containerType === 'RACK') return; 
                  if (tx.type === '납품') full++;
                  else if (tx.type === '회수') empty++;
              });

              runningBalances[idx] = (runningBalances[idx] || 0) + empty - full;

              rowData.data[idx] = {
                  full: full,
                  empty: empty,
                  balance: runningBalances[idx]
              };
          });
          
          rows.push(rowData);
      }

      return { rows, slots };
  };

  const { rows, slots } = getDailyRows();

  const printContent = (
    <div className="print-portal">
         {/* Global Print Styles moved to app/globals.css for stability */}
         
         <div className="title-area">거 래 장</div>
         <div className="header-info">
             <span>거래처: {customer?.name}</span>
             <span>기간: {dayjs(selectedDate).format('YYYY년 MM월')}</span>
         </div>

         <table className="ledger-table">
             <thead>
                 <tr>
                     {/* Year Cell - Matches Screenshot Logic roughly */}
                     <th colSpan={2} style={{ width: '60px' }}>년</th>
                     
                      {slots.map((gas, idx) => (
                          <th key={idx} colSpan={3}>
                              {gas ? (
                                  <>
                                      <div>{gas.name}</div>
                                      {gas.capacity && <div style={{ fontSize: '0.7em', fontWeight: 'normal' }}>({gas.capacity})</div>}
                                  </>
                              ) : ''}
                          </th>
                      ))}
                     <th rowSpan={2} style={{ width: '60px' }}>인수자<br/>확 인</th>
                 </tr>
                 <tr>
                     <th style={{ width: '30px' }}>월</th>
                     <th style={{ width: '30px' }}>일</th>
                     
                     {slots.map((_, idx) => (
                         <Fragment key={idx + '_sub'}>
                             <th>실</th>
                             <th>공</th>
                             <th>잔</th>
                         </Fragment>
                     ))}
                 </tr>
             </thead>
             <tbody>
                 {rows.map((row) => (
                     <tr key={row.dateStr}>
                         <td>{dayjs(selectedDate).format('MM')}</td>
                         <td>{row.date}</td>
                         
                         {slots.map((_, idx) => {
                             const d = row.data[idx] || { full: 0, empty: 0, balance: 0 }; 
                             // Only show balance if slot is active (has gas name) OR specifically requested?
                             // User wants to write in blank slots. So leave cells empty if no gas.
                             // But wait, if they write a gas name in header, they need to write values too.
                             // So cells should be empty.
                             
                             if (!slots[idx]) {
                                 return (
                                     <Fragment key={idx + '_val'}>
                                         <td></td><td></td><td></td>
                                     </Fragment>
                                 );
                             }

                             return (
                                 <Fragment key={idx + '_val'}>
                                     <td>{d.full > 0 ? d.full : ''}</td>
                                     <td>{d.empty > 0 ? d.empty : ''}</td>
                                     <td>{d.balance !== 0 ? d.balance : ''}</td> 
                                 </Fragment>
                             )
                         })}
                         <td>{row.worker}</td>
                     </tr>
                 ))}
             </tbody>
         </table>
         <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12pt' }}>삼 덕 가 스 공 업 (주)</div>
    </div>
  );

  if (!customer) return null;

  return (
    <>
    <Modal opened={opened} onClose={handleClose} fullScreen withCloseButton={false} padding={0} styles={{ body: { backgroundColor: '#141517' } }} closeOnEscape={false}>
        <Box h="100vh" p="md" display="flex" style={{ flexDirection: 'column' }}>
             {/* Print Style: Force Landscape & Reset Sticky for Clean Output */}
             <style type="text/css" dangerouslySetInnerHTML={{__html: `
               @media print { 
                 @page { size: landscape; margin: 10mm; } 
                 body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                 
                 /* Print Safety: Remove Sticky/Scroll logic to ensure perfect alignment on paper */
                 .mantine-ScrollArea-root, .mantine-ScrollArea-viewport { overflow: visible !important; height: auto !important; }
                 th, td { 
                    position: static !important; 
                    box-shadow: none !important; 
                    overflow: visible !important;
                    height: auto !important;
                 }
                 /* Ensure Borders are crisp */
                 table { border-collapse: collapse !important; }
               }
             `}} />
             
             {/* Header */}
             <Group justify="space-between" mb="lg">
                <Text size="xl" fw={700} c="white">거래장 조회: <Text span c="blue.4">{customer.name}</Text></Text>
                <Group>
                    <DatesProvider settings={{ locale: 'ko' }}>
                        <MonthPickerInput 
                            value={selectedDate} 
                            onChange={(date) => setSelectedDate(date as unknown as Date | null)} 
                            valueFormat="YYYY년 MM월" 
                            styles={{
                                input: {
                                    textAlign: 'center',
                                    backgroundColor: '#1A1B1E',
                                    border: '1px solid #373A40',
                                    color: 'white',
                                }
                            }}
                        />
                    </DatesProvider>
                    <Button leftSection={<IconPrinter />} onClick={handlePrint}>인쇄</Button>
                    <Button variant="subtle" color="gray" onClick={onClose}>닫기</Button>
                </Group>
             </Group>
             
             {/* Pinch Hint */}
             <Group justify="flex-end" mb="xs" align="center">
                <Text size="sm" c="dimmed">화면 배율: {(zoomLevel * 100).toFixed(0)}% (두 손가락으로 확대/축소)</Text>
             </Group>

             {/* Ledger Content */}
             <ScrollArea 
                style={{ flex: 1, backgroundColor: 'white', borderRadius: '8px', padding: 0, overflow: 'auto' }} // padding 0 for edge-to-edge sticky
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
             >
                 <LoadingOverlay visible={loading} />
                 
                 {/* Screen View */}
                 <div ref={tableContainerRef} style={{ 
                     color: 'black', 
                     minWidth: 'min-content', 
                     padding: '20px',
                     // Hardware Acceleration for Smooth Zoom
                     willChange: 'transform',
                     transform: 'translateZ(0)',
                     backfaceVisibility: 'hidden'
                 }}> {/* min-content to allow growth */}
     
     
                     <div style={{ textAlign: 'center', fontSize: `calc(2em * ${zoomLevel})`, fontWeight: 'bold', marginBottom: '20px', letterSpacing: '8px' }}>거 래 장</div>
                     
                     <Group justify="space-between" mb="xs" style={{ fontSize: `${1.2 * zoomLevel}em` }}>
                         <Text fw={700}>거래처명: {customer.name}</Text>
                         <Text fw={700}>{dayjs(selectedDate).format('YYYY년 MM월')}</Text>
                     </Group>

                       {/* Apply Metric Scaling (No Transform) */}
                       <Table withTableBorder withColumnBorders style={{ borderColor: 'black', fontSize: currentFontSize, borderCollapse: 'separate', borderSpacing: 0 }}>
                          <Table.Thead>
                               <Table.Tr>
                                   {/* Year Header Part 1 (Above Month) */}
                                   <Table.Th ta="center" bg="gray.1" style={{ 
                                       border: '1px solid #ced4da',
                                       borderRight: 'none', // Merge visually
                                       position: 'sticky', 
                                       top: 0, 
                                       left: 0,
                                       zIndex: 35, 
                                       padding: 0, 
                                       backgroundColor: '#f1f3f5',
                                       boxShadow: '1px 1px 0 #ced4da',
                                       height: currentHeaderHeight,
                                       verticalAlign: 'middle', 
                                       color: 'black',
                                       width: `${Math.floor(40 * zoomLevel)}px`,
                                       minWidth: `${Math.floor(40 * zoomLevel)}px`,
                                       maxWidth: `${Math.floor(40 * zoomLevel)}px`,
                                   }}>
                                      년
                                   </Table.Th>

                                   {/* Year Header Part 2 (Above Day) */}
                                   <Table.Th ta="center" bg="gray.1" style={{ 
                                       border: '1px solid #ced4da',
                                       borderLeft: 'none', // Merge visually
                                       borderRight: '2px solid #868e96', // Thick Separator
                                       position: 'sticky', 
                                       top: 0, 
                                       left: `${Math.floor(40 * zoomLevel)}px`, // Stick Next to Part 1
                                       zIndex: 35, 
                                       padding: 0, 
                                       backgroundColor: '#f1f3f5',
                                       boxShadow: '1px 1px 0 #ced4da',
                                       height: currentHeaderHeight,
                                       verticalAlign: 'middle', 
                                       color: 'black',
                                       width: `${Math.floor(40 * zoomLevel)}px`,
                                       minWidth: `${Math.floor(40 * zoomLevel)}px`,
                                       maxWidth: `${Math.floor(40 * zoomLevel)}px`,
                                   }}>
                                      {/* Empty to simulate merge */}
                                   </Table.Th>

                                    {slots.map((gas, idx) => (
                                       /* Gas Header (Row 1): Standard 3-Col Span */
                                       <Table.Th key={idx} colSpan={3} ta="center" bg="gray.1" style={{ 
                                           border: '1px solid #ced4da',
                                           borderRight: '2px solid #868e96', // Thick Group Separator
                                           position: 'sticky', 
                                           top: 0, 
                                           height: currentHeaderHeight,
                                           zIndex: 20, 
                                           padding: currentCellPadding, 
                                           backgroundColor: '#f1f3f5',
                                           boxShadow: '0 1px 0 #ced4da',
                                           whiteSpace: 'nowrap'
                                       }}>
                                           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                                               <div>{gas ? gas.name : ''}</div>
                                               {gas?.capacity && (
                                                   <div style={{ fontSize: '0.8em', fontWeight: 'normal' }}>({gas.capacity})</div>
                                               )}
                                           </div>
                                       </Table.Th>
                                   ))}

                                   {/* Worker Header */}
                                   <Table.Th rowSpan={2} ta="center" bg="gray.1" style={{ 
                                       border: '1px solid #ced4da', 
                                       minWidth: `${Math.floor(80 * zoomLevel)}px`,
                                       position: 'sticky', 
                                       top: 0, 
                                       zIndex: 20, 
                                       padding: 0, 
                                       backgroundColor: '#f1f3f5',
                                       boxShadow: '0 1px 0 #adb5bd',
                                       verticalAlign: 'middle',
                                       color: 'black',
                                       whiteSpace: 'nowrap'
                                   }}>
                                      인수자<br/>확 인
                                   </Table.Th>
                               </Table.Tr>
                               
                               <Table.Tr>
                                  {/* Sub-Header: Month */}
                                  <Table.Th ta="center" style={{ 
                                      border: '1px solid #ced4da',
                                      minWidth: `${Math.floor(40 * zoomLevel)}px`, 
                                      maxWidth: `${Math.floor(40 * zoomLevel)}px`,
                                      width: `${Math.floor(40 * zoomLevel)}px`,
                                      position: 'sticky', 
                                      left: 0,
                                      top: currentHeaderHeight, 
                                      zIndex: 36, 
                                      backgroundColor: '#e9ecef', 
                                      padding: currentCellPadding,
                                      boxShadow: '1px 1px 0 #adb5bd'
                                  }}>월</Table.Th>
                                  
                                  {/* Sub-Header: Day */}
                                  <Table.Th ta="center" style={{ 
                                      border: '1px solid #ced4da',
                                      borderRight: '2px solid #868e96',
                                      minWidth: `${Math.floor(40 * zoomLevel)}px`,
                                      maxWidth: `${Math.floor(40 * zoomLevel)}px`,
                                      width: `${Math.floor(40 * zoomLevel)}px`,
                                      position: 'sticky', 
                                      left: `${Math.floor(40 * zoomLevel)}px`, 
                                      top: currentHeaderHeight, 
                                      zIndex: 36, 
                                      backgroundColor: '#e9ecef', 
                                      padding: currentCellPadding,
                                      boxShadow: '1px 1px 0 #adb5bd'
                                  }}>일</Table.Th>

                                  {slots.map((_, idx) => (
                                      <Fragment key={idx + '_sub'}>
                                          {/* Sub Headers (Row 2) */}
                                          <Table.Th ta="center" style={{ 
                                              border: '1px solid #ced4da',
                                              borderLeft: 'none', 
                                              borderRight: '1px solid #e9ecef', 
                                              minWidth: `${Math.floor(30 * zoomLevel)}px`, 
                                              position: 'sticky', 
                                              top: currentHeaderHeight, 
                                              zIndex: 15, 
                                              backgroundColor: '#f1f3f5', 
                                              padding: currentCellPadding,
                                              boxShadow: '0 1px 0 #adb5bd'
                                          }}>실</Table.Th>
                                          <Table.Th ta="center" style={{ 
                                              border: '1px solid #ced4da',
                                              borderLeft: 'none', 
                                              borderRight: '1px solid #e9ecef',
                                              minWidth: `${Math.floor(30 * zoomLevel)}px`, 
                                              position: 'sticky', 
                                              top: currentHeaderHeight, 
                                              zIndex: 15, 
                                              backgroundColor: '#f1f3f5', 
                                              padding: currentCellPadding,
                                              boxShadow: '0 1px 0 #adb5bd'
                                          }}>공</Table.Th>
                                          <Table.Th ta="center" style={{ 
                                              border: '1px solid #ced4da',
                                              borderLeft: 'none', 
                                              borderRight: '2px solid #868e96', 
                                              minWidth: `${Math.floor(30 * zoomLevel)}px`, 
                                              position: 'sticky', 
                                              top: currentHeaderHeight, 
                                              zIndex: 15, 
                                              backgroundColor: '#e9ecef', 
                                              padding: currentCellPadding,
                                              boxShadow: '0 1px 0 #adb5bd'
                                          }}>잔</Table.Th>
                                      </Fragment>
                                  ))}
                               </Table.Tr>
                          </Table.Thead>
                           <Table.Tbody>
                               {rows.map((row) => {
                                   const today = dayjs();
                                   const isToday = today.format('YYYY-MM') === dayjs(selectedDate).format('YYYY-MM') && row.date === today.date();
                                   const rowBg = isToday ? '#e7f5ff' : 'transparent';
                                   const stickyBg = isToday ? '#e7f5ff' : 'white';

                                   return (
                                   <Table.Tr key={row.dateStr} bg={rowBg}>
                                       {/* Month Column (Static MM) */}
                                       <Table.Td ta="center" style={{ 
                                           border: '1px solid #ced4da',
                                           padding: 0, 
                                           position: 'sticky', 
                                           left: 0, 
                                           zIndex: 30, 
                                           backgroundColor: stickyBg, 
                                           boxShadow: '1px 0 0 #adb5bd',
                                           minWidth: `${Math.floor(40 * zoomLevel)}px`, 
                                           maxWidth: `${Math.floor(40 * zoomLevel)}px`,
                                           width: `${Math.floor(40 * zoomLevel)}px`,
                                       }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: currentCellPadding }}>
                                              {dayjs(selectedDate).format('MM')}
                                          </div>
                                       </Table.Td>
                                       
                                       {/* Day Column */}
                                       <Table.Td ta="center" style={{ 
                                           border: '1px solid #ced4da',
                                           borderRight: '2px solid #868e96',
                                           padding: 0, 
                                           position: 'sticky', 
                                           left: `${Math.floor(40 * zoomLevel)}px`, 
                                           zIndex: 30, 
                                           backgroundColor: stickyBg, 
                                           boxShadow: '1px 0 0 #adb5bd',
                                           minWidth: `${Math.floor(40 * zoomLevel)}px`, 
                                           maxWidth: `${Math.floor(40 * zoomLevel)}px`,
                                           width: `${Math.floor(40 * zoomLevel)}px`,
                                       }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: currentCellPadding }}>
                                              {row.date}
                                          </div>
                                       </Table.Td>
                                       
                                      {slots.map((_, idx) => {
                                          const d = row.data[idx] || { full: 0, empty: 0, balance: 0 };
                                          
                                          if (!slots[idx]) {
                                               return (
                                                   <Fragment key={idx}>
                                                       <Table.Td style={{ border: '1px solid #ced4da', borderRight: '1px solid #e9ecef' }}></Table.Td>
                                                       <Table.Td style={{ border: '1px solid #ced4da', borderRight: '1px solid #e9ecef' }}></Table.Td>
                                                       <Table.Td style={{ border: '1px solid #ced4da', borderRight: '2px solid #868e96' }}></Table.Td>
                                                   </Fragment>
                                               )
                                          }

                                          return (
                                              <Fragment key={idx}>
                                                  <Table.Td ta="center" style={{ border: '1px solid #ced4da', borderRight: '1px solid #e9ecef', color: d.full > 0 ? 'blue' : 'inherit', padding: currentCellPadding }}>
                                                      {d.full > 0 ? d.full : ''}
                                                  </Table.Td>
                                                  <Table.Td ta="center" style={{ border: '1px solid #ced4da', borderLeft: 'none', borderRight: '1px solid #e9ecef', color: d.empty > 0 ? 'red' : 'inherit', padding: currentCellPadding }}>
                                                      {d.empty > 0 ? d.empty : ''}
                                                  </Table.Td>
                                                  <Table.Td ta="center" style={{ border: '1px solid #ced4da', borderLeft: 'none', borderRight: '2px solid #868e96', fontWeight: 'bold', padding: currentCellPadding }}>
                                                      {d.balance !== 0 ? d.balance : ''}
                                                  </Table.Td>
                                              </Fragment>
                                          );
                                      })}
                                      
                                      <Table.Td ta="center" style={{ 
                                          border: '1px solid #ced4da', 
                                          minWidth: `${Math.floor(80 * zoomLevel)}px`,
                                          whiteSpace: 'nowrap',
                                          padding: 0 
                                      }}>
                                          <div style={{ padding: currentCellPadding, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                              {row.worker}
                                          </div>
                                      </Table.Td>
                                  </Table.Tr>
                                     );
                                 })}
                          </Table.Tbody>
                      </Table>
                 </div>
             </ScrollArea>
        </Box>
    </Modal>
    {isMounted && typeof document !== 'undefined' && createPortal(printContent, document.body)}
    </>
  );
}
