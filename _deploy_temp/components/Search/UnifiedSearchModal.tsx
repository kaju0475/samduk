'use client';

import { Modal, TextInput, Stack, Text, Group, UnstyledButton, Badge, ScrollArea, ThemeIcon, Kbd } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSearch, IconArrowRight, IconBox, IconUser, IconFiles, IconSparkles } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useModalBackTrap } from '@/app/hooks/useModalBackTrap';

interface UnifiedSearchModalProps {
    opened: boolean;
    onClose: () => void;
}

type SearchResult = {
    id: string;
    type: 'CYLINDER' | 'CUSTOMER' | 'MENU';
    title: string;
    subtitle: string;
    link: string;
};

export function UnifiedSearchModal({ opened, onClose }: UnifiedSearchModalProps) {
    const router = useRouter();
    
    // [Fix] Only enable Back Trap on Mobile/Tablet to avoid PC navigation issues
    // On PC, we don't want to mess with history stack (Back button should navigate page, not close modal necessarily, or at least not cause simple close quirks)
    const isMobileOrTablet = useMediaQuery('(max-width: 768px)');
    const enableBackTrap = opened && (isMobileOrTablet ?? false);

    // Pushes 'unified-search' to history stack ONLY if enabled
    const handleClose = useModalBackTrap(enableBackTrap, onClose, 'unified-search'); 

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Breakpoint for Mobile Optimization
    const isMobile = useMediaQuery('(max-width: 500px)');

    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        if (!query.trim()) {
            setResults([]);
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal });
                if (!res.ok) throw new Error('Search failed');
                const data = await res.json();
                if (data.success) {
                    setResults(data.data);
                }
            } catch (error) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Search error:', error);
                    setResults([]);
                }
            } finally {
                if (!signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        // Debounce 300ms
        const timer = setTimeout(fetchData, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);


    const handleSelect = (link: string) => {
        // [Fix] Append source=ai to help target page know where we came from
        const separator = link.includes('?') ? '&' : '?';
        const finalLink = `${link}${separator}source=ai`;

        setTimeout(() => {
            router.push(finalLink);
        }, 50);
    };

    return (
        <Modal 
            opened={opened} 
            onClose={handleClose} 
            size="lg" 
            padding={0} 
            withCloseButton={false}
            yOffset={isMobile ? "5vh" : undefined}
            centered={!isMobile}
            overlayProps={{ blur: 3, backgroundOpacity: 0.55 }}
            styles={{ 
                content: { overflow: 'hidden', borderRadius: '12px' }, 
                body: { padding: 0 } 
            }}
        >
            <Stack gap={0}>
                {/* Search Input Area */}
                <Group p="md" align="center" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }} bg="#1A1B1E">
                    <IconSearch size={22} color="gray" />
                    <TextInput 
                        placeholder="무엇을 찾고 계신가요? (예: 용기 1001, 대한병원...)"
                        variant="unstyled"
                        size="lg"
                        style={{ flex: 1 }}
                        value={query}
                        onChange={(e) => setQuery(e.currentTarget.value)}
                        autoFocus
                        rightSection={isLoading && <ThemeIcon variant="transparent"><IconSparkles style={{ animation: 'spin 2s linear infinite' }} size={16} /></ThemeIcon>}
                        styles={{ input: { color: 'white', fontWeight: 500 } }}
                    />
                    <Badge variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }} leftSection={<IconSparkles size={12} />}>
                        AI Beta
                    </Badge>
                </Group>

                {/* Results Area */}
                <div style={{ minHeight: isMobile ? '180px' : '300px', backgroundColor: '#141517' }}>
                    {query.trim() === '' ? (
                         // Empty State / Suggestions
                        <Stack p="xl" align="center" gap="lg" opacity={0.6}>
                            <Text size="sm" c="dimmed">AI에게 이렇게 물어보세요</Text>
                            <Group>
                                <Kbd>용기번호 1001</Kbd>
                                <Kbd>대한병원 이력</Kbd>
                                <Kbd>오늘 납품 내역</Kbd>
                            </Group>
                            {!isMobile && (
                                <Text size="xs" c="dimmed" mt="xl">
                                    Tip: <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> 단축키로 언제든 열 수 있습니다.
                                </Text>
                            )}
                        </Stack>
                    ) : (
                        <ScrollArea h={isMobile ? 200 : 300}>
                            {results.length > 0 ? (
                                <Stack gap={0}>
                                    {results.map((result, index) => (
                                        <UnstyledButton 
                                            key={`${result.id}-${index}`} 
                                            onClick={() => handleSelect(result.link)}
                                            p="md"
                                            style={{ 
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <Group>
                                                <ThemeIcon size="lg" radius="xl" variant="light" 
                                                    color={result.type === 'CYLINDER' ? 'blue' : result.type === 'CUSTOMER' ? 'green' : 'orange'}
                                                >
                                                    {result.type === 'CYLINDER' && <IconBox size={18} />}
                                                    {result.type === 'CUSTOMER' && <IconUser size={18} />}
                                                    {result.type === 'MENU' && <IconFiles size={18} />}
                                                </ThemeIcon>
                                                <div style={{ flex: 1 }}>
                                                    <Text size="sm" fw={700} c="white">{result.title}</Text>
                                                    <Text size="xs" c="dimmed">{result.subtitle}</Text>
                                                </div>
                                                <IconArrowRight size={16} color="gray" />
                                            </Group>
                                        </UnstyledButton>
                                    ))}
                                </Stack>
                            ) : (
                                <Stack align="center" justify="center" h={isMobile ? 140 : 200} opacity={0.5}>
                                    {isLoading ? (
                                        <Text size="sm" c="dimmed">검색중...</Text>
                                    ) : (
                                        <>
                                            <IconSearch size={40} />
                                            <Text size="sm">검색 결과가 없습니다.</Text>
                                        </>
                                    )}
                                </Stack>
                            )}
                        </ScrollArea>
                    )}
                </div>

                {/* Footer Section */}
                <Group p="xs" bg="#1A1B1E" justify="space-between" px="md" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Group gap="xs">
                        <Text size="xs" c="dimmed">AI Search Prototype</Text>
                    </Group>
                    <Group gap="xs">
                         <IconSparkles size={14} color="#339AF0" />
                         <Text size="xs" c="blue">Powered by Gemini</Text>
                    </Group>
                </Group>
            </Stack>
        </Modal>
    );
}
