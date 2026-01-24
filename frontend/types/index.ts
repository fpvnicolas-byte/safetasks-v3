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

export interface Project {
  id: UUID
  organization_id: UUID
  client_id: UUID // REQUIRED - every project must have a client
  title: string
  description: string | null // Backend has this field
  status: ProjectStatus
  budget_total_cents: number // Integer (cents), default 0, min 0
  start_date: ISODate | null // YYYY-MM-DD
  end_date: ISODate | null // YYYY-MM-DD
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ProjectWithClient extends Project {
  client: Client // Client relationship when loaded
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
}

export interface CallSheetWithProject extends CallSheet {
  project: Project
}

// ============================================================================
// FINANCIAL TYPES
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'canceled'
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

// Helper functions for currency conversion
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function centsToDollars(cents: number): number {
  return cents / 100
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export type TransactionType = 'income' | 'expense'

export type TransactionCategory =
  | 'crew_hire'
  | 'equipment_rental'
  | 'logistics'
  | 'post_production'
  | 'maintenance'
  | 'other'
  | 'production_revenue'

export interface Transaction {
  id: UUID
  organization_id: UUID
  bank_account_id: UUID
  project_id: UUID | null
  supplier_id: UUID | null
  category: TransactionCategory
  type: TransactionType
  amount_cents: number // Integer (cents), must be positive
  description: string | null
  transaction_date: ISODate // YYYY-MM-DD
  created_at: ISODateTime
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
  supplier_id?: UUID
}

export interface TransactionUpdate {
  bank_account_id?: UUID
  category?: TransactionCategory
  type?: TransactionType
  amount_cents?: number
  description?: string
  transaction_date?: ISODate
  project_id?: UUID
  supplier_id?: UUID
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
    production_revenue: 'Production Revenue'
  }
  return categoryNames[category]
}

// Helper function to get income vs expense categories
export function getIncomCategories(): TransactionCategory[] {
  return ['production_revenue', 'other']
}

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

export interface ShootingDay {
  id: UUID
  organization_id: UUID
  project_id: UUID
  date: ISODate // Backend field name (YYYY-MM-DD)
  call_time: TimeString // Backend field name (HH:MM:SS)
  wrap_time: TimeString | null // Backend field name (HH:MM:SS)
  location_name: string // Required, min_length=1
  location_address: string | null
  weather_forecast: string | null
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
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
// API RESPONSE TYPES
// ============================================================================

export interface ApiError {
  message: string
  statusCode: number
  details?: Record<string, any>
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
}

export interface ProjectUpdate {
  client_id?: UUID
  title?: string
  description?: string
  status?: ProjectStatus
  budget_total_cents?: number
  start_date?: ISODate | null
  end_date?: ISODate | null
}

/**
 * Call Sheet Form Data
 * Note: HTML time inputs provide HH:MM, must be converted to HH:MM:SS before sending to backend
 */
export interface CallSheetFormData {
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
  call_time: string // HTML time input HH:MM → convert to HH:MM:SS
  wrap_time?: string // HTML time input HH:MM → convert to HH:MM:SS
  location_name: string
  location_address?: string
  weather_forecast?: string
  notes?: string
}

export interface ShootingDayCreate {
  date: ISODate
  call_time: TimeString
  wrap_time?: TimeString
  location_name: string
  location_address?: string
  weather_forecast?: string
  notes?: string
}

export interface ShootingDayUpdate {
  date?: ISODate
  call_time?: TimeString
  wrap_time?: TimeString
  location_name?: string
  location_address?: string
  weather_forecast?: string
  notes?: string
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
