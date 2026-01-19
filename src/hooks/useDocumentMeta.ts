import { useEffect } from 'react';

interface DocumentMetaOptions {
  title: string;
  favicon?: string;
  description?: string;
}

/**
 * Hook to update document title, favicon, and meta description
 */
export function useDocumentMeta({ title, favicon, description }: DocumentMetaOptions) {
  useEffect(() => {
    // Update title
    document.title = title;

    // Update favicon if provided
    if (favicon) {
      const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (link) {
        link.href = favicon;
      } else {
        const newLink = document.createElement('link');
        newLink.rel = 'icon';
        newLink.type = 'image/png';
        newLink.href = favicon;
        document.head.appendChild(newLink);
      }
    }

    // Update meta description if provided
    if (description) {
      const meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
      if (meta) {
        meta.content = description;
      }
    }
  }, [title, favicon, description]);
}
