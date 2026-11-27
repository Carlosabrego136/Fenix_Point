# Fénix Point · fenixpoint-ayora

Sistema independiente de recepción de paquetes con QR para Fénix Recolección y Envíos.

- `/` formulario público (el cliente escanea el QR; sin cuenta).
- `/panel` acceso del personal: **Administradora** (todo) y **Mostrador** (recibir, imprimir etiqueta).
- Todo el sitio es `noindex` (no aparece en buscadores).

## Tecnología
Next.js 15 · TypeScript · Postgres (Aiven) · sesión por cookie firmada (JWT) · etiqueta 50×100 mm con código de barras.

## Reglas clave
- Folio consecutivo sin huecos, asignado solo al **recibir** el paquete.
- Estados: en espera → recibido → finalizado (o cancelado). Nada se borra (triggers en la base).
- Bitácora inmutable de todas las acciones.
- Contraseñas: mínimo 8 caracteres con letras y números.

## Variables de entorno (Vercel → Settings → Environment Variables)
| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de la base **exclusiva** `fenixpoint` |
| `DATABASE_CA_CERT` | Certificado CA de Aiven (contenido PEM) |
| `SESSION_SECRET` | Cadena aleatoria de 32+ caracteres |
| `NEXT_PUBLIC_SITE_URL` | `https://fenix-point.vercel.app` |

Ver `.env.example`. **Nunca** suba `.env.local` a git.

## Puesta en marcha
1. Crear base `fenixpoint` y usuario propio en Aiven (la migración se niega a correr en una base que ya tenga otras tablas).
2. `npm install`
3. `npm run db:migrate` (el `build` también migra automáticamente)
4. `npm run db:seed` (crea Administradora y Mostrador, pide contraseñas sin mostrarlas)
5. Desplegar en Vercel y validar con `npm run db:check`.

## Mantenimiento
- Cambiar contraseña desde terminal: `npm run db:password`
- La Administradora cambia la del Mostrador en **Cuenta y accesos**.
- Tras las pruebas del cliente: `npm run db:reset-pruebas` (borra envíos de prueba y reinicia el folio en 0; pide escribir BORRAR PRUEBAS).

## Impresión de etiquetas (BT320)
Papel 50×100 mm, márgenes «ninguno», escala 100 %.

## Desarrollo
`npm run dev` · `npm run typecheck` · `npm run build`
