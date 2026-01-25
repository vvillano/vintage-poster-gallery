export { default } from 'next-auth/middleware';

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
