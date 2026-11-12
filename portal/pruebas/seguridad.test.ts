/* ============================================================
   Contraseñas, tokens, cookies y trazo de firma
   ------------------------------------------------------------
   Estas pruebas no tocan la base: comprueban las piezas que
   deciden si una credencial vale o si una imagen puede entrar en
   `firmas_cliente`.
   ============================================================ */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ErrorHttp } from "../server/_lib/respuestas.ts";
import { hashearClave, verificarClave, verificarConRelleno } from "../server/_lib/clave.ts";
import { cookieBorrada, cookieDeSesion, hashToken, tokenNuevo } from "../server/_lib/sesion.ts";
import { validarFirmaPNG } from "../server/_lib/imagen.ts";

describe("claves con scrypt", () => {
  it("guarda el formato con parámetros y una sal distinta cada vez", async () => {
    const uno = await hashearClave("claveSegura123");
    const dos = await hashearClave("claveSegura123");
    assert.match(uno, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    assert.notEqual(uno, dos);
  });

  it("acepta la clave correcta y rechaza la incorrecta", async () => {
    const almacenado = await hashearClave("claveSegura123");
    assert.equal(await verificarClave("claveSegura123", almacenado), true);
    assert.equal(await verificarClave("claveSegura124", almacenado), false);
    assert.equal(await verificarClave("", almacenado), false);
  });

  it("rechaza un hash con formato o parámetros alterados", async () => {
    const almacenado = await hashearClave("claveSegura123");
    const partes = almacenado.split("$");
    partes[1] = "1";
    assert.equal(await verificarClave("claveSegura123", partes.join("$")), false);
    assert.equal(await verificarClave("claveSegura123", "texto-plano"), false);
    assert.equal(await verificarClave("claveSegura123", ""), false);
  });

  it("gasta el mismo trabajo cuando la cuenta no existe", async () => {
    assert.equal(await verificarConRelleno("claveSegura123", null), false);
  });
});

describe("tokens de sesión", () => {
  it("son opacos, distintos y de 43 caracteres base64url", () => {
    const a = tokenNuevo();
    const b = tokenNuevo();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, b);
  });

  it("la base guarda solo el SHA-256, de 64 hex", () => {
    const token = tokenNuevo();
    assert.match(hashToken(token), /^[0-9a-f]{64}$/);
    assert.equal(hashToken(token), hashToken(token));
    assert.notEqual(hashToken(token), token);
  });
});

describe("cookies de sesión", () => {
  const anterior = process.env.ENTORNO;

  afterEach(() => {
    if (anterior === undefined) delete process.env.ENTORNO;
    else process.env.ENTORNO = anterior;
  });

  it("en local no usa el prefijo __Host- ni Secure", () => {
    process.env.ENTORNO = "local";
    const cookie = cookieDeSesion("token", new Date(Date.now() + 3600_000));
    assert.match(cookie, /^bws_sesion=token;/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Secure/);
    assert.match(cookieBorrada(), /Max-Age=0/);
  });

  it("fuera de local usa __Host-, Secure y borra con Max-Age=0", () => {
    process.env.ENTORNO = "produccion";
    const cookie = cookieDeSesion("token", new Date(Date.now() + 3600_000));
    assert.match(cookie, /^__Host-bws_sesion=token;/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /Path=\//);
    assert.doesNotMatch(cookie, /Domain/);
    assert.match(cookieBorrada(), /^__Host-bws_sesion=;/);
    assert.match(cookieBorrada(), /Secure/);
  });
});

/** PNG con cabecera IHDR real y relleno hasta superar el mínimo. */
function pngDe(ancho: number, alto: number, relleno = 600): Buffer {
  const png = Buffer.alloc(relleno, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "latin1");
  png.writeUInt32BE(ancho, 16);
  png.writeUInt32BE(alto, 20);
  return png;
}

function rechazo(fn: () => unknown): ErrorHttp {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ErrorHttp, "debió lanzar ErrorHttp");
    return error;
  }
  assert.fail("no lanzó ningún error");
}

describe("trazo de firma", () => {
  it("acepta un PNG con dimensiones razonables y lo devuelve con hash", () => {
    const png = pngDe(600, 200);
    const firma = validarFirmaPNG(`data:image/png;base64,${png.toString("base64")}`);
    assert.equal(firma.ancho, 600);
    assert.equal(firma.alto, 200);
    assert.match(firma.sha256, /^[0-9a-f]{64}$/);
    assert.equal(firma.png.length, png.length);
  });

  it("acepta base64 pelado con espacios", () => {
    const png = pngDe(600, 200);
    const base64 = png.toString("base64").replace(/(.{60})/g, "$1\n");
    assert.equal(validarFirmaPNG(base64).ancho, 600);
  });

  it("rechaza vacío, texto y una imagen que no es PNG", () => {
    assert.equal(rechazo(() => validarFirmaPNG("")).estado, 400);
    assert.equal(rechazo(() => validarFirmaPNG("no es una imagen")).estado, 400);
    assert.equal(rechazo(() => validarFirmaPNG(null)).estado, 400);
    assert.equal(rechazo(() => validarFirmaPNG(pngDe(600, 200).toString("base64").replace(/^./, "A"))).estado, 400);
  });

  it("rechaza un PNG diminuto o con dimensiones fuera de rango", () => {
    assert.equal(rechazo(() => validarFirmaPNG(pngDe(600, 200, 200))).estado, 400);
    assert.equal(rechazo(() => validarFirmaPNG(pngDe(100, 200))).estado, 400);
    assert.equal(rechazo(() => validarFirmaPNG(pngDe(600, 20))).estado, 400);
    assert.equal(rechazo(() => validarFirmaPNG(pngDe(5000, 200))).estado, 400);
  });
});
