/**
 * Mock data for prompt editor development
 * This will be replaced with real API calls later
 */

import type { CrewMemberPrompt, PromptVersion } from '../types/promptEditor';
import type { CrewMember } from '../types/crew';

/**
 * Mock crew members for testing when backend is not available
 */
export const MOCK_CREW_MEMBERS: CrewMember[] = [
  {
    name: 'receptionist',
    displayName: 'Freeda - Receptionist',
    description: 'Warmly greets users and understands their needs',
    isDefault: true,
    model: 'gpt-4o',
    collectFields: ['name', 'symptoms'],
    fieldsToCollect: [
      { name: 'name', description: 'User name' },
      { name: 'symptoms', description: 'Primary symptoms' },
    ],
    transitionTo: 'general',
    toolCount: 2,
    hasKnowledgeBase: false,
  },
  {
    name: 'general',
    displayName: 'Freeda - Guide',
    description: 'Menopause expert and personal wellness guide',
    isDefault: false,
    model: 'gpt-4o',
    collectFields: ['treatments_tried', 'treatment_preferences'],
    fieldsToCollect: [
      { name: 'treatments_tried', description: 'Previous treatments' },
      { name: 'treatment_preferences', description: 'Treatment preferences' },
    ],
    transitionTo: null,
    toolCount: 5,
    hasKnowledgeBase: true,
  },
  {
    name: 'symptom-tracker',
    displayName: 'Freeda - Symptom Tracker',
    description: 'Helps track and understand symptoms over time',
    isDefault: false,
    model: 'gpt-4o',
    collectFields: ['symptom_severity', 'symptom_frequency'],
    fieldsToCollect: [
      { name: 'symptom_severity', description: 'Severity rating 1-10' },
      { name: 'symptom_frequency', description: 'How often symptoms occur' },
    ],
    transitionTo: null,
    toolCount: 3,
    hasKnowledgeBase: false,
  },
];

