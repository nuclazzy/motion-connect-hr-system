/// <reference types="@types/gapi" />
/// <reference types="@types/gapi.client.calendar" />

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(options?: { prompt?: string }): void
        callback: (response: TokenResponse) => void
      }

      interface TokenResponse {
        access_token: string
        error?: string
        error_description?: string
        error_uri?: string
      }

      function initTokenClient(config: {
        client_id: string
        scope: string
        callback: string | ((response: TokenResponse) => void)
        prompt?: string
      }): TokenClient

      function revoke(token: string, callback?: () => void): void
    }
  }
}