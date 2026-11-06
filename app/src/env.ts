import { defineEnvVars } from '@sveltejs/kit/env'

export const variables = defineEnvVars({
  PUBLIC_PREVIEW_URL: {
    public: true,
    static: true,
    description: 'link preview worker, localhost in dev',
    schema: (v) => v || 'http://localhost:8787'
  },
  PUBLIC_GOOGLE_CLIENT_ID: {
    public: true,
    static: true,
    description: 'oauth client for google sign-in and drive'
  }
})
