import type { AgentConfig } from '../types';
import type { ProfileSchema } from '../types/profile';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

// ─── Banking V2 Profile Schema ─────────────────────────────────

const bankingProfileSchema: ProfileSchema = {
  title: 'User Profile Builder',
  depthLabels: [
    { maxPercent: 25, label: 'פרופיל בסיסי', color: 'rgba(239, 68, 68, 0.15)' },
    { maxPercent: 50, label: 'פרופיל פונקציונאלי', color: 'rgba(245, 158, 11, 0.15)' },
    { maxPercent: 75, label: 'פרופיל תובנות מוכן', color: 'rgba(37, 99, 235, 0.15)' },
    { maxPercent: 100, label: 'פרופיל פרסונליזציה מלא', color: 'rgba(16, 185, 129, 0.15)' },
  ],
  clusters: [
    // ── 1. Identity & Eligibility ───────────────────────────────
    {
      id: 'identity',
      name: 'זהות וזכאות',
      icon: '🪪',
      displayMode: 'fields',
      fields: [
        { key: 'name', label: 'שם', source: 'context:user:onboarding_profile.name', badge: 'user' },
        { key: 'age', label: 'גיל', source: 'context:user:onboarding_profile.age', badge: 'user' },
        { key: 'city', label: 'עיר מגורים', source: 'context:conv:advisor_state.city', badge: 'user' },
        { key: 'eligibility_status', label: 'סטטוס זכאות', source: 'context:conv:advisor_state.eligibilityStatus', badge: 'system', isInsight: true },
        { key: 'account_type', label: 'סוג החשבון', source: 'context:user:onboarding_profile.accountType', badge: 'user' },
        { key: 'kyc_status', label: 'סטטוס KYC', source: 'context:conv:closing_state.kycStatus', badge: 'system', isInsight: true },
      ],
    },

    // ── 2. Financial Status ─────────────────────────────────────
    {
      id: 'financial',
      name: 'מצב פיננסי',
      icon: '💰',
      displayMode: 'fields',
      fields: [
        { key: 'employment_status', label: 'סטטוס תעסוקה', source: 'context:conv:advisor_state.employment', badge: 'user' },
        { key: 'occupation', label: 'עיסוק', source: 'context:conv:advisor_state.occupation', badge: 'user' },
        { key: 'income_range', label: 'טווח הכנסה', source: 'context:conv:advisor_state.incomeRange', badge: 'user' },
        { key: 'income_stability', label: 'יציבות הכנסה', source: 'context:conv:advisor_state.incomeStability', badge: 'system', isInsight: true },
        { key: 'income_frequency', label: 'תדירות הכנסה', source: 'context:conv:advisor_state.incomeFrequency', badge: 'system', isInsight: true },
        { key: 'income_sources', label: 'מספר מקורות הכנסה', source: 'context:conv:advisor_state.incomeSources', badge: 'user' },
        { key: 'expected_credit_usage', label: 'שימוש במסגרת אשראי צפויה', source: 'context:conv:advisor_state.expectedCreditUsage', badge: 'system', isInsight: true },
        { key: 'financial_commitments', label: 'התחייבויות פיננסיות קיימות', source: 'context:conv:advisor_state.financialCommitments', badge: 'user' },
        { key: 'cashflow_indicator', label: 'אינדיקטור יציבות תזרים', source: 'context:conv:advisor_state.cashflowIndicator', badge: 'system', isInsight: true },
        { key: 'first_bank_account', label: 'חשבון בנק ראשון', source: 'context:conv:advisor_state.firstBankAccount', badge: 'user' },
        { key: 'num_bank_accounts', label: 'מספר חשבונות בנק', source: 'context:conv:advisor_state.numBankAccounts', badge: 'user' },
        { key: 'main_bank', label: 'חשבון בנק מרכזי', source: 'context:conv:advisor_state.mainBank', badge: 'user' },
        { key: 'user_group', label: 'קבוצה', source: 'context:conv:advisor_state.userType', badge: 'system', isInsight: true },
      ],
    },

    // ── 3. Behavior & Intent Analysis ───────────────────────────
    {
      id: 'behavior',
      name: 'התנהגות וניתוח כוונות',
      icon: '🧠',
      displayMode: 'fields',
      fields: [
        { key: 'primary_goal', label: 'מטרה מרכזית', source: 'context:conv:advisor_state.userIntent', badge: 'system', isInsight: true },
        { key: 'banking_literacy', label: 'רמת אורינות בנקאית', source: 'context:conv:advisor_state.bankingLiteracy', badge: 'system', isInsight: true },
        { key: 'fee_sensitivity', label: 'רגישות לעמלות ומחיר', source: 'context:conv:advisor_state.feeSensitivity', badge: 'system', isInsight: true },
        { key: 'decision_speed', label: 'מהירות קבלת החלטה', source: 'context:conv:advisor_state.decisionSpeed', badge: 'system', isInsight: true },
        { key: 'digital_maturity', label: 'בשלות ועצמאות דיגיטלית', source: 'context:conv:advisor_state.digitalMaturity', badge: 'system', isInsight: true },
        { key: 'risk_sensitivity', label: 'רגישות לסיכון פיננסי', source: 'context:conv:advisor_state.riskSensitivity', badge: 'system', isInsight: true },
        { key: 'negotiation_tendency', label: 'נטייה למו"מ', source: 'context:conv:advisor_state.negotiationTendency', badge: 'system', isInsight: true },
      ],
    },

    // ── 4. Personal Context & Preferences (Tags mode) ──────────
    {
      id: 'personal_context',
      name: 'הקשר אישי והעדפות',
      icon: '🏷️',
      displayMode: 'tags',
      fields: [
        { key: 'financial_life_stage', label: 'שלב חיים פיננסי', source: 'context:conv:advisor_state.financialLifeStage', badge: 'system', isInsight: true },
        { key: 'banking_experience', label: 'רמת ניסיון בנקאי', source: 'context:conv:advisor_state.bankingExperience', badge: 'system', isInsight: true },
        { key: 'decision_pattern', label: 'דפוס קבלת החלטות', source: 'context:conv:advisor_state.decisionPattern', badge: 'system', isInsight: true },
        { key: 'cost_sensitivity', label: 'רגישות לעלויות', source: 'context:conv:advisor_state.costSensitivity', badge: 'system', isInsight: true },
        { key: 'financial_confidence', label: 'רמת ביטחון בניהול פיננסי', source: 'context:conv:advisor_state.financialConfidence', badge: 'system', isInsight: true },
        { key: 'identified_need', label: 'צורך מרכזי שזוהה', source: 'context:conv:advisor_state.identifiedNeed', badge: 'system', isInsight: true },
      ],
    },

    // ── 5. Account Opening Progress ─────────────────────────────
    {
      id: 'account_progress',
      name: 'התקדמות פתיחת חשבון',
      icon: '📊',
      displayMode: 'fields',
      fields: [
        { key: 'account_status', label: 'מצב פתיחת חשבון', source: 'context:conv:closing_state.accountStatus', badge: 'system', isInsight: true },
        { key: 'last_journey_step', label: 'שלב אחרון במסע', source: 'context:conv:closing_state.currentStep', badge: 'system', isInsight: true },
        { key: 'completion_percent', label: 'אחוז השלמת התהליך', source: 'context:conv:closing_state.completionPercent', badge: 'system', isInsight: true },
        { key: 'main_blockers', label: 'חסמים מרכזיים שזוהו', source: 'context:conv:advisor_state.mainBlockers', badge: 'system', isInsight: true },
        { key: 'churn_risk', label: 'רמת סיכון לנטישה', source: 'context:conv:advisor_state.churnRisk', badge: 'system', isInsight: true },
        { key: 'return_potential', label: 'פוטנציאל חזרה לתהליך', source: 'context:conv:advisor_state.returnPotential', badge: 'system', isInsight: true },
        { key: 'proactive_touch_needed', label: 'האם נדרש מגע יזום', source: 'context:conv:advisor_state.proactiveTouchNeeded', badge: 'system', isInsight: true },
        { key: 'commitment_readiness', label: 'רמת נכונות להתחייבות', source: 'context:conv:advisor_state.commitmentReadiness', badge: 'system', isInsight: true },
        { key: 'terms_acceptance_likelihood', label: 'סבירות קבלת תנאים', source: 'context:conv:advisor_state.termsAcceptanceLikelihood', badge: 'system', isInsight: true },
        { key: 'recommended_action', label: 'פעולה מומלצת להמשך', source: 'context:conv:advisor_state.recommendedAction', badge: 'system', isInsight: true },
      ],
    },

    // ── 6. Recommendations ──────────────────────────────────────
    {
      id: 'recommendations',
      name: 'המלצות להמשך',
      icon: '💡',
      displayMode: 'tags',
      fields: [
        { key: 'recommended_offer', label: 'חבילה מומלצת', source: 'context:conv:advisor_state.recommendedOffer', badge: 'system', isInsight: true },
        { key: 'credit_card_offer', label: 'הצעת כרטיס אשראי', source: 'context:conv:advisor_state.cardOffered', badge: 'system', isInsight: true },
        { key: 'credit_frame_offer', label: 'הצעת מסגרת אשראי', source: 'context:conv:advisor_state.creditFrameOffer', badge: 'system', isInsight: true },
        { key: 'deposit_offer', label: 'פתיחת פיקדון', source: 'context:conv:advisor_state.depositOffer', badge: 'system', isInsight: true },
        { key: 'standing_orders', label: 'הצעת הוראות קבע', source: 'context:conv:advisor_state.standingOrdersOffer', badge: 'system', isInsight: true },
        { key: 'expense_tools', label: 'כלי ניהול הוצאות', source: 'context:conv:advisor_state.expenseToolsOffer', badge: 'system', isInsight: true },
      ],
    },

    // ── 7. Profile Summary ──────────────────────────────────────
    {
      id: 'summary',
      name: 'סיכום פרופיל',
      icon: '📋',
      displayMode: 'fields',
      fields: [
        { key: 'general_overview', label: 'תמונת מצב כללי', source: 'context:conv:advisor_state.generalOverview', badge: 'system', isInsight: true },
        { key: 'key_profile_traits', label: 'מאפייני פרופיל מרכזיים', source: 'context:conv:advisor_state.keyProfileTraits', badge: 'system', isInsight: true },
        { key: 'potential_index', label: 'אינדקציית פוטנציאל', source: 'context:conv:advisor_state.potentialIndex', badge: 'system', isInsight: true },
        { key: 'focused_recommendation', label: 'המלצת פעולה ממוקדת', source: 'context:conv:advisor_state.focusedRecommendation', badge: 'system', isInsight: true },
      ],
    },
  ],
};

