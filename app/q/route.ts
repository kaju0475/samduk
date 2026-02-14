import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');

  if (!token) {
    redirect('/auth/login');
  }

  // Redirect to the main login page with the token
  redirect(`/auth/login?token=${token}`);
}
