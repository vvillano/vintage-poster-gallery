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
    '/research/:path*',
    '/upload/:path*',
    '/import/:path*',
    '/poster/:path*',
    '/products/:path*',
    '/purchase-groups/:path*',
    '/settings/:path*',
    '/api/upload/:path*',
    '/api/analyze/:path*',
    '/api/posters/:path*',
    '/api/dashboard/:path*',
    '/api/admin/:path*',
    '/api/products-index/:path*',
  ],
};
