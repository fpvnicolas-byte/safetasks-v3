/**
 * SafeTasks V3 - Frontend Type Definitions
 *
 * ⚠️ CRITICAL: This file is now 100% aligned with backend Pydantic schemas.
 * All types match backend/app/schemas/*.py files EXACTLY.
 *
 * Last Sync: 2026-01-24
 * Source: Backend schemas in backend/app/schemas/
 *
 * Date Format Notes:
 * - created_at, updated_at: ISO datetime strings (e.g., "2024-01-23T12:00:00Z")
 * - date fields: ISO date strings (e.g., "2024-01-23")
 * - time fields: HH:MM:SS format (e.g., "08:00:00") - serialized from Python time objects
 * - *_cents fields: integers representing currency in cents
 */

// Utility Types
export type UUID = string
export type ISODateTime = string // ISO 8601 datetime string
export type ISODate = string // YYYY-MM-DD format
export type TimeString = string // HH:MM:SS format (Python time serialized)

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export type OrganizationPlan = 'free' | 'starter' | 'professional' | 'enterprise'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'

export interface Organization {
  id: UUID
  name: string
  tax_id: string | null
  cnpj_tax_rate: number | null
  produtora_tax_rate: number | null
  default_bank_account_id: UUID | null
  plan: OrganizationPlan
  subscription_status: SubscriptionStatus
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

export type ProjectStatus =
  | 'draft'
  | 'pre-production'
  | 'production'
  | 'post-production'
  | 'delivered'
  | 'archived'

export type BudgetStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'increment_pending'

export interface Project {
  id: UUID
  organization_id: UUID
  client_id: UUID // REQUIRED - every project must have a client
  title: string
  description: string | null // Backend has this field
  status: ProjectStatus
  budget_total_cents: number // Integer (cents), default 0, min 0
  // Budget approval workflow
  budget_status: BudgetStatus
  budget_approved_by: UUID | null
  budget_approved_at: ISODateTime | null
  budget_notes: string | null
  // Budget increment request fields
  budget_increment_requested_cents: number
  budget_increment_notes: string | null
  budget_increment_requested_at: ISODateTime | null
  budget_increment_requested_by: UUID | null
  start_date: ISODate | null // YYYY-MM-DD
  end_date: ISODate | null // YYYY-MM-DD
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
  // Relationships (if loaded)
  services?: Service[]
}

export interface ProjectWithClient extends Project {
  client: Client // Client relationship when loaded
}

export interface ProjectStats {
  scenes_count: number
  characters_count: number
  shooting_days_count: number
  confirmed_shooting_days_count: number
  team_count: number
}

export interface ProjectFinancialSummary {
  project_id: UUID
  // Proposal / Revenue
  proposal_value_cents: number
  proposal_status: string | null
  // Budget
  budget_total_cents: number
  budget_status: BudgetStatus
  budget_approved_at: ISODateTime | null
  // Actuals
  total_income_cents: number
  total_expense_cents: number
  // Calculated
  remaining_budget_cents: number
  profit_cents: number
  profit_margin_percent: number | null
}


// ============================================================================
// CLIENT TYPES
// ============================================================================

export interface Client {
  id: UUID
  organization_id: UUID
  name: string
  email: string | null
  phone: string | null
  document: string | null // Tax ID or document number (CPF/CNPJ)
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ClientCreate {
  name: string
  email?: string
  document?: string
  phone?: string
  organization_id?: UUID
}

export interface ClientUpdate {
  name?: string
  email?: string
  document?: string
  phone?: string
  is_active?: boolean
}

// ============================================================================
// CALL SHEET TYPES
// ============================================================================

export type CallSheetStatus = 'draft' | 'confirmed' | 'completed'

export interface CallSheet {
  id: UUID
  organization_id: UUID
  project_id: UUID
  shooting_day: ISODate // Backend field name (Python date)
  status: CallSheetStatus

  // Location Information
  location: string | null // Location name (backend field)
  location_address: string | null
  parking_info: string | null // Parking instructions

  // Time Schedule (Python time objects → serialized as HH:MM:SS strings)
  crew_call: TimeString | null // General crew call time
  on_set: TimeString | null // On-set ready time (shooting call)
  lunch_time: TimeString | null // Lunch break time
  wrap_time: TimeString | null // Expected wrap time

