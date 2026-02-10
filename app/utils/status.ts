/**
 * Standardizes Cylinder Status to Korean for user display.
 * Handles undefined, null, and English legacy statuses.
 * @param status - The raw status string from DB or API
 * @returns User-friendly Korean status string
 */
export function getStatusName(status: string | undefined | null): string {
    if (!status) return '미지정'; // Handle undefined/null as 'Undefined' in Korean

    const normalized = status.toUpperCase().trim();

    const statusMap: Record<string, string> = {
        // English mappings (Legacy/Import Safety)
        'EMPTY': '공병',
        'FULL': '실병',
        'CHARGING': '충전중',
        'DELIVERY': '납품',
        'INSPECTION': '검사대상',
        'INSPECTION_IN': '검사중',
        'LOST': '분실',
        'DEFECTIVE': '불량',
        'SCRAP': '폐기',
        'UNKNOWN': '미확인',
        
        // Korean Mappings (Self-mapping for safety/normalization)
        '공병': '공병',
        '충전중': '충전중',
        '실병': '실병',
        '납품': '납품',
        '불량': '불량',
        '분실': '분실',
        '검사대상': '검사대상',
        '검사중': '검사중',
        '폐기': '폐기',
        '미지정': '미지정'
    };

    return statusMap[normalized] || status; // Fallback to original if not found (likely already Korean or new status)
}
