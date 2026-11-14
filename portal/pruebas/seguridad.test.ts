/* ============================================================
   Contraseñas, tokens, cookies, IP, origen y trazo de firma
   ------------------------------------------------------------
   Estas pruebas no tocan la base: comprueban las piezas que
   deciden si una credencial vale, qué dirección se apunta en la
   auditoría y qué origen puede escribir.
   ============================================================ */

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ErrorHttp } from "../server/_lib/respuestas.ts";
import { hashearClave, verificarClave, verificarConRelleno } from "../server/_lib/clave.ts";
import { cookieBorrada, cookieDeSesion, hashToken, tokenNuevo } from "../server/_lib/sesion.ts";
import { validarFirmaPNG } from "../server/_lib/imagen.ts";
import { ipDe } from "../server/_lib/http.ts";
import { origenPermitido } from "../server/_lib/csrf.ts";

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

function peticionCon(cabeceras: Record<string, string>): Request {
  return new Request("http://localhost/api/auth/ingreso", { headers: cabeceras });
}

describe("IP que se audita", () => {
  it("usa la del borde por encima de cualquier cabecera inventada", () => {
    const r = ipDe(
      peticionCon({
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "1.1.1.1, 8.8.8.8, 198.51.100.7",
      }),
    );
    assert.equal(r, "203.0.113.9");
  });

  it("sin la del borde toma el último salto, no el que puso el cliente", () => {
    assert.equal(
      ipDe(peticionCon({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" })),
      "198.51.100.7",
    );
    assert.equal(ipDe(peticionCon({ "x-forwarded-for": "198.51.100.7" })), "198.51.100.7");
  });

  it("acepta las formas que caben en una columna inet", () => {
    for (const valor of [
      "203.0.113.9",
      "0.0.0.0",
      "255.255.255.255",
      "2001:db8::1",
      "::1",
      "::",
      "fe80:0:0:0:0:0:0:1",
      "64:ff9b::203.0.113.9",
      "1:2:3:4:5:6:1.2.3.4",
      "[2001:db8::1]",
    ]) {
      assert.equal(ipDe(peticionCon({ "cf-connecting-ip": valor })), valor.replace(/^\[|\]$/g, ""), valor);
    }
  });

  it("devuelve null antes de que la basura llegue a Postgres", () => {
    const descartables = [
      "",
      "no-es-una-ip",
      "999.1.1.1",
      "1.2.3",
      "1.2.3.4, 5.6.7.8",
      "1.2.3.4/24",
      "1.2.3.4:5678",
      "2001:db8:::1",
      "1:2:3:4:5:6:7:8:9",
      "abcd:1.2.3.4",
      "dead:beef",
      "1:2:3:4:5:6:7",
      "fe80::1%eth0",
      "12345::1",
    ];
    for (const valor of descartables) {
      assert.equal(ipDe(peticionCon({ "cf-connecting-ip": valor })), null, valor);
    }
    // Sin ninguna de las dos cabeceras tampoco hay IP.
    assert.equal(ipDe(peticionCon({})), null);
    assert.equal(ipDe(peticionCon({ "cf-connecting-ip": "", "x-forwarded-for": "" })), null);
  });

  it("la basura del borde no tapa un último salto válido", () => {
    const r = ipDe(
      peticionCon({ "cf-connecting-ip": "nada", "x-forwarded-for": "198.51.100.7" }),
    );
    assert.equal(r, "198.51.100.7");
  });
});

describe("origen de las mutaciones", () => {
  const entorno = process.env.ENTORNO;
  const appOrigen = process.env.APP_ORIGEN;

  afterEach(() => {
    if (entorno === undefined) delete process.env.ENTORNO;
    else process.env.ENTORNO = entorno;
    if (appOrigen === undefined) delete process.env.APP_ORIGEN;
    else process.env.APP_ORIGEN = appOrigen;
  });

  it("en producción localhost solo vale si alguien lo declara", () => {
    process.env.ENTORNO = "produccion";
    process.env.APP_ORIGEN = "https://bws.blink.com.ve";
    assert.equal(origenPermitido(peticionCon({ origin: "https://bws.blink.com.ve" })), true);
    assert.equal(origenPermitido(peticionCon({ origin: "http://localhost:5177" })), false);
    assert.equal(origenPermitido(peticionCon({ origin: "http://127.0.0.1:5177" })), false);
  });

  it("sin APP_ORIGEN en producción no hay origen que valga", () => {
    process.env.ENTORNO = "produccion";
    delete process.env.APP_ORIGEN;
    assert.equal(origenPermitido(peticionCon({ origin: "https://bws.blink.com.ve" })), false);
    assert.equal(origenPermitido(peticionCon({})), false);
  });

  it("fuera de producción el desarrollo sigue entrando", () => {
    process.env.ENTORNO = "local";
    assert.equal(origenPermitido(peticionCon({ origin: "http://localhost:5177" })), true);
    assert.equal(origenPermitido(peticionCon({ origin: "http://127.0.0.1:5177" })), true);
    assert.equal(origenPermitido(peticionCon({ origin: "https://victimia.example" })), false);
  });

  it("los orígenes declarados se leen con espacios y sin entrar en el vacío", () => {
    process.env.ENTORNO = "produccion";
    process.env.APP_ORIGEN = " https://a.example ,, https://b.example ";
    assert.equal(origenPermitido(peticionCon({ origin: "https://a.example" })), true);
    assert.equal(origenPermitido(peticionCon({ origin: "https://b.example" })), true);
    assert.equal(origenPermitido(peticionCon({ origin: "" })), false);
  });
});
