'use client';

import { Modal, Stack, Button, Group, Box, TextInput, Text, LoadingOverlay } from '@mantine/core';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { IconPrinter, IconSearch } from '@tabler/icons-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

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

interface QRItem {
    id: string;
    label: string;
    subLabel?: string;
    desc?: string;
}

interface QRPrintModalProps {
    opened: boolean;
    onClose: () => void;
    data: QRItem[]; 
    title?: string;
}

export const QRPrintModal = ({ opened, onClose, data, title }: QRPrintModalProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    
    // Canvas ref for PDF generation AND Preview
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const filteredData = useMemo(() => data.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.id.toLowerCase().includes(searchQuery.toLowerCase())
    ), [data, searchQuery]);

    const handleCloseLocal = () => {
        setSearchQuery('');
        onClose();
    };

    useModalBackTrap(opened, handleCloseLocal, 'qr-print');

    // Canvas-based Preview Generator (Client-Side Rendering for Accuracy)
    const generateCanvasPreviews = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const DPI = 300; // Increased resolution for sharp preview
        const MM_TO_PX = (mm: number) => (mm * DPI) / 25.4;
        const widthPx = MM_TO_PX(24);
        const heightPx = MM_TO_PX(30);

        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const images: string[] = [];

        for (const item of filteredData) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, widthPx, heightPx);
            
            ctx.strokeStyle = '#cccccc'; // Visual border for preview
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, widthPx, heightPx);

            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text 1: Company Name
            const fontSizeName = MM_TO_PX(2.5); 
            ctx.font = `bold ${fontSizeName}px Arial, sans-serif`;
            ctx.fillText("삼덕가스공업(주)", widthPx / 2, MM_TO_PX(3.5));

            // QR Code
            const qrSizePx = MM_TO_PX(17); 
            try {
                // [Quality] Level 'L' for Preview
                const qrDataUrl = await QRCode.toDataURL(item.id, { margin: 0, width: 400, errorCorrectionLevel: 'L' });
                const qrImg = new Image();
                qrImg.src = qrDataUrl;
                await new Promise((resolve) => { qrImg.onload = resolve; });
                const qrX = (widthPx - qrSizePx) / 2;
                const qrY = MM_TO_PX(6);
                ctx.drawImage(qrImg, qrX, qrY, qrSizePx, qrSizePx);
            } catch (e) {
                console.error(e);
            }

            // Text 2: Label (Name or Serial)
            const fontSizeLabel = MM_TO_PX(2.8); 
            ctx.font = `bold ${fontSizeLabel}px Arial, sans-serif`;
            ctx.fillText(item.label, widthPx / 2, MM_TO_PX(26.5));

            images.push(canvas.toDataURL('image/png'));
        }
        setPreviewImages(images);
    }, [filteredData]);

    // Auto update preview when data changes (with debounce)
    useEffect(() => {
        if (!opened) return;

        const timer = setTimeout(() => {
            generateCanvasPreviews();
        }, 300); // 300ms debounce to prevent freezing on typing

        return () => clearTimeout(timer);
    }, [opened, filteredData, generateCanvasPreviews]);

    // Brother Direct Print (Continuous Tape)
    const handleDirectPrint = async () => {
        setIsGenerating(true);
        const bpacObj = await waitForBpac();
        if (!bpacObj) {
            alert('Brother b-PAC 확장/클라이언트가 필요합니다.');
            setIsGenerating(false);
            return;
        }

        try {
            const doc = bpacObj.IDocument;
            const templatePath = "C:\\SamdukLabels\\Label.lbx";
            if (await doc.Open(templatePath)) {
                await doc.StartPrint("SamdukQR", 0);
                
                for (const item of filteredData) {
                    const idx = doc.GetBarcodeIndex("Barcode1");
                    doc.SetBarcodeData(idx, item.id); 
                    
                    // Use helper to try multiple text object names cleanly
                    await setObjectText(doc, ["objCompany", "Text1"], "삼덕가스공업(주)");
                    await setObjectText(doc, ["objSerial", "Text2", "Text3"], item.label);

                    await doc.PrintOut(1, 0); 
                }
                
                await doc.EndPrint();
                await doc.Close();
                alert("Brother 인쇄 완료");
            } else {
                alert("템플릿 파일을 찾을 수 없습니다: " + templatePath);
            }
        } catch (e) {
            console.error(e);
            alert("인쇄 중 오류: " + e);
        } finally {
            setIsGenerating(false);
        }
    };

    // A4 Grid PDF Print
    const handleA4PdfPrint = async () => {
        if (filteredData.length === 0) return;
        setIsGenerating(true);

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
            if (!canvas) throw new Error("Canvas Error");
            
            const DPI = 300; 
            const MM_TO_PX = (mm: number) => (mm * DPI) / 25.4;
            const widthPx = MM_TO_PX(labelWidth);
            const heightPx = MM_TO_PX(labelHeight);
            
            canvas.width = widthPx;
            canvas.height = heightPx;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error("Context Error");

            let col = 0;
            let row = 0;

            for (let i = 0; i < filteredData.length; i++) {
                const item = filteredData[i];

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
                ctx.fillText("삼덕가스공업(주)", widthPx / 2, MM_TO_PX(3.5));

                // [Stable] Physical Size 17mm (Standard)
                const qrSizePx = MM_TO_PX(17);
                const qrY = MM_TO_PX(6);

                // [Quality] Level 'M' (Medium - 15%) is the standard for most environments.
                // It adds slightly more dots than 'L' but handles glare/dirt MUCH better.
                const qrDataUrl = await QRCode.toDataURL(item.id, { margin: 1, width: 1200, errorCorrectionLevel: 'M' });
                const qrImg = new Image();
                qrImg.src = qrDataUrl;
                await new Promise(r => qrImg.onload = r);
                ctx.drawImage(qrImg, (widthPx - qrSizePx)/2, qrY, qrSizePx, qrSizePx);

                const fontSizeLabel = MM_TO_PX(2.8); 
                ctx.font = `bold ${fontSizeLabel}px Arial, sans-serif`;
                ctx.fillText(item.label, widthPx / 2, MM_TO_PX(26.5)); 

                // Use PNG for lossless quality (Critical for QR)
                const imgData = canvas.toDataURL('image/png', 1.0); // 1.0 Quality
                const x = marginX + (col * labelWidth);
                const y = marginY + (row * labelHeight);
                
                // [Quality] Use 'PNG' instead of 'JPEG' to prevent artifacts
                doc.addImage(imgData, 'PNG', x, y, labelWidth, labelHeight);

                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                    if (row >= rows && i < filteredData.length - 1) {
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
            setIsGenerating(false);
        }
    };

    return (
        <Modal 
            opened={opened} 
            onClose={handleCloseLocal} 
            title={
                <Box>
                    <Text fw={700}>{title || 'QR 코드 출력'}</Text>
                    <Text fz="xs" c="dimmed">총 {filteredData.length}개 항목</Text>
                </Box>
            }
            size="xl" centered closeOnClickOutside={false}
        >
            <LoadingOverlay visible={isGenerating} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} loaderProps={{ children: <Text fw={700} c="blue">처리 중...</Text> }} />
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <Stack gap="md" py="md">
                <Group justify="space-between" w="100%">
                     <TextInput 
                        placeholder="이름, 아이디 검색" 
                        leftSection={<IconSearch size={16} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.currentTarget.value)}
                        style={{ width: '100%' }}
                    />
                </Group>

                {/* Vertical Preview to match Print Reality (Canvas Based) */}
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
                    <Text c="white" size="xs" mb="sm">⬇ 실제 출력 미리보기 ({filteredData.length}개) ⬇</Text>
                    {previewImages.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {previewImages.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                        src={img} 
                                        alt={`Preview ${idx}`} 
                                        style={{ 
                                            width: '120px', // Medium size (Unified with CylinderQR)
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
                             표시할 항목이 없습니다.
                        </Text>
                    )}
                </Box>

                <Group mt="md">
                    <Button variant="default" onClick={handleCloseLocal}>닫기</Button>
                    
                    <Button 
                        variant="outline"
                        color="blue" 
                        size="md"
                        onClick={() => handleA4PdfPrint()}
                        disabled={filteredData.length === 0}
                    >
                        일반 프린터용 (PDF)
                    </Button>

                    <Button 
                        color="green" 
                        size="md"
                        leftSection={<IconPrinter size={16} />}
                        onClick={() => handleDirectPrint()}
                        disabled={filteredData.length === 0}
                    >
                        전체 {filteredData.length}개 전용 프로그램 인쇄
                    </Button>
                </Group>

                {/* Instruction */}
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
}
