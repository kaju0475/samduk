
const SAFE_COLORS = [
    'red', 'pink', 'grape', 'violet', 'indigo', 'blue', 'cyan', 'teal', 'green', 'lime', 'yellow', 'orange'
];

export const getGasColor = (gasType: string | undefined | null) => {
    if (!gasType) return 'gray';
    const type = gasType.toUpperCase();

    // Standard Mappings
    if (type.includes('산소') || type === 'O2') return 'green';
    if (type.includes('질소') || type === 'N2') return 'gray';
    if (type.includes('아르곤') || type === 'AR') return 'grape';
    if (type.includes('탄산') || type === 'CO2') return 'blue';
    if (type.includes('수소') || type === 'H2') return 'orange';
    if (type.includes('헬륨') || type === 'HE') return 'yellow';
    if (type.includes('아세틸렌') || type === 'C2H2') return 'yellow';
    if (type.includes('혼합') || type === 'MIX') return 'cyan';
    if (type.includes('LPG')) return 'dark';

    // Auto-assign color for new/unknown types based on name hash
    let hash = 0;
    for (let i = 0; i < gasType.length; i++) {
        hash = gasType.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % SAFE_COLORS.length;
    return SAFE_COLORS[index];
};

export const getKoreanGasName = (code: string | undefined | null) => {
    if (!code) return '';
    const c = code.toUpperCase();
    if (c === 'AR') return '아르곤';
    if (c === 'O2') return '산소';
    if (c === 'N2') return '질소';
    if (c === 'CO2') return '탄산';
    if (c === 'H2') return '수소';
    if (c === 'HE') return '헬륨';
    if (c === 'C2H2') return '아세틸렌';
    if (c === 'MIX') return '혼합가스';
    if (c === 'LPG') return 'LPG';
    // Add Nitrogen/Oxygen liquid differentiation if codes exist commonly, 
    // e.g. LO2 -> 액체산소, LN2 -> 액체질소, LAr -> 액체아르곤
    if (c === 'LO2') return '액체산소';
    if (c === 'LN2') return '액체질소';
    if (c === 'LAR') return '액체아르곤';

    return code; // Fallback to original if not found
};
