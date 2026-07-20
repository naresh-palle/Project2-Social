import { motion } from "framer-motion";

export function MockGoogleLogin({ onSuccess }) {
  const handleMockLogin = () => {
    // Create a mock JWT token (base64 encoded JSON)
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      email: "test.user@mock-google.com",
      given_name: "Test",
      family_name: "User",
      sub: "mock-google-12345"
    }));
    const signature = "mock-signature";
    
    const fakeCredential = `${header}.${payload}.${signature}`;
    
    onSuccess({ credential: fakeCredential });
  };

  return (
    <motion.button
      type="button"
      onClick={handleMockLogin}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="flex items-center justify-center w-full py-3 bg-[#1A1A1A] text-white rounded-md border border-[#333] hover:bg-[#2A2A2A] transition-colors font-sans text-sm font-medium"
      style={{
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
      }}
    >
      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </motion.button>
  );
}
