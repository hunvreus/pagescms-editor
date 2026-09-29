import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:5187",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5187",
    port: 5187,
    reuseExistingServer: false,
  },
});
