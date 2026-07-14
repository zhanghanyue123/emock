import type { EntitlementFeature, PlanDefinition, PlanId, UserEntitlement } from "@/types/billing";

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Try the demo and keep a small local study record.",
    billingType: "free",
    priceAmount: 0,
    currency: "CNY",
    sortOrder: 1,
    isActive: true,
    entitlements: {
      canAccessFullTests: false,
      canImportOwnMaterials: false,
      canUseMistakeBook: true,
      canUseVocabulary: true,
      canExportVocabulary: false,
      canRecordSpeaking: false,
      canViewAdvancedAnalytics: false,
      maxActiveExams: 1,
      maxAttemptsPerMonth: 3
    }
  },
  {
    id: "personal_monthly",
    name: "Personal Monthly",
    description: "Full practice access for 30 days during private beta.",
    billingType: "one_time",
    billingInterval: "month",
    priceAmount: 4900,
    durationDays: 30,
    currency: "CNY",
    sortOrder: 2,
    isActive: true,
    entitlements: {
      canAccessFullTests: true,
      canImportOwnMaterials: true,
      canUseMistakeBook: true,
      canUseVocabulary: true,
      canExportVocabulary: true,
      canRecordSpeaking: true,
      canViewAdvancedAnalytics: false
    }
  },
  {
    id: "personal_quarterly",
    name: "Personal Quarterly",
    description: "Personal benefits for 90 days.",
    billingType: "one_time",
    billingInterval: "quarter",
    priceAmount: 19900,
    durationDays: 90,
    currency: "CNY",
    sortOrder: 3,
    isActive: true,
    entitlements: {
      canAccessFullTests: true,
      canImportOwnMaterials: true,
      canUseMistakeBook: true,
      canUseVocabulary: true,
      canExportVocabulary: true,
      canRecordSpeaking: true,
      canViewAdvancedAnalytics: false
    }
  },
  {
    id: "pro_monthly",
    name: "Pro Monthly",
    description: "Future AI writing and speaking feedback plan.",
    billingType: "subscription",
    billingInterval: "month",
    priceAmount: 9900,
    currency: "CNY",
    sortOrder: 4,
    isActive: false,
    hidden: true,
    entitlements: {
      canAccessFullTests: true,
      canImportOwnMaterials: true,
      canUseMistakeBook: true,
      canUseVocabulary: true,
      canExportVocabulary: true,
      canRecordSpeaking: true,
      canViewAdvancedAnalytics: true,
      aiCreditsPerMonth: 100
    }
  }
];

export function getPlan(planId: PlanId) {
  return PLAN_DEFINITIONS.find((plan) => plan.id === planId);
}

export function formatPlanPrice(plan: PlanDefinition) {
  if (plan.priceAmount === 0) return "¥0";
  return `¥${(plan.priceAmount / 100).toFixed(0)}`;
}

export function isEntitlementActive(entitlement?: UserEntitlement | null) {
  if (!entitlement) return false;
  if (!["active", "trialing"].includes(entitlement.status)) return false;
  return !entitlement.expiresAt || Date.parse(entitlement.expiresAt) > Date.now();
}

export function canAccessFeature(entitlement: UserEntitlement | null | undefined, feature: EntitlementFeature) {
  const activeEntitlement = isEntitlementActive(entitlement) ? entitlement : null;
  const plan = getPlan(activeEntitlement?.planId || "free");
  if (!plan) return false;
  const map: Record<EntitlementFeature, keyof typeof plan.entitlements> = {
    full_tests: "canAccessFullTests",
    import_own_materials: "canImportOwnMaterials",
    mistake_book: "canUseMistakeBook",
    vocabulary: "canUseVocabulary",
    export_vocabulary: "canExportVocabulary",
    record_speaking: "canRecordSpeaking",
    advanced_analytics: "canViewAdvancedAnalytics"
  };
  return Boolean(plan.entitlements[map[feature]]);
}
