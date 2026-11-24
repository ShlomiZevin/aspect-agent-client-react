import { createContext, useContext } from 'react';

/** Opens the demo's chat modal; with a question, asks it right away. */
export interface RealEstateChat {
  openChat: (question?: string) => void;
}

export const RealEstateChatContext = createContext<RealEstateChat>({ openChat: () => {} });

export const useRealEstateChat = () => useContext(RealEstateChatContext);
