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

// MVC with antiforgery validation on every unsafe HTTP method (POST/PUT/DELETE).
builder.Services.AddControllersWithViews(o => o.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()));
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
void ConfiguraCliente(HttpClient c) => c.BaseAddress = baseAddress;

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
