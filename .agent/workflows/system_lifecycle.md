---
description: Standard Operating Procedure for Samduk High-Pressure Gas System
---

# Samduk System Workflow

This workflow describes the standard lifecycle of a gas cylinder within the Samduk System, from charging to delivery, collection, and ledger management.

## 1. Charging Process (Production)

**Location**: `Work > Charging Management`

1.  **Arrival**: Empty cylinders arrive at the factory.
2.  **Start Charging**:
    - Select "Start" mode.
    - Scan or Input Cylinder Serial Number.
    - System updates status to `CHARGING`.
3.  **Completion**:
    - Select "Complete" mode.
    - Scan Cylinder.
    - System updates status to `FULL` (Product Check).
    - _Logic_: Only `CHARGING` cylinders can be completed.

## 2. Delivery Process (Logistics)

**Location**: `Work > Delivery/Collection`

1.  **Select Customer**: Search and select the target customer.
2.  **Delivery (Sales)**:
    - Select "Delivery" tab.
    - Scan `FULL` cylinders.
    - Click "Delivery" button.
    - System updates status to `DELIVERED`, location to `Customer`.
3.  **Transaction**: A 'Delivery' transaction is logged for the customer.

## 3. Collection Process (Logistics)

**Location**: `Work > Delivery/Collection`

1.  **Select Customer**: Identify where the collection is happening.
2.  **Collection (Return)**:
    - Select "Collection" tab.
    - Scan cylinders (regardless of status, usually `DELIVERED` or `EMPTY`).
    - Click "Collection" button.
    - System updates status to `EMPTY`, location to `Samduk Factory`.
3.  **Transaction**: A 'Collection' transaction is logged.

## 4. Ledger Management (Finance)

**Location**: `Master > Ledger Modal`

1.  **Review**: Open Ledger Modal to view daily aggregate of Delivery/Collection.
2.  **Notes**:
    - Input "Deposit Status" (Card/Cash amounts).
    - Input "Expenditure Status" (Driver meals, gas, etc.).
    - _Auto-Save_: Data is saved automatically per date.
3.  **Print**: Click "Print" to generate a physical copy for sign-off.

## 5. Master Data

**Location**: `Master > Cylinders / Customers`

- **New Cylinder**: Register new assets with Serial, Gas Type, and Capacity.
- **New Customer**: Register business partners with pricing/payment terms.
