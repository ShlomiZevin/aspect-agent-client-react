/**
 * Feedback Service
 *
 * Currently returns mock data. Ready to wire to server endpoints.
 * Replace mock functions with real API calls when backend is ready.
 */

import type { FeedbackMessage, FeedbackTag, FeedbackStats, TagAggregation, CrewAggregation } from '../types/feedback';

// ─── Tag helpers (used for mock data only) ───────────────────────────

const TAG_PALETTE: FeedbackTag[] = [
  { name: 'Helpful', color: '#10b981' },
  { name: 'Accurate', color: '#3b82f6' },
  { name: 'Inaccurate', color: '#ef4444' },
  { name: 'Off-topic', color: '#f59e0b' },
  { name: 'Too verbose', color: '#8b5cf6' },
  { name: 'Incomplete', color: '#f97316' },
  { name: 'Great tone', color: '#06b6d4' },
  { name: 'Needs review', color: '#ec4899' },
  { name: 'KB miss', color: '#64748b' },
  { name: 'Wrong crew', color: '#dc2626' },
];

function tag(name: string): FeedbackTag {
  return TAG_PALETTE.find(t => t.name === name)!;
}

// ─── Mock Data ──────────────────────────────────────────────────────

const MOCK_FEEDBACK: FeedbackMessage[] = [
  {
    id: 'fb-001',
    assistantMessageId: 'msg-a-101',
    userMessageId: 'msg-u-101',
    userMessage: 'What are the most common symptoms of perimenopause?',
    messageContent: 'The most common symptoms of perimenopause include hot flashes, night sweats, irregular periods, mood changes, sleep disturbances, and vaginal dryness. Many women also experience brain fog, joint pain, and changes in libido. These symptoms occur due to fluctuating oestrogen levels and can begin several years before menopause.',
    feedbackText: 'Comprehensive and accurate answer. Covered all major symptoms well.',
    tags: [tag('Helpful'), tag('Accurate')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-15T10:30:00'),
  },
  {
    id: 'fb-002',
    assistantMessageId: 'msg-a-102',
    userMessageId: 'msg-u-102',
    userMessage: 'Is HRT safe for me? I\'m 52 with no family history of breast cancer.',
    messageContent: 'HRT is generally considered safe for most women, especially when started within 10 years of menopause. Given you have no family history of breast cancer, the benefits often outweigh the risks. However, I\'d recommend discussing with your GP for personalized advice.',
    feedbackText: 'Good response but should have mentioned specific HRT types and their different risk profiles.',
    tags: [tag('Incomplete'), tag('Needs review')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-16T14:20:00'),
  },
  {
    id: 'fb-003',
    assistantMessageId: 'msg-a-103',
    userMessageId: 'msg-u-103',
    userMessage: 'I can\'t sleep at night because of hot flashes. What can I do?',
    messageContent: 'I understand how frustrating that must be. Here are some practical tips: keep your bedroom cool (around 18°C), use moisture-wicking sleepwear, try layered bedding you can adjust, avoid caffeine and alcohol before bed, and consider a cooling pillow. If the hot flashes are severe, HRT can be very effective at reducing them.',
    feedbackText: 'Perfect empathetic tone combined with actionable advice. This is exactly how Freeda should respond.',
    tags: [tag('Helpful'), tag('Great tone'), tag('Accurate')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-17T09:15:00'),
  },
  {
    id: 'fb-004',
    assistantMessageId: 'msg-a-104',
    userMessageId: 'msg-u-104',
    userMessage: 'Can you tell me about my blood test results?',
    messageContent: 'I\'d be happy to help you understand your blood test results! Could you share the specific values you\'d like me to look at? Common menopause-related tests include FSH, LH, oestradiol, and thyroid function.',
    feedbackText: 'Should not offer to interpret blood tests - this is medical advice territory. Needs guardrail.',
    tags: [tag('Inaccurate'), tag('Needs review')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-18T11:45:00'),
  },
  {
    id: 'fb-005',
    assistantMessageId: 'msg-a-105',
    userMessageId: 'msg-u-105',
    userMessage: 'Hi, my name is Sarah and I\'m 48',
    messageContent: 'Hello Sarah! Welcome to Freeda. I\'m so glad you\'re here. At 48, you may be approaching or already experiencing perimenopause. I\'m here to support you with information, tips, and a friendly ear. What would you like to know about?',
    feedbackText: 'Warm welcome, good use of name. Natural transition to the general crew happened correctly.',
    tags: [tag('Great tone'), tag('Helpful')],
    crewMember: 'Freeda Welcome',
    createdAt: new Date('2025-12-19T08:00:00'),
  },
  {
    id: 'fb-006',
    assistantMessageId: 'msg-a-106',
    userMessageId: 'msg-u-106',
    userMessage: 'What exercises are good for menopause?',
    messageContent: 'Great question! Weight-bearing exercises like walking, jogging, and resistance training are excellent during menopause as they help maintain bone density. Yoga and pilates can help with flexibility, balance, and stress management. Swimming is gentle on joints. Aim for at least 150 minutes of moderate activity per week.',
    feedbackText: 'Solid advice but didn\'t mention that the user should check with their doctor before starting a new exercise regime.',
    tags: [tag('Incomplete')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-20T16:30:00'),
  },
  {
    id: 'fb-007',
    assistantMessageId: 'msg-a-107',
    userMessageId: 'msg-u-107',
    userMessage: 'Are there foods that help with hot flashes?',
    messageContent: 'Research suggests that phytoestrogen-rich foods may help some women. These include soy products (tofu, edamame), flaxseeds, and legumes. Reducing spicy foods, caffeine, and alcohol can also help as these are common triggers. Staying hydrated is important too.',
    feedbackText: 'Did not reference the knowledge base article on nutrition. The KB has a detailed guide.',
    tags: [tag('KB miss'), tag('Incomplete')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-21T13:10:00'),
  },
  {
    id: 'fb-008',
    assistantMessageId: 'msg-a-108',
    userMessageId: 'msg-u-108',
    userMessage: 'I\'ve been feeling really anxious lately, is this related to menopause?',
    messageContent: 'Yes, anxiety can absolutely be linked to menopause. Fluctuating oestrogen and progesterone levels affect neurotransmitters like serotonin, which regulate mood. This is very common and you\'re not alone. CBT (Cognitive Behavioural Therapy), regular exercise, and in some cases HRT or SSRIs can help. Would you like to explore any of these options?',
    feedbackText: 'Excellent response. Validated the user\'s experience, explained the science simply, and offered multiple paths forward.',
    tags: [tag('Helpful'), tag('Accurate'), tag('Great tone')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-22T10:55:00'),
  },
  {
    id: 'fb-011',
    assistantMessageId: 'msg-a-111',
    userMessageId: 'msg-u-111',
    userMessage: 'Hello!',
    messageContent: 'Hello! Welcome to Freeda. I\'m here to help you with anything related to menopause and women\'s wellness. Before we start, could you share your name and age so I can personalise our conversation?',
    feedbackText: 'Welcome crew handled well but the question about age felt a bit abrupt. Could be softer.',
    tags: [tag('Needs review'), tag('Great tone')],
    crewMember: 'Freeda Welcome',
    createdAt: new Date('2025-12-25T12:00:00'),
  },
  {
    id: 'fb-012',
    assistantMessageId: 'msg-a-112',
    userMessageId: 'msg-u-112',
    userMessage: 'What supplements should I take?',
    messageContent: 'While I can share general information about supplements commonly discussed in relation to menopause, such as vitamin D, calcium, magnesium, and omega-3 fatty acids, I\'d strongly recommend speaking with your GP or a qualified nutritionist before starting any supplement regime. They can assess your individual needs based on your health profile.',
    feedbackText: 'Good guardrail - correctly deferred to medical professional. This is the right approach.',
    tags: [tag('Helpful'), tag('Accurate')],
    crewMember: 'Freeda General',
    createdAt: new Date('2025-12-26T14:30:00'),
  },
];

// ─── Service Functions ──────────────────────────────────────────────

/**
 * Get all feedback messages for an agent.
 * TODO: Replace with real API call: GET /api/agents/:agentName/feedback
 */
export async function getFeedbackMessages(
  _agentName: string,
  _baseURL: string
): Promise<FeedbackMessage[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return [...MOCK_FEEDBACK].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get feedback stats/aggregations for an agent.
 * TODO: Replace with real API call: GET /api/agents/:agentName/feedback/stats
 */
export async function getFeedbackStats(
  _agentName: string,
  _baseURL: string
): Promise<FeedbackStats> {
  await new Promise(resolve => setTimeout(resolve, 200));

  // Tag aggregations
  const tagCounts = new Map<string, { tag: FeedbackTag; count: number }>();
  for (const fb of MOCK_FEEDBACK) {
    for (const t of fb.tags) {
      const existing = tagCounts.get(t.name);
      if (existing) {
        existing.count++;
      } else {
        tagCounts.set(t.name, { tag: t, count: 1 });
      }
    }
  }

  const tagAggregations: TagAggregation[] = [...tagCounts.values()]
    .sort((a, b) => b.count - a.count);

  // Crew aggregations
  const crewCounts = new Map<string, number>();
  for (const fb of MOCK_FEEDBACK) {
    if (!fb.crewMember) continue;
    const crew = fb.crewMember;
    crewCounts.set(crew, (crewCounts.get(crew) ?? 0) + 1);
  }

  const crewAggregations: CrewAggregation[] = [...crewCounts.entries()]
    .map(([crewMember, count]) => ({ crewMember, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalFeedback: MOCK_FEEDBACK.length,
    tagAggregations,
    crewAggregations,
  };
}
