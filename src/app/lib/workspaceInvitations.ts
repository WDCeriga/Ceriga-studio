import { getSupabase } from './supabaseClient';

type InviteInput = {
  workspace: 'factory' | 'internal';
  name?: string;
  email?: string;
  role?: string;
  factoryId?: string | null;
  resend?: string;
  revision?: number;
};

export async function sendWorkspaceInvitation(input: InviteInput) {
  const { data, error } = await getSupabase().functions.invoke('workspace-team-invite', { body: input });
  if (error) {
    const response = await error.context?.json?.().catch(() => null);
    throw new Error(response?.error || error.message);
  }
  if (!data?.id || !['sent', 'failed'].includes(data.delivery)) {
    throw new Error('Invitation delivery could not be confirmed. Refresh the team list.');
  }
  return data.delivery === 'sent'
    ? 'Invitation email sent.'
    : 'Member added as pending. Email delivery failed. Use Resend invitation to try again.';
}
