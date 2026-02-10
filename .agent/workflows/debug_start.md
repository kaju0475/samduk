---
description: Start the Full System Debugging & Verification Process (V3)
---

# 🚀 Full System Debugging Sequence (V3)

This workflow initiates the comprehensive V3 debugging protocol defined in `system_verification_protocol.md`.

## 1. Preparation & Tools

- Load Protocol: `c:/Users/new/.gemini/antigravity/brain/db63a16c-ae87-44df-9fa2-850d3517be0e/system_verification_protocol.md`
- **Methodology**: Use standard tools + MCP + Web Search + LMM Analysis freely.

## 2. Execution Phases

### Phase 1: Data Consistency Audit

- **Check**: DB Counts vs UI Counts. Encoding issues.

### Phase 2: Full Operational Cycle

- **Delivery**: Cart -> Submit -> Stock Move.
- **Charging**: Production Flow.
- **Inspection**: Quality Control Flow.

### Phase 3: Admin & Settings

- **Master Data**: CRUD tests.
- **Settings**: Backup/Restore, User Auth.

### Phase 4: UI/UX Deep Dive

- **Interactions**: Modal states, Mobile layout, Error messages.

### Phase 5: Optimization & Gap Analysis (NEW)

- **Dead Code Hunt**: Identify unused files, variable, legacy scripts.
- **Logic Review**: Flag redundant complexities.
- **Gap Analysis**: Identify missing validations or UX safety nets (e.g. "Confirm Delete").

## 3. Reporting

- **Output**: Create a `debugging_report_v3.md` artifact.
- **Content**:
  1. Bugs Found
  2. Data Issues
  3. **Recommended Deletions (Unused Code)**
  4. **Recommended Additions (Missing Logic)**

---

**Trigger**: User types `/debug_start`
