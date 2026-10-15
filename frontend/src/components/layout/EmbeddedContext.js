import { createContext, useContext } from "react";

// True while a page is rendered inside another page's tab, so it skips its own
// title/breadcrumb header.
export const EmbeddedContext = createContext(false);
export const useEmbedded = () => useContext(EmbeddedContext);
