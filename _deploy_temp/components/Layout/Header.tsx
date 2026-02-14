import { useRouter } from 'next/navigation';
import { Group, Text, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';

interface HeaderProps {
  opened: boolean;
  toggle: () => void;
  title: string;
  themeColor?: string;
  onOpenSearch: () => void;
}

export function Header({ toggle, title, themeColor = '#ffffff', onOpenSearch }: HeaderProps) {
  const router = useRouter();

  useHotkeys([['mod+K', () => onOpenSearch()]]);

  const handleMenuClick = () => {
    // Check if mobile
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        router.push('/menu');
    } else {
        toggle();
    }
  };

  return (
    <>
      <Group h="100%" px="md" justify="space-between" style={{ 
          background: 'rgba(255,255,255,0.05)', 
          backdropFilter: 'blur(5px)',
          borderBottom: `1px solid ${themeColor}33`, 
          boxShadow: `0 4px 20px ${themeColor}15` 
      }}>
        <Group>
          <UnstyledButton 
              onClick={handleMenuClick} 
              hiddenFrom="sm" 
              style={{ 
                  color: 'white', 
                  fontWeight: 700, 
                  fontSize: '1.2rem',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.2)'
              }}
          >
              메뉴
          </UnstyledButton>
          <Text fw={700} size="xl" style={{ 
              color: 'white',
              textShadow: `0 0 20px ${themeColor}66`,
              fontSize: '2.2rem',
              letterSpacing: '-1px',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap'
          }}
          fz={{ base: '1.5rem', sm: '2.2rem' }}
          >{title}</Text>
        </Group>

        <Group>
           {/* Space holder or Empty */}
        </Group>
      </Group>
    </>
  );
}
