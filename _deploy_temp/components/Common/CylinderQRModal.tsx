'use client';

import { Modal, Stack, Button, Group, Box, Pagination, Text, LoadingOverlay } from '@mantine/core';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { resolveOwnerName } from '@/app/utils/display';
import { IconPrinter } from '@tabler/icons-react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Helper: Wait for b-PAC object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const waitForBpac = async (): Promise<any> => {
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
        // @ts-expect-error - bpac
        if (typeof bpac !== 'undefined') return bpac;
        // @ts-expect-error - bpac
        if (typeof window.bpac !== 'undefined') return window.bpac;
        await new Promise(r => setTimeout(r, 200));
        attempts++;
    }
    return null;
};

// Helper: Safely set text on b-PAC objects trying multiple names (Robust Data Loading)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setObjectText = async (doc: any, names: string[], value: string) => {
    for (const name of names) {
        const obj = await doc.GetObject(name);
        if (obj) {
            obj.Text = value;
            return true;
        }
    }
    return false;
};

interface CylinderQRModalProps {
    opened: boolean;
    onClose: () => void;
    // [Immutable QR] ID is required for immutable QR generation
    cylinders?: { id: string, serialNumber: string, owner: string }[];
    serial: string | null; // Legacy single props (might need ID too)
    id?: string | null; // [New] Single ID
    owner: string | null;
}