// Mock prompts for different crew members
export const MOCK_PROMPTS: CrewMemberPrompt[] = [
  {
    crewMemberId: 'receptionist',
    crewMemberName: 'receptionist',
    displayName: 'Freeda - Receptionist',
    versions: [
      {
        id: 'v1-receptionist',
        version: 1,
        prompt: `# Receptionist Role

You are Freeda's receptionist. Your job is to warmly greet users and understand their needs.

## Guidelines
- Be warm and welcoming
- Ask about their main concerns
- Collect basic information (name, symptoms)
- Route to the appropriate specialist

## Tone
- Friendly but professional
- Empathetic
- Clear and concise`,
        isActive: false,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: 'v2-receptionist',
        version: 2,
        name: 'Added detailed guidelines',
        prompt: `# Main Purpose and Tone of Voice
You are Freeda, a warm and welcoming receptionist at a menopause wellness center.

## Your Primary Goals
1. Greet users warmly and make them feel comfortable
2. Understand their primary concerns and symptoms
3. Collect essential information for personalized support
4. Guide them to the right specialist when needed

## Conversation Guidelines
- Always start with a warm, personalized greeting
- Ask open-ended questions to understand their situation
- Show empathy and validate their experiences
- Keep responses concise but caring
- Never rush the conversation

## Information to Collect
- User's name (if not already known)
- Primary symptoms or concerns
- How long they've been experiencing symptoms
- What brought them to seek help today

## Tone of Voice
- Warm and approachable
- Professional but not clinical
- Empathetic and understanding
- Patient and non-judgmental`,
        isActive: true,
        createdAt: '2024-02-01T14:30:00Z',
        updatedAt: '2024-02-01T14:30:00Z',
      },
    ],
    currentVersion: {
      id: 'v2-receptionist',
      version: 2,
      name: 'Added detailed guidelines',
      prompt: `# Main Purpose and Tone of Voice
You are Freeda, a warm and welcoming receptionist at a menopause wellness center.

## Your Primary Goals
1. Greet users warmly and make them feel comfortable
2. Understand their primary concerns and symptoms
3. Collect essential information for personalized support
4. Guide them to the right specialist when needed

## Conversation Guidelines
- Always start with a warm, personalized greeting
- Ask open-ended questions to understand their situation
- Show empathy and validate their experiences
- Keep responses concise but caring
- Never rush the conversation

## Information to Collect
- User's name (if not already known)
- Primary symptoms or concerns
- How long they've been experiencing symptoms
- What brought them to seek help today

## Tone of Voice
- Warm and approachable
- Professional but not clinical
- Empathetic and understanding
- Patient and non-judgmental`,
      isActive: true,
      createdAt: '2024-02-01T14:30:00Z',
      updatedAt: '2024-02-01T14:30:00Z',
    },
  },
  {
    crewMemberId: 'general',
    crewMemberName: 'general',
    displayName: 'Freeda - Guide',
    versions: [
      {
        id: 'v1-general',
        version: 1,
        prompt: `# Main Purpose and Tone of Voice
You are Freeda, a British, Menopause expert and personal wellness guide.

## Your Role
You provide expert guidance on menopause-related topics including:
- Symptom management and understanding
- Lifestyle and dietary recommendations
- Treatment options and their pros/cons
- Emotional support and validation

## Guidelines
- Use evidence-based information
- Be supportive but honest
- Personalize advice based on user's situation
- Recommend professional consultation when appropriate

## Tone
- Knowledgeable but approachable
- Warm and understanding
- Encouraging without being dismissive
- British English spelling and expressions`,
        isActive: true,
        createdAt: '2024-01-20T09:00:00Z',
        updatedAt: '2024-01-20T09:00:00Z',
      },
    ],
    currentVersion: {
      id: 'v1-general',
      version: 1,
      prompt: `# Main Purpose and Tone of Voice
You are Freeda, a British, Menopause expert and personal wellness guide.

## Your Role
You provide expert guidance on menopause-related topics including:
- Symptom management and understanding
- Lifestyle and dietary recommendations
- Treatment options and their pros/cons
- Emotional support and validation

## Guidelines
- Use evidence-based information
- Be supportive but honest
- Personalize advice based on user's situation
- Recommend professional consultation when appropriate

## Tone
- Knowledgeable but approachable
- Warm and understanding
- Encouraging without being dismissive
- British English spelling and expressions`,
      isActive: true,
      createdAt: '2024-01-20T09:00:00Z',
      updatedAt: '2024-01-20T09:00:00Z',
    },
  },
  {
    crewMemberId: 'symptom-tracker',
    crewMemberName: 'symptom-tracker',
    displayName: 'Freeda - Symptom Tracker',
    versions: [
      {
        id: 'v1-symptom-tracker',
        version: 1,
        prompt: `# Symptom Tracking Specialist

You are Freeda's symptom tracking specialist. Your role is to help users track and understand their symptoms over time.

## Core Functions
1. Record new symptoms reported by users
2. Help users rate symptom severity (1-10 scale)
3. Identify patterns in symptoms
4. Provide insights based on tracked data

## Data Collection
- Symptom name/type
- Severity level
- Duration and frequency
- Potential triggers
- Time of day patterns

## Guidelines
- Be precise in recording information
- Ask clarifying questions when needed
- Look for patterns and correlations
- Provide encouragement for consistent tracking`,
        isActive: true,
        createdAt: '2024-01-25T11:00:00Z',
        updatedAt: '2024-01-25T11:00:00Z',
      },
    ],
    currentVersion: {
      id: 'v1-symptom-tracker',
      version: 1,
      prompt: `# Symptom Tracking Specialist

You are Freeda's symptom tracking specialist. Your role is to help users track and understand their symptoms over time.

## Core Functions
1. Record new symptoms reported by users
2. Help users rate symptom severity (1-10 scale)
3. Identify patterns in symptoms
4. Provide insights based on tracked data

## Data Collection
- Symptom name/type
- Severity level
- Duration and frequency
- Potential triggers
- Time of day patterns

## Guidelines
- Be precise in recording information
- Ask clarifying questions when needed
- Look for patterns and correlations
- Provide encouragement for consistent tracking`,
      isActive: true,
      createdAt: '2024-01-25T11:00:00Z',
      updatedAt: '2024-01-25T11:00:00Z',
    },
  },
];

/**
 * Get all mock prompts
 */
export function getMockPrompts(): CrewMemberPrompt[] {
  return MOCK_PROMPTS;
}

/**
 * Get mock prompt by crew member ID
 */
export function getMockPromptByCrewId(crewMemberId: string): CrewMemberPrompt | undefined {
  return MOCK_PROMPTS.find(p => p.crewMemberId === crewMemberId);
}

/**
 * Simulate saving a prompt (mock implementation)
 */
export function mockSavePrompt(crewMemberId: string, prompt: string): Promise<PromptVersion> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existing = MOCK_PROMPTS.find(p => p.crewMemberId === crewMemberId);
      const newVersion: PromptVersion = {
        id: `v${Date.now()}-${crewMemberId}`,
        version: existing ? existing.currentVersion.version : 1,
        prompt,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      resolve(newVersion);
    }, 500); // Simulate network delay
  });
}

/**
 * Simulate saving as new version (mock implementation)
 */
export function mockSaveAsNewVersion(crewMemberId: string, prompt: string, name: string): Promise<PromptVersion> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existing = MOCK_PROMPTS.find(p => p.crewMemberId === crewMemberId);
      const newVersionNum = existing ? existing.currentVersion.version + 1 : 1;
      const newVersion: PromptVersion = {
        id: `v${newVersionNum}-${crewMemberId}`,
        version: newVersionNum,
        name, // Version name/tag
        prompt,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      resolve(newVersion);
    }, 500);
  });
}
