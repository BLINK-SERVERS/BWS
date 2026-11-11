/* ============================================================
   Estado de sesión en la interfaz
   ------------------------------------------------------------
   `undefined` significa «todavía no sé»; `null`, «no hay sesión».
   La distinción evita enseñar el formulario de ingreso a alguien
   que ya entró mientras la respuesta viaja.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { api, type SesionPortal } from "./api";

export function useSesion(): {
  sesion: SesionPortal | null | undefined;
  recargar: () => Promise<void>;
} {
  const [sesion, setSesion] = useState<SesionPortal | null | undefined>(undefined);

  const recargar = useCallback(async () => {
    try {
      const respuesta = await api.sesion();
      setSesion(respuesta.sesion);
    } catch {
      setSesion(null);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { sesion, recargar };
}
