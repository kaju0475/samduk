import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!token) {
    redirect('/auth/login');
  }

  // Re-add 'ENC-' prefix for base64url encrypted tokens.
  // We distinguish from raw UUIDs by checking the format.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const isEncrypted = !isUuid && token.length > 30 && !token.startsWith('ENC-');
  
  const fullToken = isEncrypted ? `ENC-${token}` : token;

  // Use 307 Temporary Redirect to preserve method (though GET is fine here)
  // Ensure we redirect to the full path
  redirect(`/auth/login?token=${fullToken}`);
}