  // Production Information
  weather: string | null // Weather forecast (backend field name)
  notes: string | null

  // Safety & Logistics
  hospital_info: string | null // Nearest hospital/emergency contact

  created_at: ISODateTime
  updated_at: ISODateTime
  project?: {
    id: UUID
    title: string
    client?: {
      id: UUID
      name: string
    }
  }
}

export interface CallSheetWithProject extends CallSheet {
  project: Project
}

// ============================================================================
// FINANCIAL TYPES
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type ExpenseCategory = 'pre_production' | 'production' | 'post_production' | 'marketing' | 'other'

export interface InvoiceItem {
  id: UUID
  invoice_id: UUID
  description: string
  quantity: number
  unit_price_cents: number // Integer (cents)
  total_cents: number // Integer (cents)
  created_at: ISODateTime
}

export interface Invoice {
  id: UUID
  organization_id: UUID
  project_id: UUID | null
  client_id: UUID
  invoice_number: string
  status: InvoiceStatus
  issue_date: ISODate // YYYY-MM-DD
  due_date: ISODate // YYYY-MM-DD
  paid_date: ISODate | null // YYYY-MM-DD
  subtotal_cents: number // Integer (cents)
  tax_amount_cents: number // Integer (cents) - matches backend
  total_amount_cents: number // Integer (cents) - matches backend
  currency: string
  description: string | null
  notes: string | null
  payment_method: string | null
  payment_reference: string | null
  payment_notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
  client?: Client | null
  project?: Project | null
}

// ============================================================================
// BANK ACCOUNT TYPES
// ============================================================================

export interface BankAccount {
  id: UUID
  organization_id: UUID
  name: string
  balance_cents: number // Integer (cents)
  currency: string // e.g., "USD", "BRL", "EUR"
  created_at: ISODateTime
}

export interface BankAccountCreate {
  name: string
  currency?: string // Defaults to "BRL" in backend
}

export interface BankAccountUpdate {
  name?: string
  currency?: string
}

export interface BankAccountTransferCreate {
  from_bank_account_id: UUID
  to_bank_account_id: UUID
  amount_cents: number
  transaction_date: ISODate
  description?: string
}

export interface BankAccountTransferResponse {
  from_transaction: TransactionWithRelations
  to_transaction: TransactionWithRelations
}

// Helper functions for currency conversion
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

/** @deprecated Use toCents() */
export const dollarsToCents = toCents
/** @deprecated Use fromCents() */
export const centsToDollars = fromCents

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export type TransactionType = 'income' | 'expense'
export type TransactionPaymentStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export type TransactionCategory =
  | 'crew_hire'
  | 'equipment_rental'
  | 'logistics'
  | 'post_production'
  | 'maintenance'
  | 'other'
  | 'production_revenue'
  | 'internal_transfer'

export interface Transaction {
  id: UUID
  organization_id: UUID
  bank_account_id: UUID
  project_id: UUID | null
  invoice_id: UUID | null
  supplier_id: UUID | null
  stakeholder_id: UUID | null
  budget_line_id: UUID | null
  category: TransactionCategory
  type: TransactionType
  amount_cents: number // Integer (cents), must be positive
  description: string | null
  transaction_date: ISODate // YYYY-MM-DD
  created_at: ISODateTime
  payment_status: TransactionPaymentStatus
  approved_by?: UUID | null
  approved_at?: ISODateTime | null
  rejection_reason?: string | null
  paid_by?: UUID | null
  paid_at?: ISODateTime | null
}

export interface TransactionWithRelations extends Transaction {
  bank_account: BankAccount
  project: Project | null
}

export interface TransactionCreate {
  bank_account_id: UUID
  category: TransactionCategory
  type: TransactionType
  amount_cents: number // Must be positive
  description?: string
  transaction_date: ISODate
  project_id?: UUID
  invoice_id?: UUID
  supplier_id?: UUID
  stakeholder_id?: UUID
  budget_line_id?: UUID
  payment_status?: TransactionPaymentStatus
}

export interface TransactionUpdate {
  bank_account_id?: UUID
  category?: TransactionCategory
  type?: TransactionType
  amount_cents?: number
  description?: string
  transaction_date?: ISODate
  project_id?: UUID
  invoice_id?: UUID
  supplier_id?: UUID
  stakeholder_id?: UUID
  budget_line_id?: UUID
  payment_status?: TransactionPaymentStatus
  rejection_reason?: string
}

export interface TransactionOverviewStats {
  total_income_cents: number
  total_expense_cents: number
  net_income_cents: number
  total_budget_cents: number
  remaining_budget_cents: number
}

export interface TransactionStats {
  total_income_cents: number
  total_expense_cents: number
  net_balance_cents: number
  year: number
  month: number
}

// Helper function to get category display name
export function getCategoryDisplayName(category: TransactionCategory): string {
  const categoryNames: Record<TransactionCategory, string> = {
    crew_hire: 'Crew Hire',
    equipment_rental: 'Equipment Rental',
    logistics: 'Logistics',
    post_production: 'Post Production',
    maintenance: 'Maintenance',
    other: 'Other',
    production_revenue: 'Production Revenue',
    internal_transfer: 'Internal Transfer'
  }
  return categoryNames[category]
}

// Helper function to get income vs expense categories
export function getIncomeCategories(): TransactionCategory[] {
  return ['production_revenue', 'other']
}

/** @deprecated Use getIncomeCategories() */
export const getIncomCategories = getIncomeCategories

export function getExpenseCategories(): TransactionCategory[] {
  return ['crew_hire', 'equipment_rental', 'logistics', 'post_production', 'maintenance', 'other']
}

// ============================================================================
// TAX TABLE TYPES
// ============================================================================

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

// ============================================================================
// PRODUCTION TYPES
// ============================================================================

// Backend enums (lowercase values)
export type DayNight = 'day' | 'night' | 'dawn' | 'dusk'
export type InternalExternal = 'internal' | 'external'

export interface Scene {
  id: UUID
  organization_id: UUID
  project_id: UUID
  scene_number: number // Integer (gt=0) - NOT STRING
  heading: string // Required, min_length=1
  description: string // Required, min_length=1
  day_night: DayNight // Backend field name
  internal_external: InternalExternal // Backend field name
  estimated_time_minutes: number // Required (gt=0) - NOT NULLABLE
  shooting_day_id: UUID | null // Link to shooting day
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface SceneWithCharacters extends Scene {
  characters: Character[]
}

export interface Character {
  id: UUID
  organization_id: UUID
  project_id: UUID
  name: string // Required, min_length=1
  description: string // Required, min_length=1 (backend requires this!)
  actor_name: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface CharacterWithScenes extends Character {
  scenes: Scene[]
}

export type ShootingDayStatus = 'draft' | 'confirmed' | 'completed'

export interface ShootingDay {
  id: UUID
  organization_id: UUID
  project_id: UUID
  date: ISODate // Backend field name (YYYY-MM-DD)
  status: ShootingDayStatus
  call_time: TimeString // Backend field name (HH:MM:SS)
  on_set: TimeString | null
  lunch_time: TimeString | null
  wrap_time: TimeString | null // Backend field name (HH:MM:SS)
  location_name: string // Required, min_length=1
  location_address: string | null
  weather_forecast: string | null
  notes: string | null
  parking_info: string | null
  hospital_info: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
  project?: {
    id: UUID
    title: string
    client?: {
      id: UUID
      name: string
    }
  }
}

export interface ShootingDayWithScenes extends ShootingDay {
  scenes: Scene[]
}

export interface ProjectBreakdown {
  project_id: UUID
  project_title: string
  characters: Character[]
  scenes: SceneWithCharacters[]
  shooting_days: ShootingDayWithScenes[]
}

// ============================================================================
// SUPPLIER TYPES
// ============================================================================

export type SupplierCategory =
  | 'rental_house'
  | 'freelancer'
  | 'catering'
  | 'transport'
  | 'post_production'
  | 'other'

export interface Supplier {
  id: UUID
  organization_id: UUID
  name: string
  category: SupplierCategory
  document_id: string | null
  email: string | null
  phone: string | null
  address: string | null
  bank_info: Record<string, unknown> | null // JSONB
  specialties: string[] | null // Array of specialties
  notes: string | null
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface SupplierWithTransactions extends Supplier {
  total_transactions: number
  total_amount_cents: number
  last_transaction_date: ISODateTime | null
}

export interface SupplierStatement {
  supplier_id: UUID
  supplier_name: string
  supplier_category: string
  total_transactions: number
  total_amount_cents: number
  currency: string
  transactions: Record<string, unknown>[]
  project_breakdown: Record<string, unknown>[]
  category_breakdown: Record<string, unknown>[]
  statement_period: Record<string, string>
  generated_at: ISODateTime
}

export interface SupplierCreate {
  name: string
  category: SupplierCategory
  document_id?: string
  email?: string
  phone?: string
  address?: string
  bank_info?: Record<string, unknown>
  specialties?: string[]
  notes?: string
}

export interface SupplierUpdate {
  name?: string
  category?: SupplierCategory
  document_id?: string
  email?: string
  phone?: string
  address?: string
  bank_info?: Record<string, unknown>
  specialties?: string[]
  notes?: string
  is_active?: boolean
}

// Helper function to get supplier category display name
export function getSupplierCategoryDisplayName(category: SupplierCategory): string {
  const categoryNames: Record<SupplierCategory, string> = {
    rental_house: 'Rental House',
    freelancer: 'Freelancer',
    catering: 'Catering',
    transport: 'Transport',
    post_production: 'Post Production',
    other: 'Other'
  }
  return categoryNames[category]
}

// ============================================================================
// STAKEHOLDER TYPES (Project Team Members)
// ============================================================================

// Rate type for stakeholder payment calculation
export type RateType = 'daily' | 'hourly' | 'fixed'

// Booking status for stakeholder workflow
export type StakeholderStatus = 'requested' | 'confirmed' | 'working' | 'completed' | 'cancelled'

export interface Stakeholder {
  id: UUID
  organization_id: UUID
  project_id: UUID
  supplier_id: UUID | null
  name: string
  role: string
  email: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  // Rate management fields
  rate_type: RateType | null
  rate_value_cents: number | null
  estimated_units: number | null  // hours for hourly, days override for daily
  // Booking status fields
  status: StakeholderStatus
  status_changed_at: ISODateTime | null
  status_notes: string | null
  booking_start_date: ISODate | null
  booking_end_date: ISODate | null
  confirmed_rate_cents: number | null
  confirmed_rate_type: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface StakeholderCreate {
  project_id: UUID
  supplier_id?: UUID | null
  name: string
  role: string
  email?: string
  phone?: string
  notes?: string
  // Rate management fields
  rate_type?: RateType
  rate_value_cents?: number
  estimated_units?: number
}

export interface StakeholderUpdate {
  name?: string
  role?: string
  project_id?: UUID
  supplier_id?: UUID | null
  email?: string
  phone?: string
  notes?: string
  is_active?: boolean
  // Rate management fields
  rate_type?: RateType | null
  rate_value_cents?: number | null
  estimated_units?: number | null
}

// Rate calculation breakdown
export interface RateCalculationBreakdown {
  type: RateType
  rate_per_day_cents?: number
  rate_per_hour_cents?: number
  fixed_amount_cents?: number
  days?: number
  hours?: number
  source?: 'estimated_units' | 'shooting_days'
}

// Payment status for stakeholder
export type PaymentStatus = 'not_configured' | 'pending' | 'partial' | 'paid' | 'overpaid'

// Stakeholder with rate calculation and payment tracking
export interface StakeholderWithRateInfo extends Stakeholder {
  shooting_days_count: number
  suggested_amount_cents: number | null
  calculation_breakdown: RateCalculationBreakdown | null
  total_paid_cents: number
  pending_amount_cents: number | null
  payment_status: PaymentStatus
}

// ============================================================================
// PROPOSAL TYPES
// ============================================================================

export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'

export interface ProposalLineItem {
  id: string
  description: string
  value_cents: number
}

export interface ProposalMetadata {
  line_items?: ProposalLineItem[]
  [key: string]: any
}

export interface Proposal {
  id: UUID
  organization_id: UUID
  client_id: UUID
  project_id: UUID | null
  title: string
  description: string | null
  status: ProposalStatus
  valid_until: ISODate | null
  start_date: ISODate | null
  end_date: ISODate | null
  total_amount_cents: number | null
  base_amount_cents: number | null // Discount stored as negative cents
  currency: string
  terms_conditions: string | null
  proposal_metadata: ProposalMetadata | null
  created_at: ISODateTime
  updated_at: ISODateTime
  // Relationships (if loaded)
  client?: Client
  project?: Project
  services?: Service[]
}

export interface ProposalCreate {
  client_id: UUID
  project_id?: UUID
  title: string
  description?: string
  status?: ProposalStatus
  valid_until?: ISODate
  start_date?: ISODate
  end_date?: ISODate
  total_amount_cents?: number // Calculated
  base_amount_cents?: number // Discount stored as negative cents
  currency?: string