// ─── Agent Config ───────────────────────────────────────────────

export const bankingOnboarderV2Config: AgentConfig = {
  agentName: 'Banking Onboarder V2',
  displayName: 'מערכת פתיחת חשבון V2',
  storagePrefix: 'banking_onboarder_v2_',
  baseURL: BASE_URL,

  pageTitle: 'פתיחת חשבון',
  favicon: '/img/lybi-logo-transparent.png',
  metaDescription: 'פתיחת חשבון בנק עם עוזר חכם המונע בינה מלאכותית.',

  logo: {
    src: '/img/lybi-logo-transparent.png',
    alt: 'ליבי',
  },
  headerTitle: 'פתיחת חשבון',
  headerSubtitle: '',
  welcomeIcon: '/img/lybi-logo-transparent.png',
  welcomeTitle: 'ברוכים הבאים',
  welcomeMessage: 'אני כאן כדי לעזור לך למצוא את החשבון המושלם עבורך.',
  inputPlaceholder: 'הקלד את תשובתך...',

  quickQuestions: [
    { icon: '🏦', textKey: 'quick.banking.startOnboarding.text', questionKey: 'quick.banking.startOnboarding.question' },
    { icon: '❓', textKey: 'quick.banking.howItWorks.text', questionKey: 'quick.banking.howItWorks.question' },
    { icon: '💡', textKey: 'quick.banking.whichAccount.text', questionKey: 'quick.banking.whichAccount.question' },
  ],

  thinkingSteps: [
    [
      'Processing your information...',
      'Analyzing your profile...',
      'Preparing recommendation...',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
    showFullJourney: true,
  },

  themeClass: 'theme-banking-onboarder',

  profileSchema: bankingProfileSchema,
};
