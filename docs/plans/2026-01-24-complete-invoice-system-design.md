# Complete Invoice System Implementation Design

**Date:** 2026-01-24
**Purpose:** Complete Week 2 by implementing Tax Table Management and Invoice System Enhancements
**Estimated Time:** 5 days (20-25 hours)
**Status:** Ready for implementation

---

## 1. Executive Summary

This design completes the Week 2 Invoice System by adding:
1. **Tax Table Management** - Brazilian tax compliance with configurable tax rates
2. **Invoice Line Item Editing** - Full CRUD operations on invoice items
3. **Tax Integration** - Replace hardcoded 10% tax with dynamic tax table selection
4. **Invoice Edit Functionality** - Complete edit page to replace current placeholder

**Current State:**
- ✅ Invoice creation with line items works
- ✅ Backend has complete tax table CRUD endpoints
- ❌ Invoice edit page is placeholder
- ❌ Tax calculation is hardcoded at 10%
- ❌ No tax table UI exists

**Target State:**
- ✅ Full tax table management UI
- ✅ Dynamic tax calculation from tax tables
- ✅ Complete invoice editing with line items
- ✅ Backend invoice item CRUD endpoints

---

## 2. Backend Schema Review

### Tax Table (Already Implemented)

```python
# backend/app/models/financial.py
class TaxTable(Base):
    id: UUID
    organization_id: UUID
    name: str                    # e.g., "ISS 5% - São Paulo"
    tax_type: TaxTypeEnum        # iss, irrf, pis, cofins, csll, inss, rental_tax, other
    rate_percentage: Decimal     # 0.00 to 100.00 (2 decimal places)
    description: str | None
    applies_to_income: str | None    # JSON: categories this applies to
    applies_to_expenses: str | None  # JSON: categories this applies to
    is_active: bool              # Enable/disable without deletion
    created_at: datetime
    updated_at: datetime
```

**Available Endpoints:**
- `GET /api/v1/tax-tables/` - List tax tables
- `POST /api/v1/tax-tables/` - Create (Admin/Manager only)
- `GET /api/v1/tax-tables/{id}` - Get single
- `PUT /api/v1/tax-tables/{id}` - Update (Admin/Manager only)
- `DELETE /api/v1/tax-tables/{id}` - Delete (Admin/Manager only)

### Invoice & Invoice Items (Already Implemented)

```python
# backend/app/models/financial.py
class Invoice(Base):
    id: UUID
    organization_id: UUID
    client_id: UUID
    project_id: UUID | None
    invoice_number: str          # Auto-generated: INV-{year}-{sequential}
    status: InvoiceStatusEnum    # draft, sent, paid, overdue, cancelled
    subtotal_cents: int          # Sum of all items
    tax_amount_cents: int        # Total taxes applied
    total_amount_cents: int      # subtotal + tax
    currency: str                # Default "BRL"
    issue_date: date
    due_date: date
    paid_date: date | None
    description: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    # Relationships
    items: List[InvoiceItem]
    client: Client
    project: Project | None

class InvoiceItem(Base):
    id: UUID
    organization_id: UUID
    invoice_id: UUID
    description: str
    quantity: Decimal            # > 0
    unit_price_cents: int        # > 0
    total_cents: int             # quantity * unit_price_cents
    project_id: UUID | None
    category: str | None
    created_at: datetime
```

**Current Endpoints:**
- ✅ `GET /api/v1/invoices/` - List invoices
- ✅ `POST /api/v1/invoices/` - Create with items
- ✅ `GET /api/v1/invoices/{id}` - Get with items/client/project
- ✅ `PUT /api/v1/invoices/{id}` - Update (status, dates, notes only)
- ✅ `DELETE /api/v1/invoices/{id}` - Delete

**Missing Endpoints (Need to Add):**
- ❌ `POST /api/v1/invoices/{invoice_id}/items` - Add item
- ❌ `PUT /api/v1/invoices/{invoice_id}/items/{item_id}` - Update item
- ❌ `DELETE /api/v1/invoices/{invoice_id}/items/{item_id}` - Delete item

---

## 3. Frontend Type Definitions

### New Types to Add