  terms_conditions?: string
  service_ids?: UUID[]
  proposal_metadata?: ProposalMetadata
}

export interface ProposalUpdate {
  client_id?: UUID
  project_id?: UUID
  title?: string
  description?: string
  status?: ProposalStatus
  valid_until?: ISODate
  start_date?: ISODate
  end_date?: ISODate
  total_amount_cents?: number
  base_amount_cents?: number
  currency?: string
  terms_conditions?: string
  service_ids?: UUID[]
  proposal_metadata?: ProposalMetadata
}

export interface ProposalApproval {
  notes?: string
}

// ============================================================================
// INVENTORY TYPES
// ============================================================================

export type HealthStatus = 'excellent' | 'good' | 'needs_service' | 'broken' | 'retired'
export type KitStatus = 'available' | 'in_use' | 'maintenance' | 'retired'

export interface Kit {
  id: UUID
  organization_id: UUID
  name: string
  description: string | null
  category: string | null
  status: KitStatus
  image_url: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface KitCreate {
  name: string
  description?: string
  category?: string
  status?: KitStatus
  image_url?: string
}

export interface KitUpdate {
  name?: string
  description?: string
  category?: string
  status?: KitStatus
}

export interface KitItem {
  id: UUID
  organization_id: UUID
  kit_id: UUID
  name: string
  description: string | null
  category: string
  serial_number: string | null
  purchase_date: ISODate | null
  purchase_cost_cents: number | null
  warranty_expiry: ISODate | null
  maintenance_interval_hours: number // default 50.0
  max_usage_hours: number // default 1000.0
  current_usage_hours: number
  last_maintenance_date: ISODate | null
  health_status: HealthStatus
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface KitItemCreate {
  kit_id: UUID
  name: string
  description?: string
  category: string
  serial_number?: string
  purchase_date?: ISODate
  purchase_cost_cents?: number
  warranty_expiry?: ISODate
  maintenance_interval_hours?: number
  max_usage_hours?: number
  notes?: string
}

export interface KitItemUpdate {
  name?: string
  description?: string
  category?: string
  serial_number?: string
  purchase_date?: ISODate
  purchase_cost_cents?: number
  warranty_expiry?: ISODate
  maintenance_interval_hours?: number
  max_usage_hours?: number
  current_usage_hours?: number
  last_maintenance_date?: ISODate
  health_status?: HealthStatus
  notes?: string
  kit_id?: UUID
}

export interface KitItemWithMaintenance extends KitItem {
  maintenance_count: number
  last_maintenance_type: string | null
  days_since_last_maintenance: number | null
  maintenance_overdue: boolean
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiError {
  message: string
  statusCode: number
  details?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ============================================================================
// FORM TYPES (Frontend Only - for HTML forms)
// ============================================================================

export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  full_name: string
  email: string
  password: string
  confirm_password: string
}

/**
 * Project Form Data
 * Note: client_id is required by backend
 */
export interface ProjectFormData {
  client_id: string // Required
  title: string
  description?: string
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  budget_total_cents: number
}

export interface ProjectCreate {
  client_id: UUID
  title: string
  description?: string
  status?: ProjectStatus
  budget_total_cents?: number
  start_date?: ISODate
  end_date?: ISODate
  service_ids?: UUID[]
  proposal_id?: UUID
}

export interface ProjectUpdate {
  client_id?: UUID
  title?: string
  description?: string
  status?: ProjectStatus
  budget_total_cents?: number
  start_date?: ISODate | null
  end_date?: ISODate | null
  service_ids?: UUID[]
  proposal_id?: UUID
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface Service {
  id: UUID
  organization_id: UUID
  name: string
  description: string | null
  value_cents: number
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ServiceCreate {
  name: string
  description?: string
  value_cents?: number
}

export interface ServiceUpdate {
  name?: string
  description?: string
  value_cents?: number
}

export interface ServiceEquipmentCreate {
  kit_id: UUID
  is_primary: boolean
  notes?: string
}

export interface ServiceEquipmentResponse {
  id: UUID
  service_id: UUID
  kit_id: UUID
  kit_name: string | null
  is_primary: boolean
  notes: string | null
  created_at: ISODateTime
}

/**
 * Call Sheet Form Data
 * Note: HTML time inputs provide HH:MM, must be converted to HH:MM:SS before sending to backend
 */
export interface CallSheetFormData {
  project_id: string // UUID of the project
  shooting_day: string // Will be converted to ISO date
  status?: CallSheetStatus

  // Location
  location: string
  location_address?: string
  parking_info?: string

  // Times (HTML inputs are HH:MM, convert to HH:MM:SS)
  crew_call?: string
  on_set?: string
  lunch_time?: string
  wrap_time?: string

  // Production
  weather?: string
  notes?: string
  hospital_info?: string
}

export interface CallSheetCreate {
  project_id: UUID
  shooting_day: ISODate
  status?: CallSheetStatus
  location?: string
  location_address?: string
  parking_info?: string
  crew_call?: TimeString
  on_set?: TimeString
  lunch_time?: TimeString
  wrap_time?: TimeString
  weather?: string
  notes?: string
  hospital_info?: string
}

export interface CallSheetUpdate {
  project_id?: UUID
  shooting_day?: ISODate
  status?: CallSheetStatus
  location?: string
  location_address?: string
  parking_info?: string
  crew_call?: TimeString
  on_set?: TimeString
  lunch_time?: TimeString
  wrap_time?: TimeString
  weather?: string
  notes?: string
  hospital_info?: string
}

/**
 * Scene Form Data
 * Note: Backend requires all fields, scene_number must be integer
 */
export interface SceneFormData {
  scene_number: number // Integer, gt=0
  heading: string
  description: string
  day_night: DayNight
  internal_external: InternalExternal
  estimated_time_minutes: number // Required, gt=0
  shooting_day_id?: string
}

export interface SceneCreate {
  scene_number: number
  heading: string
  description: string
  day_night: DayNight
  internal_external: InternalExternal
  estimated_time_minutes: number
  shooting_day_id?: UUID
}

export interface SceneUpdate {
  scene_number?: number
  heading?: string
  description?: string
  day_night?: DayNight
  internal_external?: InternalExternal
  estimated_time_minutes?: number
  shooting_day_id?: UUID
}

/**
 * Character Form Data
 * Note: Backend requires description field (min_length=1)
 */
export interface CharacterFormData {
  name: string
  description: string // Required!
  actor_name?: string
}

export interface CharacterCreate {
  name: string
  description: string
  actor_name?: string
  project_id: UUID
}

export interface CharacterUpdate {
  name?: string
  description?: string
  actor_name?: string
}

/**
 * Shooting Day Form Data
 */
export interface ShootingDayFormData {
  date: string // Will be converted to ISO date
  status?: ShootingDayStatus
  call_time: string // HTML time input HH:MM → convert to HH:MM:SS
  on_set?: string
  lunch_time?: string
  wrap_time?: string // HTML time input HH:MM → convert to HH:MM:SS
  location_name: string
  location_address?: string
  weather_forecast?: string
  notes?: string
  parking_info?: string
  hospital_info?: string
}

export interface ShootingDayCreate {
  project_id: UUID // Required by backend service
  date: ISODate
  status?: ShootingDayStatus
  call_time: TimeString
  on_set?: TimeString
  lunch_time?: TimeString
  wrap_time?: TimeString
  location_name: string
  location_address?: string
  weather_forecast?: string
  notes?: string
  parking_info?: string
  hospital_info?: string
}

export interface ShootingDayUpdate {
  date?: ISODate
  status?: ShootingDayStatus
  call_time?: TimeString
  on_set?: TimeString
  lunch_time?: TimeString
  wrap_time?: TimeString
  location_name?: string
  location_address?: string
  weather_forecast?: string
  notes?: string
  parking_info?: string
  hospital_info?: string
}

// Invoice creation types (already working correctly)
export interface InvoiceItemCreate {
  description: string
  quantity: number
  unit_price_cents: number // CENTS
  total_cents: number // CENTS (quantity * unit_price_cents)
  project_id?: string
  category?: string
}

export interface InvoiceCreate {
  client_id: string
  project_id?: string
  items: InvoiceItemCreate[]
  due_date: string
  description?: string
  notes?: string
  currency?: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Helper to convert HH:MM from HTML input to HH:MM:SS for backend
 */
export function convertTimeToBackendFormat(htmlTime: string): string {
  if (!htmlTime) return ''
  return htmlTime.includes(':00:00') ? htmlTime : `${htmlTime}:00`
}

/**
 * Helper to convert HH:MM:SS from backend to HH:MM for HTML input
 */
export function convertTimeToFormFormat(backendTime: string | null): string {
  if (!backendTime) return ''
  return backendTime.substring(0, 5) // Extract HH:MM from HH:MM:SS
}

// Currency helper functions already defined above in BankAccount section

// ============================================================================
// AI FEATURES TYPES
// ============================================================================

export type AiAnalysisType = 'full' | 'characters' | 'scenes' | 'locations'

export interface ScriptAnalysis {
  id: UUID
  organization_id: UUID
  project_id: UUID
  script_text: string
  analysis_result: {
    scenes?: Array<{
      scene_number: number
      description: string
      location: string
      time_of_day: string
      characters: string[]
    }>
    characters?: Array<{
      name: string
      description: string
    }>
    locations?: Array<{
      name: string
      description: string
    }>
    suggested_equipment?: Array<{
      item: string
      quantity: number
    }>
    production_notes?: string[]
    metadata?: Record<string, any>
  }
  analysis_type: AiAnalysisType
  confidence: number
  created_at: ISODateTime
}

export interface AiSuggestion {
  id: UUID
  organization_id: UUID
  project_id: UUID
  suggestion_type: 'budget' | 'schedule' | 'casting' | 'logistics' | 'equipment' | 'other'
  suggestion_text: string
  confidence: number
  priority: 'low' | 'medium' | 'high'
  related_scenes: number[]
  estimated_savings_cents?: number
  estimated_time_saved_minutes?: number
  created_at: ISODateTime
}

export interface AiRecommendation {
  id: UUID
  organization_id: UUID
  project_id: UUID
  recommendation_type: 'call_sheet' | 'budget' | 'schedule' | 'equipment'
  title: string
  description: string
  confidence: number
  priority: 'low' | 'medium' | 'high'
  action_items: string[]
  estimated_impact: {
    time_saved_minutes?: number
    cost_saved_cents?: number
    risk_reduction?: string
  }
  created_at: ISODateTime
}

export interface AiScriptAnalysisRequest {
  project_id: UUID
  analysis_type: AiAnalysisType
  script_content: string
}

export interface AiAnalysisResponse {
  analysis_id: UUID
  status: 'processing' | 'completed' | 'failed'
  result?: {
    characters: Array<{
      name: string
      description: string
      scenes_present: number[]
      importance: 'main' | 'secondary' | 'extra'
    }>
    locations: Array<{
      name: string
      description: string
      scenes: number[]
      day_night: 'day' | 'night' | 'interior'
      special_requirements: string[]
    }>
    scenes: Array<{
      number: number
      heading: string
      description: string
      characters: string[]
      estimated_time: string
      complexity: 'low' | 'medium' | 'high'
    }>
    suggested_equipment: Array<{
      category: string
      items: string[]
      reasoning: string
    }>
    production_notes: string[]
  }
  suggestions?: AiSuggestion[]
  recommendations?: AiRecommendation[]
  error?: string
}

export interface AiBudgetEstimation {
  project_id: UUID
  estimated_budget_cents: number
  breakdown: Array<{
    category: string
    estimated_amount_cents: number
    confidence: number
    notes: string
  }>
  risk_factors: string[]
  recommendations: string[]
  created_at: ISODateTime
}

export interface AiCallSheetSuggestion {
  day: number
  suggested_scenes: number[]
  crew_needed: string[]
  equipment_needed: string[]
  estimated_duration: string
  weather_considerations: string[]
  notes: string
}

// ============================================================================
// STORAGE & FILE TYPES
// ============================================================================

export interface FileUploadResponse {
  file_path: string
  bucket: string
  access_url: string | null
  is_public: boolean
  size_bytes: number
  content_type: string
}

export interface SignedUrlRequest {
  bucket: string
  file_path: string
  expires_in?: number // Default 3600 (1 hour)
}

export interface SignedUrlResponse {
  signed_url: string
  expires_in: number
  file_path: string
  bucket: string
}

export interface CloudSyncRequest {
  file_path: string
  providers?: string[] // ['google_drive', 'dropbox', etc.]
}

export interface CloudSyncResponse {
  file_path: string
  organization_id: string
  results: Record<string, unknown> // Provider-specific results
}

export interface SyncStatusResponse {
  file_path: string
  organization_id: string
  sync_status: string
  providers: string[]
  last_sync: string | null
}

// ============================================================================
// GOOGLE DRIVE & CLOUD SYNC TYPES
// ============================================================================

export interface GoogleDriveCredentials {
  id: UUID
  organization_id: UUID
  service_account_key: Record<string, unknown> | null
  auto_sync_enabled: boolean
  sync_on_proposal_approval: boolean
  sync_on_call_sheet_finalized: boolean
  root_folder_id: string | null
  root_folder_url: string | null
  connected_at: ISODateTime | null
  last_sync_at: ISODateTime | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface GoogleDriveCredentialsCreate {
  service_account_key: Record<string, unknown>
  auto_sync_enabled?: boolean
  sync_on_proposal_approval?: boolean
  sync_on_call_sheet_finalized?: boolean
}

export interface GoogleDriveCredentialsUpdate {
  service_account_key?: Record<string, unknown>
  auto_sync_enabled?: boolean
  sync_on_proposal_approval?: boolean
  sync_on_call_sheet_finalized?: boolean
}

export interface SyncFileRequest {
  file_id: UUID
  project_id: UUID
  module: string // proposals, call_sheets, scripts, media
}

export interface SyncResult {
  sync_id: string
  provider: string
  status: string // completed, failed, pending
  external_id: string | null
  external_url: string | null
  file_name: string | null
  file_size: number | null
  synced_at: string | null
  error: string | null
}

export interface ProjectSyncRequest {
  modules?: string[] // proposals, call_sheets, scripts, media
}

export interface ProjectSyncResult {
  project_id: string
  organization_id: string
  modules_synced: string[]
  sync_results: Record<string, unknown>[]
  total_files: number
  successful_syncs: number
  failed_syncs: number
}

export interface ProjectDriveFolder {
  id: UUID
  organization_id: UUID
  project_id: UUID
  project_folder_id: string | null
  project_folder_url: string | null
  scripts_folder_id: string | null
  scripts_folder_url: string | null
  call_sheets_folder_id: string | null
  call_sheets_folder_url: string | null
  media_folder_id: string | null
  media_folder_url: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

// ============================================================================
// ANALYTICS & DASHBOARD TYPES
// ============================================================================

export interface FinancialMetrics {
  month_to_date: {
    revenue_cents: number
    revenue_brl: number
    expenses_cents: number
    expenses_brl: number
    net_profit_cents: number
    net_profit_brl: number
    profit_margin: number
  }
  year_to_date: {
    revenue_cents: number
    revenue_brl: number
    expenses_cents: number
    expenses_brl: number
    net_profit_cents: number
    net_profit_brl: number
    profit_margin: number
  }
  cash_flow_projection_cents: number
  cash_flow_projection_brl: number
}

export interface ProductionMetrics {
  active_projects: number
  total_projects: number
  projects_by_status: Record<string, number>
  pending_call_sheets_this_week: number
  production_efficiency: {
    avg_project_duration_days: number
    on_time_delivery_rate: number
  }
}

export interface InventoryMetrics {
  total_items: number
  items_by_health: Record<string, number>
  items_needing_service: number
  maintenance_overdue: number
  equipment_utilization_rate: number
  maintenance_cost_cents: number
  maintenance_cost_brl: number
  inventory_health_score: number
}

export interface CloudMetrics {
  total_sync_operations: number
  successful_syncs: number
  failed_syncs: number
  sync_success_rate: number
  estimated_storage_used_gb: number
  recent_sync_activity_30_days: number
  cloud_health_status: 'healthy' | 'warning' | 'critical'
}

export interface MonthlyTrend {
  month: string
  revenue_cents: number
  expenses_cents: number
  net_profit_cents: number
}

export interface TrendsData {
  monthly_financial_trends: MonthlyTrend[]
  key_insights: string[]
}

export interface ExecutiveDashboard {
  organization_id: string
  generated_at: ISODateTime
  period: {
    start_date: string
    end_date: string
    months_analyzed: number
  }
  financial: FinancialMetrics
  production: ProductionMetrics
  inventory: InventoryMetrics
  cloud: CloudMetrics
  trends: TrendsData
}
