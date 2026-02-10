
export type UserRole = '관리자' | '사용자';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  password?: string;
  createdAt?: string;
}

export type GasType = string;

export interface GasItem {
    id: string; // e.g. 'O2-40L'
    name: string;
    capacity: string;
    color?: string;
    unit?: string;
    memo?: string;
    isDeleted?: boolean;
    deletedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  type: 'BUSINESS' | 'INDIVIDUAL';
  paymentType: 'card' | 'cash' | 'transfer' | 'tax_invoice';
  address: string;
  phone: string;
  businessNumber: string;
  ledgerNumber?: string;
  corporateId?: string;
  representative?: string; // Maps to DB 'manager'
  fax?: string;
  tanks?: Record<string, number>;
  lastTransactionDate?: string;
  balance: number;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
}

export type CylinderStatus = '공병' | '충전중' | '실병' | '납품' | '불량' | '분실' | '검사대상' | '검사중' | '폐기';

export interface Cylinder {
    id: string; // UUID
    serialNumber: string; // Maps to DB 'serial_number'
    gasType: string; // Maps to DB 'gas_type'
    gasColor?: string;
    containerType: 'CYLINDER' | 'SIPHON' | 'LGC' | 'RACK'; 
    capacity: string; // Maps to DB 'capacity' or 'volume'
    
    // Ownership/Location
    owner: string; // Maps to DB 'ownership'
    currentHolderId: string; // Maps to DB 'location'
    status: CylinderStatus;
    
    // Rack Logic
    bundleCount?: number; 
    childSerials?: string[]; 
    parentRackId?: string; 
    
    // Inspection & Dates
    manufactureDate?: string; 
    chargingExpiryDate?: string; // Maps to DB 'charging_expiry_date'
    lastInspectionDate: string;
    createdAt?: string;
    
    // Meta
    memo?: string;
    isDeleted?: boolean;

    // UI Helpers (Transient)
    locationName?: string;
    ownerName?: string;
    gasColorResolved?: string;
    
    // [FIX] DB Sync 호환성 추가
    workPressure?: string;
    createdDate?: string;
}

export type TransactionType = '충전' | '충전시작' | '충전완료' | '납품' | '회수' | '회수(실병)' | '검사출고' | '검사입고' | '기타출고' | '폐기' | '재검사' | '분실';

export interface Transaction {
  id: string;
  timestamp: string; // Maps to DB 'created_at' or 'date'
  type: TransactionType;
  cylinderId: string; // Can be UUID or Serial
  customerId?: string;
  workerId: string;
  memo?: string; // Note: DB might lack this, handled via Audit Log or fallback
}

export interface DashboardStats {
  totalCylinders: number;
  bgInDelivery: number;
  bgInFactory: number;
  defectiveCount: number;
  todayDelivery: number;
}

export interface CompanySettings {
    companyName: string;
    aliases: string[];
}

export interface DailyLedgerNote {
    id?: string;
    date: string;
    content?: string;
    deposit?: number;
    expenditure?: number;
}