```typescript
// frontend/types/index.ts

// Tax Table Types
export type TaxType =
  | 'iss'          // Service Tax (Brazil)
  | 'irrf'         // Income Tax Withholding
  | 'pis'          // Social Contribution Tax
  | 'cofins'       // Social Contribution Tax
  | 'csll'         // Social Contribution Tax
  | 'inss'         // Social Security
  | 'rental_tax'   // Equipment rental tax
  | 'other'

export interface TaxTable {
  id: UUID
  organization_id: UUID
  name: string
  tax_type: TaxType
  rate_percentage: number        // 0-100
  description: string | null
  applies_to_income: string | null    // JSON string
  applies_to_expenses: string | null  // JSON string
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface TaxTableCreate {
  name: string
  tax_type: TaxType
  rate_percentage: number        // 0-100
  description?: string
  applies_to_income?: string     // JSON string
  applies_to_expenses?: string   // JSON string
}

export interface TaxTableUpdate {
  name?: string
  tax_type?: TaxType
  rate_percentage?: number
  description?: string
  applies_to_income?: string
  applies_to_expenses?: string
  is_active?: boolean
}

// Invoice Item Management Types
export interface InvoiceItemUpdate {
  description?: string
  quantity?: number
  unit_price_cents?: number
  total_cents?: number
  category?: string
}

// Enhanced Invoice Create with Tax Tables
export interface InvoiceCreateEnhanced extends InvoiceCreate {
  tax_table_ids?: UUID[]  // Optional tax tables to apply
}

// Helper function to get tax type display name
export function getTaxTypeDisplayName(taxType: TaxType): string {
  const taxTypeNames: Record<TaxType, string> = {
    iss: 'ISS (Service Tax)',
    irrf: 'IRRF (Income Tax Withholding)',
    pis: 'PIS (Social Contribution)',
    cofins: 'COFINS (Social Contribution)',
    csll: 'CSLL (Social Contribution)',
    inss: 'INSS (Social Security)',
    rental_tax: 'Rental Tax',
    other: 'Other'
  }
  return taxTypeNames[taxType]
}
```

---

## 4. Implementation Plan

### Phase 1: Tax Table Management (Days 1-2, 8-10 hours)

**Step 1.1: Create Tax Tables Hook**

File: `frontend/lib/api/hooks/useTaxTables.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../client'
import { TaxTable, TaxTableCreate, TaxTableUpdate } from '@/types'

export function useTaxTables(organizationId: string, activeOnly: boolean = true) {
  return useQuery({
    queryKey: ['tax-tables', organizationId, activeOnly],
    queryFn: async () => {
      const { data } = await api.get<TaxTable[]>('/tax-tables/', {
        params: {
          organization_id: organizationId,
          active_only: activeOnly
        }
      })
      return data
    },
    enabled: !!organizationId
  })
}

export function useTaxTable(taxTableId: string, organizationId: string) {
  return useQuery({
    queryKey: ['tax-table', taxTableId],
    queryFn: async () => {
      const { data } = await api.get<TaxTable>(`/tax-tables/${taxTableId}`)
      return data
    },
    enabled: !!taxTableId && !!organizationId
  })
}

export function useCreateTaxTable(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taxTableData: TaxTableCreate) => {
      const { data } = await api.post('/tax-tables/', taxTableData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-tables', organizationId] })
    }
  })
}

export function useUpdateTaxTable(taxTableId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taxTableData: TaxTableUpdate) => {
      const { data } = await api.put(`/tax-tables/${taxTableId}`, taxTableData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-table', taxTableId] })
      queryClient.invalidateQueries({ queryKey: ['tax-tables', organizationId] })
    }
  })
}

export function useDeleteTaxTable(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taxTableId: string) => {
      await api.delete(`/tax-tables/${taxTableId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-tables', organizationId] })
    }
  })
}
```

**Step 1.2: Tax Table List Page**

File: `frontend/app/(dashboard)/financials/tax-tables/page.tsx`

Features:
- Display all tax tables in card grid
- Show: name, tax type, rate percentage, active status
- Filter by tax type and active/inactive
- Search by name
- Actions: New, Edit, Deactivate/Activate, Delete

Pattern: Follow `frontend/app/(dashboard)/clients/page.tsx`

**Step 1.3: New Tax Table Page**

File: `frontend/app/(dashboard)/financials/tax-tables/new/page.tsx`

Form Fields:
- Name (text input, required)
- Tax Type (dropdown, required)
- Rate Percentage (number input, 0-100, required)
- Description (textarea, optional)
- Applies To Income (multi-select checkboxes, optional)
- Applies To Expenses (multi-select checkboxes, optional)

Validation:
- Name: min 1 char
- Rate: 0 ≤ rate ≤ 100
- At least one applicability rule (income or expense)

Pattern: Follow `frontend/app/(dashboard)/clients/new/page.tsx`

**Step 1.4: Edit Tax Table Page**

File: `frontend/app/(dashboard)/financials/tax-tables/[id]/edit/page.tsx`

Features:
- Same form as new, pre-populated
- Add "Active" toggle switch
- Admin/Manager permission check
- Show created/updated timestamps
- Delete button with confirmation

Pattern: Follow `frontend/app/(dashboard)/clients/[id]/edit/page.tsx`

---

### Phase 2: Backend Invoice Item Endpoints (Day 3, 4-6 hours)

**Step 2.1: Add Invoice Item Service Methods**

File: `backend/app/services/financial_advanced.py`

Add to `InvoiceService` class:

```python
async def add_item(
    self,
    db: AsyncSession,
    invoice_id: UUID,
    organization_id: UUID,
    item_in: InvoiceItemCreate
) -> InvoiceItem:
    """Add a new item to an existing invoice and recalculate totals."""
    # 1. Get invoice and verify ownership
    invoice = await self.get(db, organization_id, invoice_id)
    if not invoice:
        raise ValueError("Invoice not found")

    # 2. Only allow adding items to draft invoices
    if invoice.status != InvoiceStatusEnum.draft:
        raise ValueError("Can only add items to draft invoices")

    # 3. Create invoice item
    from app.models.financial import InvoiceItem

    item = InvoiceItem(
        organization_id=organization_id,
        invoice_id=invoice_id,
        **item_in.model_dump()
    )
    db.add(item)

    # 4. Recalculate invoice totals
    invoice.subtotal_cents += item.total_cents
    invoice.total_amount_cents = invoice.subtotal_cents + invoice.tax_amount_cents

    await db.commit()
    await db.refresh(item)
    return item

