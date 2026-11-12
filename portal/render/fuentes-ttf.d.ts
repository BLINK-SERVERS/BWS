// Wrangler empaqueta los `.ttf` como módulos `Data` (ver `rules`).
declare module "*.ttf" {
  const bytes: Uint8Array;
  export default bytes;
}
