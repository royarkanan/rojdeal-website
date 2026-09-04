const remotePatterns = [];
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const localLab = process.env.ROJDEAL_LOCAL_LAB === '1'
    && process.env.NODE_ENV === 'development'
    && url.href === 'http:' + '//127.0.0.1:54381/';
  if (url.protocol !== 'https:' && !localLab) throw new Error('Supabase URL must use HTTPS');
  remotePatterns.push({ protocol: url.protocol.slice(0, -1), hostname: url.hostname, port: url.port, pathname: '/storage/v1/object/public/**' });
}
export default { images: { remotePatterns, unoptimized: process.env.ROJDEAL_CLOUDFLARE_BUILD === '1' }, devIndicators: false };
