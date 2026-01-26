import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized({ token }) {
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/upload/:path*',
    '/poster/:path*',
    '/settings/:path*',
    '/api/upload/:path*',
    '/api/analyze/:path*',
    '/api/posters/:path*',
  ],
};
