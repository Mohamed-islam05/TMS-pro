"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type Props = {
    children: React.ReactNode;
    [key: string]: any;
};

export function ThemeProvider({ children, ...props }: Props) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}