/**
 * Every dataset's Intelligence admin lives in its own client's admin, at
 * the same slug — the dataset ids in the server registry are agent slugs
 * (`aspect` included: that agent's Intelligence dataset is `aspect`, not the
 * zer4u schema its chat runs on).
 */
export function intelligenceAdminPath(datasetId: string, subPage = 'overview'): string {
  return `/${datasetId}/admin/intelligence/${subPage}`;
}
