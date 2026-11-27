using frontendnet.Filters;
using frontendnet.Middlewares;
using frontendnet.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
bool isDevelopment = builder.Environment.IsDevelopment();

// Cookies are Secure-only outside Development; in Development they follow the request scheme
// (Secure under the https profile, still usable on the http profile).
var cookieSecurePolicy = isDevelopment ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;

// MVC with antiforgery validation on every unsafe HTTP method (POST/PUT/DELETE), a global safety
// net for backend failures that controllers do not handle (F009) and Spanish model-binding messages.
builder.Services.AddControllersWithViews(o =>
{
    o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
    o.Filters.Add<ErrorServicioExceptionFilter>();

    var m = o.ModelBindingMessageProvider;
    m.SetAttemptedValueIsInvalidAccessor((valor, campo) => $"El valor '{valor}' no es válido para {campo}.");
    m.SetMissingBindRequiredValueAccessor(campo => $"No se proporcionó un valor para {campo}.");
    m.SetMissingKeyOrValueAccessor(() => "Se requiere un valor.");
    m.SetMissingRequestBodyRequiredValueAccessor(() => "Se requiere el cuerpo de la solicitud.");
    m.SetNonPropertyAttemptedValueIsInvalidAccessor(valor => $"El valor '{valor}' no es válido.");
    m.SetNonPropertyUnknownValueIsInvalidAccessor(() => "El valor proporcionado no es válido.");
    m.SetNonPropertyValueMustBeANumberAccessor(() => "El campo debe ser un número.");
    m.SetUnknownValueIsInvalidAccessor(campo => $"El valor proporcionado no es válido para {campo}.");
    m.SetValueIsInvalidAccessor(valor => $"El valor '{valor}' no es válido.");
    m.SetValueMustBeANumberAccessor(campo => $"El campo {campo} debe ser un número.");
    m.SetValueMustNotBeNullAccessor(valor => $"El valor '{valor}' no es válido.");
});
builder.Services.AddAntiforgery(o =>
{
    o.Cookie.Name = ".frontendnet.af";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = cookieSecurePolicy;
});

// Outbound delegating handlers.
builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<EnviaBearerDelegatingHandler>();
builder.Services.AddTransient<RefrescaTokenDelegatingHandler>();
builder.Services.AddTransient<ReenviaIpDelegatingHandler>();

// Typed clients. Every service is registered here (parallel-safety rule): later tickets
// only fill in their own Services/*ClientService.cs and never edit Program.cs.
string urlWebApi = builder.Configuration["UrlWebAPI"]
    ?? throw new InvalidOperationException("Missing configuration value 'UrlWebAPI'.");
var baseAddress = new Uri(urlWebApi.TrimEnd('/') + "/");

// Backend call timeout (F009). The HttpClient default (100 s) outlives nginx's default
// proxy_read_timeout (60 s), so the user would get a bare 504 instead of the Spanish 503 page.
// Overridable with UrlWebAPITimeoutSeconds (e.g. environment variable) for slow environments.
int timeoutSegundos = builder.Configuration.GetValue("UrlWebAPITimeoutSeconds", 30);
if (timeoutSegundos is < 1 or > 300)
{
    throw new InvalidOperationException("'UrlWebAPITimeoutSeconds' must be between 1 and 300.");
}

var timeout = TimeSpan.FromSeconds(timeoutSegundos);
void ConfiguraCliente(HttpClient c)
{
    c.BaseAddress = baseAddress;
    c.Timeout = timeout;
}

// Login is unauthenticated: only the IP-forwarding handler.
builder.Services.AddHttpClient<AuthClientService>(ConfiguraCliente)
    .AddHttpMessageHandler<ReenviaIpDelegatingHandler>();

// Authenticated clients: Envia (Bearer) -> Refresca (Set-Authorization) -> ReenviaIp (X-Forwarded-For).
static IHttpClientBuilder ConCadenaApi(IHttpClientBuilder b) => b
    .AddHttpMessageHandler<EnviaBearerDelegatingHandler>()
    .AddHttpMessageHandler<RefrescaTokenDelegatingHandler>()
    .AddHttpMessageHandler<ReenviaIpDelegatingHandler>();

ConCadenaApi(builder.Services.AddHttpClient<PerfilClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<CategoriasClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<ProductosClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<ArchivosClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<UsuariosClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<RolesClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<BitacoraClientService>(ConfiguraCliente));
ConCadenaApi(builder.Services.AddHttpClient<PedidosClientService>(ConfiguraCliente));

// Browser <-> BFF: encrypted cookie holding the claims and the JWT.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.Cookie.Name = ".frontendnet";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.Cookie.SecurePolicy = cookieSecurePolicy;
        o.LoginPath = "/Auth";
        o.AccessDeniedPath = "/Home/AccessDenied";
        o.SlidingExpiration = true;
        o.ExpireTimeSpan = TimeSpan.FromMinutes(20);
    });
builder.Services.AddAuthorization();

// Persist the key ring so a BFF restart does not invalidate existing cookies.
string keysPath = builder.Configuration["DataProtection:KeysPath"] ?? "keys";
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, keysPath)))
    .SetApplicationName("frontendnet");

// Server-side session (cart, consumed in F006). The cookie only carries an opaque id.
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o =>
{
    o.Cookie.Name = ".frontendnet.session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = cookieSecurePolicy;
    o.Cookie.IsEssential = true;
    o.IdleTimeout = TimeSpan.FromMinutes(20);
});

// Trust X-Forwarded-* only from the default known proxies (loopback: local nginx).
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

var app = builder.Build();

app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.Run();
