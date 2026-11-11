# Revisión jurídica pendiente

**Estado:** los ocho textos de `portal/legal/textos/` se usan tal cual. No han
pasado por abogado. El dueño de BLINK aceptó ese riesgo de forma expresa: se
prefiere un expediente honesto y completo, redactado a partir de la ley
vigente, antes que retrasar el portal sin fecha de revisión.

**Qué significa «sin revisar»:** el sistema no afirma que los documentos sean
válidos ni que un juez vaya a sostener cada cláusula. Significa que el texto
está escrito, es coherente con lo que el software hace y evita promesas
indemostrables. Cuando haya abogado, esta lista es el orden de trabajo.

## Base legal citada

- Decreto-Ley 1.204 sobre Mensajes de Datos y Firmas Electrónicas (2001), y
  las condiciones de SUSCERTE para prestadores acreditados.
- Constitución de la República Bolivariana de Venezuela, artículos 28 y 60.
- Código Civil y Código de Comercio, para obligaciones, contratos y prueba.
- Ley Especial contra los Delitos Informáticos.
- Ley sobre el Derecho de Autor, para el software y el sistema de diseño.

No se cita una ley general de protección de datos personales porque Venezuela
no tiene una vigente. La política de privacidad se apoya en los derechos
constitucionales y en las obligaciones contractuales, y así lo dice.

## Puntos que un abogado debe confirmar

1. **Firma electrónica simple.** Que la descripción del Decreto-Ley 1.204 en
   BWS-LEG-002 sea correcta y que la frase «no certificada, no equivalente a
   la firma autógrafa» no necesite una advertencia adicional para el
   consumidor. Confirmar también que la captura única con evidencia (trazo,
   UTC, IP, agente, sello SHA-256) basta para el uso previsto.
2. **Consentimiento y prueba.** Si el orden de firma —LEG-002 antes de
   capturar el trazo— y el hash del texto consentido son suficientes para
   acreditar el consentimiento informado.
3. **Licencia, no cesión.** Que BWS-CON-004, el anexo F y BWS-LIC-007 no
   puedan leerse como una cesión del software, y que la compra del código o
   de la arquitectura quede claramente fuera del objeto del contrato.
4. **Mora y suspensión.** Que suspender el servicio y la licencia a los diez
   días, y terminarla a los treinta, no se lea como una pena ni como
   confiscación de datos o del dominio. Confirmar el plazo de gracia de cinco
   días y la redacción del anexo D.
5. **Datos del cliente.** Que la retención de noventa días para permitir la
   exportación, y hasta diez años de evidencia, sea proporcionada; y que el
   encargo de tratamiento del anexo E cubra a Neon, Vercel y el proveedor de
   correo en Estados Unidos.
6. **Consumidor.** Si alguna cláusula de limitación de responsabilidad
   (doce meses de lo pagado), de terminación unilateral o de uso del crédito
   «Powered by Blink» choca con normas de protección al consumidor.
7. **Tributos.** El tratamiento de IVA, IGTF y retenciones sobre pagos en
   bolívares a tasa BCV, y la conversión del dominio cotizado en euros.
8. **Dominio y correos.** Que la gestión manual ante NIC.ve y la titularidad
   del dominio a nombre del cliente estén bien descritas, incluida la
   consecuencia de no pagar la renovación.
9. **Confidencialidad.** El plazo de cinco años de BWS-NDA-008 y las
   excepciones por ley o requerimiento de autoridad.
10. **EULA.** Que BWS-LIC-007 proteja a Blink como tercero beneficiario frente
    a los usuarios finales de la aplicación del cliente, sin convertirlo en
    responsable del contenido de esa aplicación.

## Afirmaciones que no se imprimen

| No se afirma | Se dice en su lugar |
|---|---|
| Firma electrónica certificada | Firma electrónica simple con evidencia reforzada |
| Equivalencia con la firma autógrafa | Manifestación de voluntad con evidencia; el juez decide |
| Validez probatoria plena | La evidencia ayuda a demostrar quién, cuándo y sobre qué texto |
| PDF/A | PDF 1.7 con sello de contenido SHA-256 y fuentes embebidas |
| Certificación o conformidad ISO | Medidas razonables de seguridad, descritas |
| Registro inmutable | No modificable dentro del sistema, con alteración detectable |
| Datos 100 % seguros | Medidas concretas y sus límites |
| Ley general de protección de datos vigente | CRBV 28 y 60, contrato y encargo de tratamiento |

`portal/scripts/revisar-afirmaciones.mjs` falla si alguna de esas frases
aparece sin negar en los textos. La revisión automática no sustituye la
lectura humana: comprueba forma, no intención.

## Registro del riesgo aceptado

- **Fecha:** 11 de noviembre de 2026.
- **Decisión:** usar los textos sin revisión jurídica previa.
- **Alcance:** los ocho documentos y sus anexos.
- **Consecuencia:** si un abogado cambia una cláusula, se publica una versión
  nueva de la plantilla; las versiones firmadas no se editan.
