
import { TransactionValidator } from '@/lib/transaction-validator';
import { deriveCylinderState } from '@/app/utils/cylinder';
import { Cylinder, Customer, Transaction } from '@/lib/types';

// Mock DB or Data Structures
const MULE_CYLINDER: Cylinder = {
    id: 'TM-001',
    serialNumber: 'TM-001',
    gasType: 'O2',
    status: '공병',
    location: 'SAMDUK',
    currentHolderId: '삼덕공장',
    containerType: 'CYLINDER',
    chargingExpiryDate: '2099-12-31', // Far future
    owner: '삼덕공장',
    isDeleted: false
};

const MULE_CUSTOMER: Customer = {
    id: 'CUST-MULE',
    name: '(주)테스트뮬',
    type: 'BUSINESS',
    paymentType: 'card',
    address: 'Test Address',
    phone: '010-0000-0000',
    businessNumber: '000-00-00000',
    ledgerNumber: '999',
    corporateId: '',
    representative: '',
    fax: '',
    balance: 0,
    isDeleted: false
};

describe('Zero Defect Logic Verification (100x Rule)', () => {

    test('100x Charging Cycle Validation', () => {
        const cylinder = { ...MULE_CYLINDER };
        
        for (let i = 0; i < 100; i++) {
            // 1. Validate Start
            cylinder.status = '공병';
            cylinder.currentHolderId = '삼덕공장';
            const startRes = TransactionValidator.validateChargingStart(cylinder);
            
            if (!startRes.success) {
                console.error(`Iteration ${i} Start Failed:`, startRes);
            }
            expect(startRes.success).toBe(true);

            // 2. Validate Complete
            cylinder.status = '충전중';
            const compRes = TransactionValidator.validateChargingComplete(cylinder);
            
            if (!compRes.success) {
                 console.error(`Iteration ${i} Complete Failed:`, compRes);
            }
            expect(compRes.success).toBe(true);
        }
    });

    test('100x Delivery & Collection Validation', () => {
        const cylinder = { ...MULE_CYLINDER };
        const customer = { ...MULE_CUSTOMER };

        for (let i = 0; i < 100; i++) {
            // 1. Delivery (Should succeed if Full)
            cylinder.status = '실병';
            cylinder.currentHolderId = '삼덕공장';
            
            const delRes = TransactionValidator.validateDelivery(cylinder, customer);
            expect(delRes.success).toBe(true);

            // 2. Collection (Should succeed if Delivered)
            cylinder.status = '납품';
            cylinder.currentHolderId = customer.id;

            const colRes = TransactionValidator.validateCollection(cylinder, customer.id);
            expect(colRes.success).toBe(true);
        }
    });

    test('Edge Case: Lost Cylinder Recovery', () => {
        const cylinder = { ...MULE_CYLINDER };
        cylinder.status = '분실';
        
        // Start Charging on LOST cylinder -> Should Fail with CYLINDER_LOST code (which API handles as recovery)
        const res = TransactionValidator.validateChargingStart(cylinder);
        expect(res.success).toBe(false);
        expect(res.code).toBe('CYLINDER_LOST');
    });

    test('Edge Case: Expiry Limit', () => {
        const cylinder = { ...MULE_CYLINDER };
        cylinder.chargingExpiryDate = '2000-01-01'; // Expired

        const res = TransactionValidator.validateChargingStart(cylinder);
        // Depending on logic, it might be Warning or Error.
        // Usually Start is allowed but Warned? Or Delivery blocked?
        // Let's check Warning.
        expect(res.success).toBe(true);
        expect(res.warning).toContain('기한');
    });

    test('Edge Case: Location Mismatch (Force Required)', () => {
        const cylinder = { ...MULE_CYLINDER };
        cylinder.currentHolderId = 'OTHER_CUSTOMER'; // Wrong location

        const res = TransactionValidator.validateDelivery(cylinder, MULE_CUSTOMER);
        expect(res.success).toBe(false);
        expect(res.code).toBe('LOCATION_MISMATCH');
    });

});
