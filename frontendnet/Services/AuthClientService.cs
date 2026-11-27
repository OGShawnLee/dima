using System.Security.Claims;
using frontendnet.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace frontendnet.Services;

/// <summary>
/// Login against <c>POST api/auth</c> and cookie sign-in. Registered with only the
/// <c>ReenviaIpDelegatingHandler</c> (login is unauthenticated).
/// </summary>
public class AuthClientService(HttpClient client, IHttpContextAccessor httpContextAccessor)
{
    public async Task<AuthUser> ObtenTokenAsync(string email, string password)
    {
        using var response = await client.PostAsJsonAsync("api/auth", new { email, password });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<AuthUser>()
            ?? throw new InvalidOperationException("Respuesta de autenticación vacía.");
    }

    /// <summary>
    /// Writes the encrypted <c>.frontendnet</c> cookie. Returns <see cref="Task"/> and must be awaited
    /// so <c>Set-Cookie</c> is written before any redirect (PDF fix #1).
    /// </summary>
    public async Task IniciaSesionAsync(List<Claim> claims)
    {
        var httpContext = httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("No hay un HttpContext activo.");

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = false, AllowRefresh = true });
    }
}