export const CylinderQRModal = ({ opened, onClose, serial, id, owner, cylinders }: CylinderQRModalProps) => {
    const [generating, setGenerating] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [activePage, setActivePage] = useState(1);
    const itemsPerPage = 20; 
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const getDisplayOwner = (ownerName: string | null | undefined) => resolveOwnerName(ownerName);

    const targetList = useMemo(() => {
        return cylinders && cylinders.length > 0 
            ? cylinders 
            : (serial && id ? [{ id, serialNumber: serial, owner: owner || '' }] : []);
    }, [cylinders, serial, id, owner]);

    const totalPages = Math.ceil(targetList.length / itemsPerPage);
    const displayedItems = useMemo(() => {
        return targetList.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);
    }, [targetList, activePage]);

    // Canvas-based Preview Generator (Client-Side Rendering for Accuracy)
    const generateCanvasPreviews = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return [];

        const DPI = 300; // Increased resolution for sharp preview
        const MM_TO_PX = (mm: number) => (mm * DPI) / 25.4;
        const widthPx = MM_TO_PX(24);
        const heightPx = MM_TO_PX(30);

        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return [];

        const images: string[] = [];

        for (const item of displayedItems) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, widthPx, heightPx);
            
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, widthPx, heightPx);

            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const fontSizeName = MM_TO_PX(2.5); 
            ctx.font = `bold ${fontSizeName}px Arial, sans-serif`;
            ctx.fillText(getDisplayOwner(item.owner || ''), widthPx / 2, MM_TO_PX(3.5));

            const qrSizePx = MM_TO_PX(17); 
            try {
                // [Immutable QR] Use UUID (item.id)
                const qrDataUrl = await QRCode.toDataURL(`https://samduk.vercel.app/cylinders/${item.id}`, { margin: 0, width: 200, errorCorrectionLevel: 'M' });
                const qrImg = new Image();
                qrImg.src = qrDataUrl;
                await new Promise((resolve) => { qrImg.onload = resolve; });
                const qrX = (widthPx - qrSizePx) / 2;
                const qrY = MM_TO_PX(6);
                ctx.drawImage(qrImg, qrX, qrY, qrSizePx, qrSizePx);
            } catch (e) {
                console.error(e);
            }

            const fontSizeLabel = MM_TO_PX(2.8); 
            ctx.font = `bold ${fontSizeLabel}px Arial, sans-serif`;
            ctx.fillText(item.serialNumber, widthPx / 2, MM_TO_PX(26.5));

            images.push(canvas.toDataURL('image/png'));
        }
        return images;
    }, [displayedItems]); 

    // Preview Logic: Always use Canvas for consistency and correctness
    const handlePreview = useCallback(async () => {
        setGenerating(true);
        setPreviewImages([]);
        
        try {
            const imgs = await generateCanvasPreviews();
            setPreviewImages(imgs);
        } catch (e) {
            console.error("Preview Error:", e);
        } finally {
            setGenerating(false);
        }
    }, [generateCanvasPreviews]);

    // Auto-refresh with Hash Check (Prevent Infinite Loop)
    const prevHashRef = useRef('');
    useEffect(() => {
        if (!opened) return;
        
        // Hash includes page & first item to detect content changes
        const hash = `${activePage}-${targetList.length}-${targetList[0]?.serialNumber}`;
        
        if (prevHashRef.current !== hash) {
            prevHashRef.current = hash;
            // Debounce slightly to ensure rendering stability
            setTimeout(() => handlePreview(), 100);
        }
    }, [opened, activePage, targetList, handlePreview]);

    // Brother Print
    const handleDirectPrint = async () => {
        setGenerating(true);
        const bpacObj = await waitForBpac();
        if (!bpacObj) {
            alert('Brother b-PAC 확장/클라이언트가 필요합니다.');
            setGenerating(false);
            return;
        }

        try {
            const doc = bpacObj.IDocument;
            if (await doc.Open("C:\\SamdukLabels\\Label.lbx")) {
                await doc.StartPrint("SamdukCylinders", 0);
                for (const item of targetList) {
                    const idx = doc.GetBarcodeIndex("Barcode1");
                    // [Immutable QR] Use UUID (item.id) instead of serialNumber
                    doc.SetBarcodeData(idx, `https://samduk.vercel.app/cylinders/${item.id}`);
                    
                    // Use helper to try multiple text object names cleanly (AI/Logic abstraction)
                    await setObjectText(doc, ["objCompany", "Text1"], getDisplayOwner(item.owner || ''));
                    await setObjectText(doc, ["objSerial", "Text2", "Text3"], item.serialNumber);

                    await doc.PrintOut(1, 0);
                }
                await doc.EndPrint();
                await doc.Close();
                alert("인쇄 완료");
            }
        } catch(e) {
            alert("인쇄 실패: " + e);
        } finally {
            setGenerating(false);
        }
    };

    // A4 Grid PDF Print
    const handleA4PdfPrint = async () => {
        if (targetList.length === 0) return;
        setGenerating(true);

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const labelWidth = 24;
            const labelHeight = 30;
            const cols = 7;
            const rows = 8; 
            const marginX = (pageWidth - (cols * labelWidth)) / 2;
            const marginY = 15; 

            const canvas = canvasRef.current;
            if (!canvas) throw new Error("No Canvas");
            
            const DPI = 300; 
            const MM_TO_PX = (mm: number) => (mm * DPI) / 25.4;
            const widthPx = MM_TO_PX(labelWidth);
            const heightPx = MM_TO_PX(labelHeight);
            
            canvas.width = widthPx;
            canvas.height = heightPx;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error("No Context");

            let col = 0;
            let row = 0;

            for (let i = 0; i < targetList.length; i++) {
                const item = targetList[i];

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, widthPx, heightPx);
                
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 1;
                ctx.strokeRect(0, 0, widthPx, heightPx);

                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const fontSizeName = MM_TO_PX(2.5); 
                ctx.font = `bold ${fontSizeName}px Arial, sans-serif`;
                ctx.fillText(getDisplayOwner(item.owner || ''), widthPx / 2, MM_TO_PX(3.5));

                const qrSizePx = MM_TO_PX(17);
                // [Immutable QR] Use UUID (item.id)
                const qrDataUrl = await QRCode.toDataURL(`https://samduk.vercel.app/cylinders/${item.id}`, { margin: 0, width: 1000, errorCorrectionLevel: 'Q' });
                const qrImg = new Image();
                qrImg.src = qrDataUrl;
                await new Promise(r => qrImg.onload = r);
                ctx.drawImage(qrImg, (widthPx - qrSizePx)/2, MM_TO_PX(6), qrSizePx, qrSizePx);

                const fontSizeLabel = MM_TO_PX(2.8); 
                ctx.font = `bold ${fontSizeLabel}px Arial, sans-serif`;
                ctx.fillText(item.serialNumber, widthPx / 2, MM_TO_PX(26.5));

                // Use PNG for lossless quality
                const imgData = canvas.toDataURL('image/png');
                const x = marginX + (col * labelWidth);
                const y = marginY + (row * labelHeight);
                
                doc.addImage(imgData, 'JPEG', x, y, labelWidth, labelHeight);

                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                    if (row >= rows && i < targetList.length - 1) {
                        doc.addPage();
                        row = 0;
                    }
                }
            }

            window.open(URL.createObjectURL(doc.output('blob')), '_blank');

        } catch (e) {
            console.error(e);
            alert("PDF 생성 오류: " + e);
        } finally {
            setGenerating(false);
        }
    };

    if (targetList.length === 0) return null;

    return (
        <Modal 
            opened={opened} 
            onClose={onClose} 
            title={
                <Box>
                    <Text fw={700}>QR 코드 출력</Text>
                    <Text fz="xs" c="dimmed">총 {targetList.length}개 항목</Text>
                </Box>
            }
            centered
            size="xl" 
            closeOnClickOutside={false} 
        >
            <LoadingOverlay visible={generating} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} loaderProps={{ children: <Text fw={700} c="blue">처리 중...</Text> }} />
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <Stack align="center" gap="md" py="md">
                
                {/* 1. Preview Section (Vertical Tape Layout) */}
                <Box style={{ 
                    width: '100%', 
                    height: '500px', 
                    overflowY: 'auto',
                    backgroundColor: '#333333', 
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0px'
                }}>
                    <Text c="white" size="xs" mb="sm">⬇ 실제 출력 미리보기 ({activePage}/{totalPages} 페이지) ⬇</Text>
                    {previewImages.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {previewImages.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={img} 
                                        alt={`Preview ${idx}`} 
                                        style={{ 
                                            width: '120px', 
                                            display: 'block',
                                            backgroundColor: 'white'
                                        }} 
                                    />
                                    <div style={{ 
                                        width: '100%', 
                                        height: '1px', 
                                        borderBottom: '1px dashed #999',
                                        marginBottom: '1px' 
                                    }} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Text c="dimmed" size="sm" mt="xl">
                             미리보기를 불러올 수 없거나 항목이 없습니다.
                        </Text>
                    )}
                </Box>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <Pagination 
                        total={totalPages} 
                        value={activePage} 
                        onChange={(page) => {
                            setActivePage(page);
                            setPreviewImages([]); 
                        }} 
                        size="sm"
                    />
                )}

                <Group mt="md">
                    <Button variant="default" onClick={onClose}>
                        닫기
                    </Button>
                    
                    <Button 
                        variant="light" 
                        color="grape"
                        onClick={handlePreview}
                        loading={generating}
                        disabled={generating}
                    >
                        미리보기 새로고침
                    </Button>

                    <Button 
                        variant="outline"
                        color="blue" 
                        size="md"
                        onClick={handleA4PdfPrint}
                        disabled={targetList.length === 0}
                    >
                        일반 프린터용 (PDF)
                    </Button>

                    <Button 
                        color="green" 
                        size="md"
                        leftSection={<IconPrinter size={16} />}
                        onClick={handleDirectPrint}
                        loading={generating}
                        disabled={generating}
                    >
                        전체 {targetList.length}개 전용 프로그램 인쇄
                    </Button>
                </Group>

                {/* Instruction (Moved to Bottom) */}
                <div style={{ padding: '0 15px', fontSize: '13px', width: '100%' }}>
                    <Stack gap="xs">
                        <Group gap="xs">
                            <Box w={6} h={6} bg="green" style={{ borderRadius: '50%' }} />
                            <Text size="xs" c="dimmed"><strong>Brother 전용 인쇄:</strong> Brother 라벨 프린터가 연결된 경우 사용하세요. (b-PAC 필요)</Text>
                        </Group>
                        <Group gap="xs">
                            <Box w={6} h={6} bg="blue" style={{ borderRadius: '50%' }} />
                            <Text size="xs" c="dimmed"><strong>일반 프린터 (PDF):</strong> 일반 A4 프린터로 출력할 때 사용하세요. (A4 바둑판 배열)</Text>
                        </Group>
                    </Stack>
                </div>
            </Stack>
        </Modal>
    );
};
