
export async function hashearClave(env: Env, clave: string): Promise<string> {
  return env.CLAVE.get(env.CLAVE.idFromName("hash")).hashear(clave);
}

export async function verificarClave(env: Env, clave: string, almacenado: string | null): Promise<boolean> {
  const sal = almacenado?.split("$")[4] ?? "relleno";
  const particion = /^[0-9a-f]{16}$/i.test(sal) ? sal.slice(0, 8) : "relleno";
  return env.CLAVE.get(env.CLAVE.idFromName(`verificar-${particion}`)).verificar(clave, almacenado);
}
