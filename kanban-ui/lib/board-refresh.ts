"use client";
import { createContext } from "react";
export const BoardRefreshContext = createContext<() => Promise<void>>(async () => {});
