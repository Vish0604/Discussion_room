import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { ChatRoom } from './components/ChatRoom';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user already has an active session
    const checkSession = async () => {
      try {
        const supabase = createClient(
          `https://${projectId}.supabase.co`,
          publicAnonKey
        );

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setAccessToken(session.access_token);
          setUsername(session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = (token: string, user: string) => {
    setAccessToken(token);
    setUsername(user);
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );

      await supabase.auth.signOut();
      setAccessToken(null);
      setUsername('');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!accessToken ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <ChatRoom accessToken={accessToken} username={username} onLogout={handleLogout} />
      )}
    </>
  );
}
