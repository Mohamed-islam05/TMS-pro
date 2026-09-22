"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return (
        <button
            aria-hidden
            className="rounded-full border border-border bg-background p-2.5 shadow-sm"
        />
        );
    }

    return (
        <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Changer le thème"
        className="rounded-full border border-border bg-background p-2.5 text-foreground shadow-sm transition-colors hover:bg-muted"
        >
        <Sun className="h-5 w-5 dark:hidden" />
        <Moon className="hidden h-5 w-5 dark:block" />
        </button>
    );
}