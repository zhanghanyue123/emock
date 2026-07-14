export type UserRole = "student" | "teacher" | "admin";

export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface SignUpInput {
  email: string;
  displayName?: string;
}

export interface SignInInput {
  email: string;
}

export interface AuthResult {
  user: AppUser;
  sessionId: string;
}

export type PlanId = "free" | "personal_monthly" | "personal_quarterly" | "pro_monthly";

export interface EntitlementDefinition {
  canAccessFullTests: boolean;
  canImportOwnMaterials: boolean;
  canUseMistakeBook: boolean;
  canUseVocabulary: boolean;
  canExportVocabulary: boolean;
  canRecordSpeaking: boolean;
  canViewAdvancedAnalytics: boolean;
  maxActiveExams?: number;
  maxAttemptsPerMonth?: number;
  maxStorageBytes?: number;
  aiCreditsPerMonth?: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  billingType: "free" | "one_time" | "subscription";
  billingInterval?: "month" | "quarter" | "year";
  priceAmount: number;
  durationDays?: number;
  currency: string;
  entitlements: EntitlementDefinition;
  isActive: boolean;
  sortOrder: number;
  hidden?: boolean;
}

export interface UserEntitlement {
  userId: string;
  planId: PlanId;
  status: "active" | "trialing" | "past_due" | "canceled" | "expired";
  startsAt: string;
  expiresAt?: string;
  source: "free" | "purchase" | "subscription" | "admin" | "promotion";
  provider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
}

export interface Order {
  id: string;
  userId: string;
  planId: PlanId;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "canceled" | "refunded" | "expired";
  provider: string;
  providerMode?: "sandbox" | "production";
  providerStatus?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  idempotencyKey?: string;
  createdAt: string;
  paidAt?: string;
  canceledAt?: string;
  refundedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentEventRecord {
  id: string;
  provider: string;
  providerEventId: string;
  orderId: string;
  type: string;
  tradeNo?: string;
  tradeStatus?: string;
  verified?: boolean;
  processed?: boolean;
  processedAt?: string;
  failureReason?: string;
  receivedAt: string;
  raw: Record<string, unknown>;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  userId: string;
  provider: string;
  providerRefundId?: string;
  amount: number;
  currency: string;
  status: "requested" | "succeeded" | "failed";
  reason?: string;
  requestedAt: string;
  processedAt?: string;
  failureReason?: string;
  raw?: Record<string, unknown>;
}

export interface ReconciliationRecord {
  id: string;
  orderId: string;
  provider: string;
  action: "query" | "close" | "refund" | "notify";
  providerStatus?: string;
  matched: boolean;
  createdAt: string;
  raw?: Record<string, unknown>;
  note?: string;
}

export interface AccountDataSnapshot {
  userId: string;
  updatedAt: string;
  storage: Record<string, unknown>;
}

export type EntitlementFeature =
  | "full_tests"
  | "import_own_materials"
  | "mistake_book"
  | "vocabulary"
  | "export_vocabulary"
  | "record_speaking"
  | "advanced_analytics";
