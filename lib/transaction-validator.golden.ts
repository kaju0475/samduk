/**
 * 🔒 CENTRAL CONTROL DEVICE (CORE LOGIC)
 * 
 * This file contains the authoritative validation rules for the entire Samduk System.
 * CRITICAL: Do NOT modify this file without explicit user approval.
 * Any mismatch between Delivery, Collection, Charging APIs in this logic will cause system corruption.
 * 
 * Reference Backup: ./transaction-validator.golden.ts
 */
import { Cylinder, Customer, CylinderStatus } from './types';

export type ValidationResult = {
    success: boolean;
    error?: string;
    code?: string; // e.g. 'STATUS_MISMATCH', 'LOCATION_MISMATCH'
};

export class TransactionValidator {
    /**
     * 납품 가능 여부 검증 (Delivery)
     * - 용기는 '실병' 상태여야 한다.
     * - 용기는 '삼덕공장'에 위치해야 한다.
     */
    static validateDelivery(cylinder: Cylinder, customerOrId: Customer | string): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다. 납품할 수 없습니다.', code: 'DISCARDED' };
        }

        // [PRIORITY] Expiry Validation (Must be checked before Status/Location)
        if (cylinder.chargingExpiryDate) {
               const today = new Date();
               const [expYear, expMonth] = cylinder.chargingExpiryDate.toString().split('-').map(Number);
               
               // Check if date is valid
               if (expYear && expMonth) {
                   const expiry = new Date(expYear, expMonth, 0); // End of month
                   today.setHours(0,0,0,0);
                   expiry.setHours(23,59,59,999);
                   
                   const diffTime = expiry.getTime() - today.getTime();
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                   if (diffDays <= 15) {
                       const isExpired = diffDays < 0;
                       function fmt(d: string) { return d && d.length >= 7 ? d.substring(0, 7) : d; }
                       const msg = isExpired 
                           ? `납품 불가: 충전기한이 지났습니다. (${fmt(cylinder.chargingExpiryDate)})` 
                           : `납품 불가: 용기 검사가 필요합니다. (충전기한 15일 이내)`;
                       
                       return { 
                           success: false, 
                           error: msg, 
                           code: 'EXPIRY_LIMIT' 
                        };
                   }
               }
        }

        // [Centralized Logic] Check for Duplicate Delivery
        const targetCustomerId = typeof customerOrId === 'string' ? customerOrId : customerOrId.id;
        if (cylinder.currentHolderId === targetCustomerId) {
             return { 
                 success: false, 
                 error: `이미 해당 거래처(${targetCustomerId})에 납품된 용기입니다.`, 
                 code: 'ALREADY_DELIVERED' 
             };
        }

        if (cylinder.status !== '실병') {
            let msg = `납품 불가: 용기 상태가 '${cylinder.status}'입니다. (필요: '실병')`;
            if (cylinder.status === '공병') msg = '빈 용기(공병)입니다. 납품 전에 충전해주세요.';
            else if (cylinder.status === '충전중') msg = '현재 충전 중인 용기입니다. 충전 완료 후 납품 가능합니다.';
            else if (cylinder.status === '납품') msg = `이미 납품된 용기입니다. (현재 위치: ${cylinder.currentHolderId})`;
            
            return {
                success: false,
                error: msg,
                code: 'STATUS_MISMATCH'
            };
        }

        if (cylinder.currentHolderId !== '삼덕공장') {
            return {
                success: false,
                error: `납품 불가: 용기가 현재 '삼덕공장'에 없습니다. (현재위치: ${cylinder.currentHolderId})`,
                code: 'LOCATION_MISMATCH'
            };
        }



        // TODO: 고객 별 가스 종류 제한 등이 있다면 추가 검증

        return { success: true };
    }

    /**
     * 회수 가능 여부 검증 (Collection)
     * - 용기는 '납품' 상태여야 한다. (혹은 이미 사용해서 '공병'이 되었을 수도 있으나, 시스템 상으로는 '납품' 상태에서 회수됨이 일반적)
     *   -> 현장 상황 고려: '납품', '공병', '실병'(미사용 반납) 모두 허용하되, 위치가 맞아야 함.
     * - 용기 위치가 해당 거래처여야 한다.
     */
    static validateCollection(cylinder: Cylinder, customerId: string): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다. 회수할 수 없습니다.', code: 'DISCARDED' };
        }

        // [PRIORITY] Expiry Validation
        if (cylinder.chargingExpiryDate) {
               const today = new Date();
               const [expYear, expMonth] = cylinder.chargingExpiryDate.toString().split('-').map(Number);
               
               if (expYear && expMonth) {
                   const expiry = new Date(expYear, expMonth, 0);
                   today.setHours(0,0,0,0);
                   expiry.setHours(23,59,59,999);
                   
                   const diffTime = expiry.getTime() - today.getTime();
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                   if (diffDays <= 15) {
                       const isExpired = diffDays < 0;
                       function fmt(d: string) { return d && d.length >= 7 ? d.substring(0, 7) : d; }
                       const msg = isExpired 
                           ? `회수 불가: 충전기한이 지났습니다. (${fmt(cylinder.chargingExpiryDate)})` 
                           : `회수 불가: 용기 검사가 필요합니다. (충전기한 15일 이내)`;
                       
                       return { 
                           success: false, 
                           error: msg, 
                           code: 'EXPIRY_LIMIT' 
                        };
                   }
               }
        }
        
        // 위치 검증이 가장 중요 strict하게
        if (cylinder.currentHolderId === 'INSPECTION_AGENCY') {
             return {
                success: false,
                error: `회수 불가: 용기가 '검사소'에 있습니다. 검사 입고(복귀) 처리를 먼저 해주세요.`,
                code: 'LOCATION_AGENCY'
             };
        }

        if (cylinder.currentHolderId !== customerId) {
            // [Centralized Logic] Check for Duplicate Collection (Already at Factory)
            if (cylinder.currentHolderId === '삼덕공장') {
                return {
                    success: false,
                    error: `이미 '삼덕가스공업(주)'에 반납된 용기입니다.`,
                    code: 'ALREADY_COLLECTED'
                };
            }

            const msg = `회수 불가: 용기가 해당 거래처에 없습니다. (현재위치: ${cylinder.currentHolderId})`;
            return {
                success: false,
                error: msg,
                code: 'LOCATION_MISMATCH'
            };
        }

        // 상태 검증: 보통 납품된 상태여야 함.
        // 하지만 데이터 꼬임 방지를 위해 위치가 맞으면 회수 허용 (단, 폐기/분실 등 특수 상태 제외)
        const allowedStatuses: CylinderStatus[] = ['납품', '실병', '공병'];
        if (!allowedStatuses.includes(cylinder.status)) {
            return {
                success: false,
                error: `회수 불가: 용기 상태가 '${cylinder.status}'입니다.`,
                code: 'STATUS_MISMATCH'
            };
        }

        return { success: true };
    }

    /**
     * 충전 시작 가능 여부 검증
     * - 용기는 '공병' 상태여야 한다.
     * - 용기는 '삼덕공장'에 위치해야 한다.
     */
    /**
     * 충전 시작 가능 여부 검증
     * - 용기는 '공병' 상태여야 한다.
     * - 용기는 '삼덕공장'에 위치해야 한다.
     */
    static validateChargingStart(cylinder: Cylinder): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다. 충전할 수 없습니다.', code: 'DISCARDED' };
        }

        // [PRIORITY] Expiry Validation (Added)
        if (cylinder.chargingExpiryDate) {
               const today = new Date();
               const [expYear, expMonth] = cylinder.chargingExpiryDate.toString().split('-').map(Number);
               
               if (expYear && expMonth) {
                   const expiry = new Date(expYear, expMonth, 0);
                   today.setHours(0,0,0,0);
                   expiry.setHours(23,59,59,999);
                   
                   const diffTime = expiry.getTime() - today.getTime();
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                   if (diffDays <= 15) {
                       const isExpired = diffDays < 0;
                       function fmt(d: string) { return d && d.length >= 7 ? d.substring(0, 7) : d; }
                       const msg = isExpired 
                           ? `충전 불가: 충전기한이 지났습니다. (${fmt(cylinder.chargingExpiryDate)})` 
                           : `충전 불가: 용기 검사가 필요합니다. (충전기한 15일 이내)`;

                       return { 
                           success: false, 
                           error: msg, 
                           code: 'EXPIRY_LIMIT' 
                        };
                   }
               }
        }

        if (cylinder.status !== '공병') {
            if (cylinder.status === '충전중') {
                 return {
                    success: false,
                    error: `이미 충전 중인 용기입니다.`,
                    code: 'ALREADY_CHARGING' // NEW CODE
                };
            }
            return {
                success: false,
                error: `충전시작 불가: 용기 상태가 '${cylinder.status}'입니다. (필요: '공병')`,
                code: 'STATUS_MISMATCH'
            };
        }

        if (cylinder.currentHolderId !== '삼덕공장') {
            return {
                success: false,
                error: `충전시작 불가: 용기가 '삼덕공장'에 없습니다. (현재 위치: ${cylinder.currentHolderId})`,
                code: 'LOCATION_MISMATCH'
            };
        }

        return { success: true };
    }

    /**
     * 충전 완료 가능 여부 검증
     * - 용기는 '충전중' 상태여야 한다.
     */
    static validateChargingComplete(cylinder: Cylinder): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다.', code: 'DISCARDED' };
        }

        // [PRIORITY] Expiry Validation
        if (cylinder.chargingExpiryDate) {
               const today = new Date();
               const [expYear, expMonth] = cylinder.chargingExpiryDate.toString().split('-').map(Number);
               
               if (expYear && expMonth) {
                   const expiry = new Date(expYear, expMonth, 0);
                   today.setHours(0,0,0,0);
                   expiry.setHours(23,59,59,999);
                   
                   const diffTime = expiry.getTime() - today.getTime();
                   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                   if (diffDays <= 15) {
                       const isExpired = diffDays < 0;
                       function fmt(d: string) { return d && d.length >= 7 ? d.substring(0, 7) : d; }
                       const msg = isExpired 
                           ? `충전완료 불가: 충전기한이 지났습니다. (${fmt(cylinder.chargingExpiryDate)})` 
                           : `충전완료 불가: 용기 검사가 필요합니다. (충전기한 15일 이내)`;

                       return { 
                           success: false, 
                           error: msg, 
                           code: 'EXPIRY_LIMIT' 
                        };
                   }
               }
        }

        if (cylinder.status !== '충전중') {
            if (cylinder.status === '실병') {
                 return {
                     success: false,
                     error: `이미 충전이 완료된 용기입니다.`,
                     code: 'ALREADY_FILLED' // NEW CODE
                 };
            }
            return {
                success: false,
                error: `충전완료 불가: 용기 상태가 '${cylinder.status}'입니다. (필요: '충전중')`,
                code: 'STATUS_MISMATCH'
            };
        }

        return { success: true };
    }

    /**
     * 검사 출고 가능 여부 검증 (Outbound Inspection)
     * - 용기는 '공병' 또는 '검사대상' 상태여야 한다.
     * - 용기는 '삼덕공장'에 위치해야 한다.
     * - 검사 기한이 45일 이상 남았으면 검사 보낼 필요 없음.
     */
    static validateInspectionOutbound(cylinder: Cylinder): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다. 검사를 보낼 수 없습니다.', code: 'DISCARDED' };
        }

        const allowedStatuses: CylinderStatus[] = ['공병', '검사대상', '실병', '검사중']; // '검사중' 일때도 다시 보낼 수 있나? 보통은 아님.
        // API was: '납품' or '충전중' -> block. Implicitly allowed others.
        // We stick to safe list.
        
        if (!allowedStatuses.includes(cylinder.status)) {
             // API Logic: if '납품' or '충전중', Fail with STATUS_ERROR
             if (['납품', '충전중'].includes(cylinder.status)) {
                 return {
                    success: false,
                    error: `현재 상태(${cylinder.status})에서는 검사를 보낼 수 없습니다.`,
                    code: 'STATUS_ERROR'
                 };
             }
             // For others, maybe allow? But best to be strict.
        }

        if (cylinder.currentHolderId === 'INSPECTION_AGENCY') {
            return { success: false, error: '이미 검사소에 있는 용기입니다.', code: 'LOCATION_AGENCY' };
        }
        
        if (cylinder.currentHolderId && cylinder.currentHolderId !== '삼덕공장') {
             // If manual override allows sending from anywhere? Usually from Factory.
             // We stick to Factory.
             return {
                success: false,
                error: `검사출고 불가: 용기가 '삼덕공장'에 없습니다. (현재위치: ${cylinder.currentHolderId})`,
                code: 'LOCATION_MISMATCH'
            };
        }

        // Expiry Validtion (45 days rule)
        if (cylinder.chargingExpiryDate) {
             const expiryStr = cylinder.chargingExpiryDate;
             // Basic parsing handles YYYY-MM and YYYY-MM-DD
             const [y, m, d] = expiryStr.split('-').map(Number);
             let targetDate: Date;
             if (!d) { // YYYY-MM
                 targetDate = new Date(y, m, 0); 
             } else {
                 targetDate = new Date(y, m - 1, d);
             }
             targetDate.setHours(0,0,0,0);
             
             const today = new Date();
             today.setHours(0,0,0,0);
             
             const diff = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
             
             if (diff > 45) {
                 return { 
                    success: false, 
                    error: `검사 대상이 아닙니다. (충전기한 45일 이상 남음: ${diff}일)`,
                    code: 'ERR_GT_45'
                };
             }
        }

        return { success: true };
    }

    /**
     * 검사 요청(검사 대상 등록) 가능 여부 검증 (Inspection Request / Inbound to Factory for Inspection?)
     * - API implementation was inline. Moved here.
     * - Checks Expiry Date Tiers (Red/Yellow/Green)
     */
    static validateInspectionRequest(cylinder: Cylinder): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다.', code: 'DISCARDED' };
        }
        
        // Status Check
        if (cylinder.status === '충전중' || cylinder.status === '납품') {
             return { 
                 success: false, 
                 error: `검사 입고 불가: 현재 상태(${cylinder.status})에서는 검사를 보낼 수 없습니다.`, 
                 code: 'INVALID_STATUS' 
             };
        }

        // Expiry Logic
        if (cylinder.chargingExpiryDate) {
            const today = new Date();
            const [expYear, expMonth] = cylinder.chargingExpiryDate.toString().split('-').map(Number);
            
            // End of month
            const expiry = new Date(expYear, expMonth, 0); 
            
            today.setHours(0,0,0,0);
            expiry.setHours(23,59,59,999);
            
            const diffTime = expiry.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Case 1: > 30 Days (Block)
            if (diffDays > 30) {
                 return { 
                     success: false, 
                     error: '충전기한이 30일 이상 남았습니다.',
                     code: 'ERR_GT_30' 
                 };
            }
            // Case 2: 15 < Days <= 30 (Warning/Block depending on policy)
            // User API logic blocked this range too with 'ERR_LT_30'.
            else if (diffDays > 15) {
                return { 
                     success: false, 
                     error: '충전기한이 30일 미만으로 남았습니다. (15일 이내만 가능)',
                     code: 'ERR_LT_30'
                 };
            }
            // Case 3: <= 15 Days (Allow)
            // Success
        } else {
             return { success: false, error: '충전기한 정보가 없습니다. (검사 불가)', code: 'ERR_NO_DATE' };
        }

        return { success: true };
    }

    /**
     * 검사 입고(완료) 가능 여부 검증 (Inbound Inspection)
     * - 용기는 '검사중' 상태여야 한다. (권장)
     * - 용기는 'INSPECTION_AGENCY' 에 있어야 한다.
     */
    static validateInspectionInbound(cylinder: Cylinder): ValidationResult {
        if (cylinder.status === '폐기') {
             return { success: false, error: '폐기된 용기입니다.', code: 'DISCARDED' };
        }

        if (cylinder.currentHolderId !== 'INSPECTION_AGENCY') {
            let msg = `검사 입고 불가: 용기가 '검사소'에 있지 않습니다. (현재 위치: ${cylinder.currentHolderId})`;
            if (cylinder.currentHolderId === '삼덕공장') msg += ' (이미 입고되었거나 출고되지 않았습니다)';
            
            return {
                success: false,
                error: msg,
                code: 'LOCATION_ERROR' // API used LOCATION_ERROR
            };
        }

        return { success: true };
    }
}