async def update_item(
    self,
    db: AsyncSession,
    invoice_id: UUID,
    item_id: UUID,
    organization_id: UUID,
    item_in: InvoiceItemUpdate
) -> InvoiceItem:
    """Update an invoice item and recalculate invoice totals."""
    # Similar logic to add_item but updates existing
    pass

async def delete_item(
    self,
    db: AsyncSession,
    invoice_id: UUID,
    item_id: UUID,
    organization_id: UUID
) -> InvoiceItem:
    """Delete an invoice item and recalculate invoice totals."""
    # Similar logic to add_item but removes
    pass
```

**Step 2.2: Add Invoice Item Endpoints**

File: `backend/app/api/v1/endpoints/financial.py`

```python
@router.post(
    "/invoices/{invoice_id}/items",
    response_model=InvoiceItem,
    dependencies=[Depends(require_admin_or_manager)]
)
async def add_invoice_item(
    invoice_id: UUID,
    item_in: InvoiceItemCreate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceItem:
    """Add a new item to an invoice. Only works on draft invoices."""
    try:
        item = await invoice_service.add_item(
            db=db,
            invoice_id=invoice_id,
            organization_id=organization_id,
            item_in=item_in
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.put(
    "/invoices/{invoice_id}/items/{item_id}",
    response_model=InvoiceItem,
    dependencies=[Depends(require_admin_or_manager)]
)
async def update_invoice_item(
    invoice_id: UUID,
    item_id: UUID,
    item_in: InvoiceItemUpdate,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceItem:
    """Update an invoice item. Only works on draft invoices."""
    # Implementation similar to add_invoice_item
    pass

@router.delete(
    "/invoices/{invoice_id}/items/{item_id}",
    response_model=InvoiceItem,
    dependencies=[Depends(require_admin_or_manager)]
)
async def delete_invoice_item(
    invoice_id: UUID,
    item_id: UUID,
    organization_id: UUID = Depends(get_current_organization),
    db: AsyncSession = Depends(get_db),
) -> InvoiceItem:
    """Delete an invoice item. Only works on draft invoices."""
    # Implementation similar to add_invoice_item
    pass
```

---

### Phase 3: Invoice Enhancements (Days 4-5, 8-10 hours)

**Step 3.1: Enhance Invoice Hook**

File: `frontend/lib/api/hooks/useInvoices.ts`

Add mutations for item management:

```typescript
export function useAddInvoiceItem(invoiceId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemData: InvoiceItemCreate) => {
      const { data } = await api.post(
        `/invoices/${invoiceId}/items`,
        itemData
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', organizationId] })
    }
  })
}

export function useUpdateInvoiceItem(
  invoiceId: string,
  itemId: string,
  organizationId: string
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemData: InvoiceItemUpdate) => {
      const { data } = await api.put(
        `/invoices/${invoiceId}/items/${itemId}`,
        itemData
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', organizationId] })
    }
  })
}

