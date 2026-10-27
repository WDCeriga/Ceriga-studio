import { getSupabase } from './supabaseClient';
import { isConnectionError, requestMessage } from './requestErrors';

export async function passwordLogin(email: string, password: string): Promise<void> {
  // Retry a transient connection failure once. Invalid credentials are never retried.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return;
    } catch (error) {
      if (attempt === 0 && isConnectionError(error)) continue;
      throw new Error(requestMessage(error, 'Could not sign in. Please try again.'));
    }
  }
}
