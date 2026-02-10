'use client';

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Container, Paper, Title, Text, Button, Center, Loader, Alert, TextInput, PasswordInput, Modal } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useDoubleBackExit } from '@/app/hooks/useDoubleBackExit';

function LoginContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const [scanModalOpen, setScanModalOpen] = useState(false);

    // [PWA Exit Strategy] Enable Double-Back-To-Exit
    useDoubleBackExit();


    
    const performLogin = useCallback(async (loginToken: string) => {
        setStatus('loading');
        try {
            console.log('[QR Login] Token:', loginToken);

            const isDirectLoginToken = 
                loginToken.startsWith('ENC-') || // [Method 2] Encrypted
                loginToken.startsWith('TOKEN-') || 
                loginToken.startsWith('USER-') || 
                loginToken === 'admin' || 
                /^\d+$/.test(loginToken) ||
                /^[0-9A-F]{16,}$/i.test(loginToken); // [Optimization] Long Hex Tokens

            if (isDirectLoginToken) {
                console.log('[QR Login] Direct Login identified:', loginToken);
                const response = await fetch('/api/auth/qr-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: loginToken }),
                });
                const result = await response.json();
                
                if (result.success) {
                      sessionStorage.setItem('currentUser', JSON.stringify(result.user));
                      await new Promise(resolve => setTimeout(resolve, 100));
                      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                          window.location.replace('/menu');
                      } else {
                          router.replace('/dashboard');
                      }
                      return;
                } else {
                    setStatus('error');
                    let errorText = result.errorCode 
                        ? `[${result.errorCode}] ${result.message}` 
                        : (result.message || 'QR 코드에 해당하는 사용자를 찾을 수 없습니다');
                    if (result.debugId) {
                        errorText += `\n(ID: ${result.debugId})`;
                    }
                    setErrorMessage(errorText);
                    return;
                }
            }

            let username = loginToken;
            let password = '1234';
            try {
                const decoded = atob(loginToken);
                const parsed = JSON.parse(decoded);
                username = parsed.username || parsed.id;
                password = parsed.password || '1234';
            } catch { }
            
console.log('[QR Login] Token:', loginToken, '→ Username:', username);
            
            // Use standard login API
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: username, password }),
            });
            const data = await res.json();

            if (data.success) {
                console.log('[QR Login] Success, user:', data.user);
                
                // [CRITICAL] Set sessionStorage (Session Only)
                sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                
                // [Mobile Fix] Wait for cookie to be set by browser
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify cookie is set
                const getCookie = (name: string): string | null => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) {
                        return parts.pop()?.split(';').shift() || null;
                    }
                    return null;
                };
                
                const userCookie = getCookie('user');
                console.log('[QR Login] Cookie set:', userCookie ? 'YES' : 'NO');
                
                // [Mobile] Redirect to /menu
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                    console.log('[QR Login] Mobile detected, redirecting to /menu');
                    window.location.replace('/menu');
                } else {
                    console.log('[QR Login] Desktop detected, redirecting to /dashboard');
                    router.replace('/dashboard');
                }
            } else {
                setStatus('error');
                // [Debug] Show Error Code if available
                let errorText = data.errorCode 
                    ? `[${data.errorCode}] ${data.message}` 
                    : (data.message || 'QR 코드 인증 실패');
                
                if (data.debugId) {
                    errorText += `\n(ID: ${data.debugId})`;
                }
                setErrorMessage(errorText);
            }
        } catch {
            setStatus('error');
            setErrorMessage('서버 연결 오류');
        }
    }, [router]);

    const [scanError, setScanError] = useState('');

    // [Auto Login] If token is present in URL (Redirect /q or direct access)
    useEffect(() => {
        if (token && status === 'idle') {
            // Some browsers might encode the plus/slash differently in redirects
            const decodedToken = decodeURIComponent(token);
            console.log('[Auto Login] QR Token detected:', decodedToken);
            // [Fix] TypeScript error: status cannot be 'loading' here because of the check above? 
            // Actually, this effect runs when token changes. status check is in the dependency array?
            // The logic error was in the render return.
            performLogin(decodedToken);
        }
    }, [token, performLogin, status]);

    // [Clean History]
    // Ensure the Login page is a clean state without any traps.
    useEffect(() => {
        // Clear any "trap" state that might have lingered
        if (window.history.state?.page === 'menu_trap') {
             window.history.replaceState(null, '', window.location.href);
        }
    }, []);

    // Scanner Ref to ensure we can clean it up effectively
    const html5QrCodeRef = useRef<any>(null);

    // Scanner initialization effect
    useEffect(() => {
        if (scanModalOpen) {
            // Check for Secure Context
            if (typeof window !== 'undefined' && window.isSecureContext === false) {
                setScanError('보안 정책으로 인해 카메라를 사용할 수 없습니다. (HTTPS 또는 localhost 필요)');
                return;
            }

            setScanError('');

            const timer = setTimeout(() => {
                const readerElement = document.getElementById('reader');
                if (!readerElement) return;

                import('html5-qrcode').then(({ Html5Qrcode }) => {
                    const qrCode = new Html5Qrcode("reader");
                    html5QrCodeRef.current = qrCode;
                    
                    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
                    
                    qrCode.start(
                        { facingMode: "environment" },
                        config,
                        (decodedText: string) => {
                            // STOP Camera immediately on success
                            qrCode.stop().then(() => {
                                qrCode.clear();
                                html5QrCodeRef.current = null;
                                setScanModalOpen(false);

                                // Logic to parse token
                                let extractedToken = decodedText;
                                try {
                                    const url = new URL(decodedText);
                                    const tokenParam = url.searchParams.get('token');
                                    if (tokenParam) extractedToken = tokenParam;
                                } catch {}

                                performLogin(extractedToken);
                            }).catch((err: any) => {
                                console.error("Failed to stop scanner", err);
                                setScanModalOpen(false);
                                performLogin(decodedText); // Try anyway
                            });
                        },
                        () => {} // Ignore frame errors
                    ).catch((err: unknown) => {
                        console.error("Error starting scanner", err);
                        setScanError('카메라를 실행할 수 없습니다.');
                    });

                }).catch(err => {
                    console.error("Failed to load html5-qrcode", err);
                    setScanError('스캐너 라이브러리 로드 실패');
                });
            }, 300);

            return () => {
                clearTimeout(timer);

                // [HARD STOP] Manually kill video tracks to ensure hardware LED goes off
                try {
                    const readerObj = document.getElementById('reader');
                    if (readerObj) {
                        const video = readerObj.querySelector('video');
                        if (video && video.srcObject) {
                            const stream = video.srcObject as MediaStream;
                            stream.getTracks().forEach(track => {
                                track.stop();
                                track.enabled = false;
                            });
                        }
                    }
                } catch (e) {
                    console.error("Manual stream stop failed", e);
                }

                // Library Cleanup
                if (html5QrCodeRef.current) {
                    try {
                        if (html5QrCodeRef.current.isScanning) {
                            html5QrCodeRef.current.stop().then(() => {
                                html5QrCodeRef.current?.clear();
                            }).catch(() => {});
                        } else {
                             // If not scanning but instance exists, try to clear (remove UI)
                            try { html5QrCodeRef.current.clear(); } catch {}
                        }
                    } catch (e) {
                         console.error("Cleanup error", e);
                    }
                }
            };
        }
    }, [scanModalOpen, performLogin]);

    const handleManualLogin = async () => {
        // [Scanner Support] Check if the input contains a Token URL
        // Scanners often type the full URL and hit Enter into the ID field.
        if (username.includes('token=') || username.includes('http')) {
            try {
                let extractedToken = '';
                
                // Case 1: Full URL (http://.../login?token=...)
                if (username.includes('token=')) {
                     const match = username.match(/[?&]token=([^&]+)/);
                     if (match) extractedToken = match[1];
                }
                // Case 2: Just the token value (if scanner is configured drastically different, though unlikely)
                
                if (extractedToken) {
                    notifications.show({ title: '스캐너 감지', message: 'QR 코드로 로그인합니다.', color: 'blue' });
                    await performLogin(extractedToken);
                    return;
                }
            } catch (e) {
                console.error("Scanner Parse Error", e);
            }
        }

        if (!username || !password) return; // Use 'username' here as it's the state variable

        setStatus('loading');
        setErrorMessage('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: username, password }), // Use 'username' here
            });
            const data = await res.json();

            if (data.success) {
                console.log('[Login] Success, user:', data.user);
                
                // [CRITICAL] Set sessionStorage (Session Only)
                sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                
                // [Mobile Fix] Wait for cookie to be set by browser
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify cookie is set
                const getCookie = (name: string): string | null => {
                    const value = `; ${document.cookie}`;
                    const parts = value.split(`; ${name}=`);
                    if (parts.length === 2) {
                        return parts.pop()?.split(';').shift() || null;
                    }
                    return null;
                };
                
                const userCookie = getCookie('user');
                console.log('[Login] Cookie set:', userCookie ? 'YES' : 'NO');
                
                // [Mobile] Redirect to /menu
                if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                    console.log('[Login] Mobile detected, redirecting to /menu');
                    window.location.replace('/menu');
                } else {
                    console.log('[Login] Desktop detected, redirecting to /dashboard');
                    router.replace('/dashboard');
                }
            } else {
                setStatus('error');
                setErrorMessage(data.message || '로그인 실패');
            }
        } catch {
            setStatus('error');
        }
    };

    useEffect(() => {
        if (token) {
            performLogin(token);
        }
    }, [token, performLogin]);

    if (status === 'loading') {
        return (
            <Center h="100vh">
                <div style={{ textAlign: 'center' }}>
                    <Loader size="xl" type="dots" />
                    <Text mt="md">QR 코드 확인 중...</Text>
                </div>
            </Center>
        );
    }
    if (status === 'success') {
        return (
            <Center h="100vh">
                <div style={{ textAlign: 'center' }}>
                    <IconCheck size={60} color="green" />
                    <Title order={2} mt="md">환영합니다!</Title>
                    <Text c="dimmed">자동 로그인 성공. 대시보드로 이동합니다.</Text>
                </div>
            </Center>
        );
    }



    return (
        <Center h="100vh" bg="gray.9" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#1A1B1E' }}>
            {/* Background Logo Watermark */}
            {/* PC Logo */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '49%',
                transform: 'translate(-50%, -50%)',
                width: 'min(600px, 90vw)',
                height: 'min(600px, 90vw)',
                opacity: 0.5,
                pointerEvents: 'none',
                zIndex: 0,
                backgroundImage: 'url(/emblem_v2.png)',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                filter: 'drop-shadow(0 0 25px rgba(100, 200, 255, 0.6))',
                display: 'none'
            }} className="pc-logo" />
            <style jsx global>{`
                @media (min-width: 48em) {
                    .pc-logo { display: block !important; }
                }
            `}</style>
            
            {/* Mobile Logo */}
            <div style={{
                position: 'absolute',
                top: '5%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'min(180px, 45vw)',
                height: 'min(180px, 45vw)',
                opacity: 0.4,
                pointerEvents: 'none',
                zIndex: 0,
                backgroundImage: 'url(/emblem_v2.png)',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                filter: 'drop-shadow(0 0 15px rgba(100, 200, 255, 0.6))',
                display: 'block'
            }} className="mobile-logo" />
             <style jsx global>{`
                @media (min-width: 48em) {
                    .mobile-logo { display: none !important; }
                }
            `}</style>

            <Container size={420} my={40} style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <Title ta="center" c="white" style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-1px' }}>
                        삼덕가스공업(주)
                    </Title>
                    <Text ta="center" c="dimmed" size="lg" fw={500} mt={5} style={{ letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Cylinder Management System
                    </Text>
                </div>

                <Paper withBorder shadow="xl" p={30} mt={30} radius="md" style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(37, 38, 43, 0.8)' }}>
                    {status === 'error' && (
                        <Alert icon={<IconAlertCircle size={16} />} title="오류" color="red" mb="lg">
                            {errorMessage}
                        </Alert>
                    )}
                    
                    <TextInput 
                        label="아이디" 
                        placeholder="admin 또는 스캐너 입력" 
                        required 
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        value={username}
                        onChange={(e) => setUsername(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleManualLogin();
                        }}
                    />
                    <PasswordInput 
                        label="비밀번호" 
                        placeholder="****" 
                        required 
                        mt="md" 
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleManualLogin();
                        }}
                    />
                    
                    <Button fullWidth mt="xl" onClick={handleManualLogin} loading={false}>
                        로그인
                    </Button>

                    <Button 
                        fullWidth 
                        mt="md" 
                        variant="outline" 
                        color="grape" 
                        onClick={() => setScanModalOpen(true)}
                    >
                        QR 코드로 로그인
                    </Button>
                </Paper>
            </Container>

            <Modal 
                opened={scanModalOpen} 
                onClose={() => setScanModalOpen(false)} 
                title="QR 코드 스캔"
                centered
            >
                {scanError ? (
                    <Alert color="red" title="카메라 오류" icon={<IconAlertCircle />}>
                        {scanError}
                        <br />
                        <Text size="xs" mt="xs">
                            * 모바일 브라우저 보안 정책상 <b>https</b> 또는 <b>localhost</b> 환경에서만 카메라 접근이 허용됩니다.<br/>
                            * IP 주소(http://192.168...)로 접속시 카메라가 차단될 수 있습니다.
                        </Text>
                    </Alert>
                ) : (
                    <>
                        <div id="reader" style={{ width: '100%', minHeight: '300px', backgroundColor: '#000' }}></div>
                        <Text size="sm" ta="center" mt="sm">카메라를 QR 코드에 비춰주세요.</Text>
                    </>
                )}
            </Modal>
        </Center>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<Center h="100vh"><Loader /></Center>}>
            <LoginContent />
        </Suspense>
    );
}