export function useDeleteInvoiceItem(invoiceId: string, organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/invoices/${invoiceId}/items/${itemId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices', organizationId] })
    }
  })
}
```

**Step 3.2: Build Invoice Edit Page**

File: `frontend/app/(dashboard)/financials/invoices/[id]/edit/page.tsx`

Features:
- Load existing invoice with items
- Display/edit line items with Add/Remove/Modify
- Real-time subtotal/tax/total recalculation
- Status dropdown (draft/sent/paid/overdue/cancelled)
- Date pickers (due date, paid date when status=paid)
- Currency and notes editing
- Restrictions:
  - Only draft invoices can have items edited
  - Sent/paid invoices can only update status and dates
- Save button calls item mutations + invoice update

Layout:
```
┌─────────────────────────────────────┐
│ Edit Invoice #INV-2026-001          │
├─────────────────────────────────────┤
│ Status: [Draft ▼] Due: [Date Picker]│
│ Client: [Read-only]                 │
│ Project: [Read-only]                │
├─────────────────────────────────────┤
│ Line Items                    [+ Add]│
│ ┌───────────────────────────────────┐│
│ │ Description | Qty | Price | Total ││
│ │ [Input]     | [#] | [#]   | $X.XX ││
│ │                          [Delete] ││
│ └───────────────────────────────────┘│
├─────────────────────────────────────┤
│ Subtotal: $X,XXX.XX                 │
│ Tax (10%): $XXX.XX                  │
│ Total: $X,XXX.XX                    │
├─────────────────────────────────────┤
│ [Cancel] [Save Changes]             │
└─────────────────────────────────────┘
```

**Step 3.3: Enhance New Invoice Form**

File: `frontend/app/(dashboard)/financials/new-invoice/page.tsx`

Changes:
1. **Remove hardcoded 10% tax:**
   - Delete `calculateTax()` function
   - Remove tax display from summary

2. **Add tax table selector:**
   - Multi-select for applicable tax tables
   - Show selected taxes and their rates
   - Display total tax percentage
   - Calculate tax amount on frontend for preview

3. **Backend will calculate final tax:**
   - Send `tax_table_ids` in InvoiceCreate
   - Backend applies tax rules and returns final amount
   - Frontend displays backend-calculated total

4. **Smart defaults:**
   - Invoice number: Auto-generated on backend
   - Issue date: Default to today
   - Due date: Default to 30 days from issue

---

## 5. Testing Strategy

### Unit Tests (Backend)

```python
# backend/tests/test_invoice_items.py

async def test_add_item_to_draft_invoice():
    """Test adding item to draft invoice recalculates totals."""
    # Create draft invoice
    # Add item
    # Assert subtotal and total updated

async def test_cannot_add_item_to_sent_invoice():
    """Test that sent invoices cannot have items added."""
    # Create sent invoice
    # Try to add item
    # Assert ValueError raised

async def test_update_item_recalculates_totals():
    """Test updating item quantity/price recalculates invoice."""
    # Create invoice with item
    # Update item
    # Assert totals recalculated

async def test_delete_item_recalculates_totals():
    """Test deleting item reduces invoice total."""
    # Create invoice with 2 items
    # Delete 1 item
    # Assert total reduced correctly
```

### Integration Tests (Frontend)

```typescript
// Manual test scenarios

1. Tax Table Management
   - Create new tax table with 5% ISS
   - Edit rate to 5.5%
   - Deactivate tax table
   - Delete tax table

2. Invoice Creation with Tax
   - Create invoice with line items
   - Select ISS 5% tax table
   - Verify total = subtotal * 1.05
   - Submit and verify backend calculation

3. Invoice Editing
   - Create draft invoice
   - Add new line item
   - Modify existing item quantity
   - Delete line item
   - Verify totals update correctly
   - Change status to sent
   - Verify items no longer editable

4. Tax Calculation
   - Create invoice with multiple tax tables
   - Verify cumulative tax applied correctly
   - Test edge cases (0% tax, 100% tax)
```

---

## 6. Edge Cases & Error Handling

### Validation Rules

1. **Tax Table Creation:**
   - Rate must be 0-100
   - Name must be unique within organization
   - At least one applicability rule required

2. **Invoice Item Management:**
   - Quantity must be > 0
   - Unit price must be > 0
   - Total must equal quantity × unit_price
   - Description required (min 1 char)

3. **Invoice Editing:**
   - Can only edit items on draft invoices
   - Sent/paid invoices: status and dates only
   - Cannot delete all items (min 1 required)
   - Cannot set paid_date without status=paid

### Error Messages

```typescript
// User-friendly error messages

"Tax rate must be between 0% and 100%"
"Cannot add items to sent invoices. Change status to draft first."
"Invoice must have at least one line item"
"Invalid quantity. Must be greater than 0."
"Tax table name already exists in your organization"
"You don't have permission to manage tax tables (Admin/Manager only)"
```

---

## 7. UI/UX Considerations

### Tax Table List Page

- **Card View:** Similar to clients page
- **Color Coding:**
  - Active tax tables: Green badge
  - Inactive: Gray badge
- **Quick Actions:** Edit, Deactivate, Delete
- **Search:** By name or tax type
- **Filters:** Tax type dropdown, Active/Inactive toggle

### Invoice Edit Page

- **Visual Feedback:**
  - Subtotal/tax/total update in real-time
  - Disabled fields when invoice is sent/paid
  - Confirmation dialog before deleting items
- **Status Indicator:**
  - Draft: Blue
  - Sent: Yellow
  - Paid: Green
  - Overdue: Red
  - Cancelled: Gray

### New Invoice Form

- **Tax Table Selector:**
  - Multi-select with checkboxes
  - Show tax rate next to each table
  - Display total tax percentage at bottom
  - Preview mode: "Preview tax calculation"

---

## 8. Implementation Checklist

### Backend Tasks

- [ ] Add InvoiceItemUpdate schema to `schemas/financial.py`
- [ ] Implement invoice_service.add_item() method
- [ ] Implement invoice_service.update_item() method
- [ ] Implement invoice_service.delete_item() method
- [ ] Add POST /invoices/{id}/items endpoint
- [ ] Add PUT /invoices/{id}/items/{item_id} endpoint
- [ ] Add DELETE /invoices/{id}/items/{item_id} endpoint
- [ ] Add tax_table_ids to InvoiceCreate schema (optional)
- [ ] Implement tax calculation logic in invoice creation
- [ ] Write unit tests for item CRUD operations
- [ ] Test tax calculation with multiple tables

### Frontend Tasks - Phase 1: Tax Tables

- [ ] Add TaxTable types to `types/index.ts`
- [ ] Create `lib/api/hooks/useTaxTables.ts`
- [ ] Export useTaxTables from `lib/api/hooks/index.ts`
- [ ] Create `app/(dashboard)/financials/tax-tables/page.tsx`
- [ ] Create `app/(dashboard)/financials/tax-tables/new/page.tsx`
- [ ] Create `app/(dashboard)/financials/tax-tables/[id]/edit/page.tsx`
- [ ] Add "Tax Tables" link to financials navigation
- [ ] Test tax table CRUD operations

### Frontend Tasks - Phase 2: Invoice Enhancements

- [ ] Add useAddInvoiceItem to `lib/api/hooks/useInvoices.ts`
- [ ] Add useUpdateInvoiceItem to `lib/api/hooks/useInvoices.ts`
- [ ] Add useDeleteInvoiceItem to `lib/api/hooks/useInvoices.ts`
- [ ] Replace placeholder invoice edit page
- [ ] Implement line item management in edit page
- [ ] Add tax table selector to new invoice form
- [ ] Remove hardcoded 10% tax calculation
- [ ] Add smart defaults (dates, invoice number)
- [ ] Test invoice creation with tax tables
- [ ] Test invoice editing (add/update/delete items)
- [ ] Test status change restrictions
- [ ] End-to-end workflow testing

---

## 9. Success Criteria

### Week 2 Complete When:

1. ✅ **Tax Tables Manageable**
   - Can create/edit/delete tax tables
   - Admin/Manager permissions enforced
   - Active/inactive status works

2. ✅ **Invoice System Enhanced**
   - Can edit invoices and their line items
   - Draft invoices: full editing
   - Sent/paid invoices: status/dates only
   - No more hardcoded 10% tax

3. ✅ **Tax Integration Working**
   - New invoices use tax tables
   - Backend calculates tax correctly
   - Multiple tax tables can be applied
   - Tax breakdown visible to users

4. ✅ **All Tests Pass**
   - Backend item CRUD tests pass
   - Frontend manual testing complete
   - No 422 validation errors
   - Real-time calculations accurate

---

## 10. Migration Notes

### No Database Migrations Required

All database tables already exist:
- `tax_tables` table: ✅ Ready
- `invoices` table: ✅ Ready
- `invoice_items` table: ✅ Ready

### Data Considerations

- Existing invoices will continue to work
- Hardcoded 10% tax preserved in existing invoices
- New invoices will use tax table system
- No data migration needed

---

## 11. Future Enhancements (Post Week 2)

### Not in Scope for Week 2:

1. **Tax Reports**
   - Tax liability reports
   - Tax withholding summaries
   - Monthly/annual tax calculations

2. **Invoice Templates**
   - Custom PDF invoice templates
   - Email invoice sending
   - Automated reminder emails

3. **Payment Integration**
   - Payment gateway integration
   - Payment recording workflow
   - Partial payment tracking

4. **Recurring Invoices**
   - Subscription billing
   - Automated invoice generation
   - Payment schedules

---

## 12. Timeline & Effort Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1: Tax Tables** | Hook + 3 pages | 8-10 hours (Days 1-2) |
| **Phase 2: Backend Items** | Service methods + endpoints | 4-6 hours (Day 3) |
| **Phase 3: Invoice Enhancements** | Edit page + new invoice updates | 8-10 hours (Days 4-5) |
| **Total** | | **20-26 hours (5 days)** |

### Daily Breakdown

**Day 1 (4 hours):**
- Create useTaxTables hook
- Build tax table list page
- Add types to index.ts

**Day 2 (4 hours):**
- Build new tax table page
- Build edit tax table page
- Test tax table CRUD

**Day 3 (5 hours):**
- Implement backend item service methods
- Add item CRUD endpoints
- Write backend tests

**Day 4 (5 hours):**
- Enhance useInvoices hook
- Build invoice edit page
- Implement line item management

**Day 5 (4 hours):**
- Enhance new invoice form
- Add tax table selector
- End-to-end testing

---

## 13. Risk Mitigation

### Potential Issues

1. **Tax Calculation Complexity**
   - Risk: Multiple tax tables may interact unexpectedly
   - Mitigation: Start simple (additive taxes), document behavior

2. **Invoice Editing Permissions**
   - Risk: Users may accidentally edit sent invoices
   - Mitigation: Clear status-based restrictions, confirmation dialogs

3. **Data Consistency**
   - Risk: Invoice totals may become inconsistent
   - Mitigation: Backend recalculates on every item change

4. **Performance**
   - Risk: Many tax tables may slow down invoice creation
   - Mitigation: Load active tables only, cache on frontend

---

## 14. Documentation Updates Needed

After implementation, update:

1. **QUICK_START_ACTION_GUIDE.md**
   - Mark Week 2 as complete
   - Update checklist

2. **SAFETASKS_V3_FRONTEND_MANUAL_CORRECTED.md**
   - Add TaxTable schema reference
   - Add InvoiceItem management patterns
   - Document tax integration

3. **API Documentation**
   - Document new item endpoints
   - Update InvoiceCreate schema docs

---

## 15. Ready for Implementation

This design is ready to be executed using the `superpowers:writing-plans` skill to create a detailed implementation plan with step-by-step tasks.

**Approval Status:** ✅ Ready
**Next Step:** Create implementation plan and begin Phase 1

---

**Design Document Version:** 1.0
**Last Updated:** 2026-01-24
**Author:** Claude Sonnet 4.5 with User Collaboration
