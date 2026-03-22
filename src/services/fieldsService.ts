import { apiRequest, getBaseURL } from './api';

export interface FieldDefinition {
  name: string;
  description: string;
  shared?: boolean;
}

export interface CrewMemberInfo {
  name: string;
  displayName: string;
  extractionMode: 'conversational' | 'form';
}

export interface FieldsResponse {
  conversationId: string;
  collectedFields: Record<string, string>;
  currentCrewMember: CrewMemberInfo | null;
  fieldDefinitions: FieldDefinition[];
  totalFieldsToCurrentCrew: number;
}

export interface UpdateFieldsResponse {
  success: boolean;
  collectedFields: Record<string, string>;
}

export async function getFields(
  conversationId: string,
  baseURL?: string
): Promise<FieldsResponse> {
  return apiRequest<FieldsResponse>(
    `/api/conversation/${conversationId}/fields`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

export async function updateFields(
  conversationId: string,
  fields: Record<string, string>,
  baseURL?: string
): Promise<UpdateFieldsResponse> {
  return apiRequest<UpdateFieldsResponse>(
    `/api/conversation/${conversationId}/fields`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    },
    baseURL || getBaseURL()
  );
}

export async function deleteFields(
  conversationId: string,
  fieldNames: string[],
  baseURL?: string
): Promise<UpdateFieldsResponse> {
  return apiRequest<UpdateFieldsResponse>(
    `/api/conversation/${conversationId}/fields`,
    {
      method: 'DELETE',
      body: JSON.stringify({ fieldNames }),
    },
    baseURL || getBaseURL()
  );
}
