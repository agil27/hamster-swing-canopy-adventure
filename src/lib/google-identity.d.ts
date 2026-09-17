// Minimal shape of the bits of Google Identity Services (the `gsi/client`
// script loaded in index.html) that GoogleSignInButton.tsx actually uses.
// Not an official type package — just enough to avoid `any`.
interface GoogleIdConfiguration {
  client_id: string
  callback: (response: { credential: string }) => void
  auto_select?: boolean
}

interface GoogleIdButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  logo_alignment?: 'left' | 'center'
  width?: number
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleIdConfiguration) => void
        renderButton: (parent: HTMLElement, options: GoogleIdButtonOptions) => void
        disableAutoSelect: () => void
      }
    }
  }
}
