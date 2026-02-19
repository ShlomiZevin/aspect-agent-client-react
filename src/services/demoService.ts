import { apiRequest, getBaseURL } from './api';
import type {
  DemoMockup,
  DemoMessage,
  CreateDemoMockupRequest,
  UpdateDemoMockupRequest,
  ParseConversationResponse,
  Language,
} from '../types/demo';

interface ListMockupsResponse {
  mockups: DemoMockup[];
}

interface MockupResponse {
  mockup: DemoMockup;
}

interface CreateMockupResponse {
  success: boolean;
  mockup: DemoMockup;
}

interface DeleteMockupResponse {
  success: boolean;
  message: string;
}

export async function listMockups(baseURL?: string): Promise<DemoMockup[]> {
  const data = await apiRequest<ListMockupsResponse>(
    '/api/demo-mockups',
    { method: 'GET' },
    baseURL || getBaseURL()
  );
  return data.mockups;
}

export async function getMockup(publicId: string, baseURL?: string): Promise<DemoMockup> {
  const data = await apiRequest<MockupResponse>(
    `/api/demo-mockups/${publicId}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
  return data.mockup;
}

export async function createMockup(
  request: CreateDemoMockupRequest,
  baseURL?: string
): Promise<DemoMockup> {
  const data = await apiRequest<CreateMockupResponse>(
    '/api/demo-mockups',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    baseURL || getBaseURL()
  );
  return data.mockup;
}

export async function updateMockup(
  publicId: string,
  request: UpdateDemoMockupRequest,
  baseURL?: string
): Promise<DemoMockup> {
  const data = await apiRequest<MockupResponse>(
    `/api/demo-mockups/${publicId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(request),
    },
    baseURL || getBaseURL()
  );
  return data.mockup;
}

export async function deleteMockup(
  publicId: string,
  baseURL?: string
): Promise<void> {
  await apiRequest<DeleteMockupResponse>(
    `/api/demo-mockups/${publicId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function parseConversation(
  text: string,
  language: Language = 'en',
  baseURL?: string
): Promise<DemoMessage[]> {
  const data = await apiRequest<ParseConversationResponse>(
    '/api/demo-mockups/parse',
    {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    },
    baseURL || getBaseURL()
  );

  if (!data.success) {
    throw new Error(data.error || 'Failed to parse conversation');
  }

  return data.messages;
}

interface UploadLogoResponse {
  success: boolean;
  url: string;
  error?: string;
}

export async function uploadLogo(file: File, baseURL?: string): Promise<string> {
  const formData = new FormData();
  formData.append('logo', file);

  const url = baseURL || getBaseURL();
  const response = await fetch(`${url}/api/demo-mockups/upload-logo`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload logo');
  }

  const data: UploadLogoResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to upload logo');
  }

  // Return full URL
  return `${url}${data.url}`;
}
