import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "path";

export default defineConfig({
    vite: {
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    },
});