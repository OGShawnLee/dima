# F009 — Application Hardening Before Deploy

| ID | Status | Model | Lane | Spec |
| :--- | :--- | :--- | :--- | :--- |
| `F009` | `implemented` | Coding model | Front | [spec.md](spec.md) |

## Items addressed
Follow-ups recorded in [PROGRESS.md](../../frontendnet/.routing/PROGRESS.md) "Notes for Later Tickets" during F001–F007:
1. Default MVC model-binding messages are English ("The value '…' is not valid") — UI strings must be Spanish.
2. `HttpClient` timeouts (`TaskCanceledException`) and unexpected `HttpRequestException`s outside `PedidosController.Confirmar` surface as `500`.
3. F003 audit note: `GET /Archivos/Imagen/{id}` is `public, max-age=300`; a refreshed `Set-Cookie` could ride on that cacheable response.

## Scope

### May create or edit
- `frontendnet/Program.cs`
- `frontendnet/Filters/**` (new)
- `frontendnet/Controllers/ArchivosController.cs` (`Imagen` action headers only)
- `frontendnet/Views/Home/Error.cshtml`
- `.tickets/F009-app-hardening/changelog.md`

### Must not touch
- Other controllers, services, views, `Middlewares/**`, `frontendnet/deploy/**` (F008), `backendnode/**`, routing files, any `audit.md`.

## Steps
1. `AddControllersWithViews(o => { ...existing antiforgery filter...; o.ModelBindingMessageProvider.Set...Accessor(...) })` with Spanish messages for every accessor (`ValueIsInvalid`, `ValueMustBeANumber`, `MissingBindRequiredValue`, `AttemptedValueIsInvalid`, `NonPropertyAttemptedValueIsInvalid`, `UnknownValueIsInvalid`, `ValueMustNotBeNull`, `MissingKeyOrValue`, `MissingRequestBodyRequiredValue`, `NonPropertyUnknownValueIsInvalid`, `NonPropertyValueMustBeANumber`).
2. Global `IAsyncExceptionFilter` (registered in `Program.cs`) for exceptions not already handled by controllers: `HttpRequestException` `401` → `/Auth/Salir`, `403` → `/Home/AccessDenied`, timeouts / connection failures / other statuses → `/Home/Error` view with a Spanish "El servicio no está disponible, inténtelo más tarde" message (`503`), logged with the request path, never leaking exception details.
3. `Imagen`: when the request is authenticated, send `Cache-Control: private, max-age=300` (keep `public` for anonymous), or strip a re-issued auth cookie from that response — pick one, document why.
4. Do not change behaviour already verified in F001–F007.

## Done when
[spec.md](spec.md) passes.
