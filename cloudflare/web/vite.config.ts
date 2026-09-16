import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
	root,
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"~/web": `${root}src`,
			"~/prisma": `${repo}/cloudflare/node_modules/.prisma-d1`,
			"~/shared": `${repo}/cloudflare/shared`,
			"~/worker": `${repo}/cloudflare/worker`,
		},
	},
	build: { outDir: `${root}dist`, emptyOutDir: true },
	server: {
		port: 3000,
		proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
	},
});
