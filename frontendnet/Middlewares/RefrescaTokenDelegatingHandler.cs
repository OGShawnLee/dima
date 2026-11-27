using System.Security.Claims;
using System.Text;
using System.Text.Json;
using frontendnet.Services;

namespace frontendnet.Middlewares;

/// <summary>
/// Implements the sliding JWT refresh: when the backend returns <c>Set-Authorization</c>,
/// the new token is stored in the encrypted <c>.frontendnet</c> cookie before the
/// response flows back to the controller. Non-success statuses surface as
/// <see cref="HttpRequestException"/> (with <c>StatusCode</c>) so controllers can
/// redirect <c>401</c> to <c>/Auth/Salir</c>.
/// </summary>
public class RefrescaTokenDelegatingHandler(
    IHttpContextAccessor httpContextAccessor,
    AuthClientService auth,
    ILogger<RefrescaTokenDelegatingHandler> logger) : DelegatingHandler
{
    private const string SetAuthorizationHeader = "Set-Authorization";
    private const string RoleClaimUri = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
    private const string GivenNameClaimUri = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname";

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = await base.SendAsync(request, cancellationToken);

        if (response.IsSuccessStatusCode
            && response.Headers.TryGetValues(SetAuthorizationHeader, out var values))
        {
            string? jwt = values.FirstOrDefault()?.Trim();
            var user = httpContextAccessor.HttpContext?.User;
            if (!string.IsNullOrWhiteSpace(jwt) && user?.Identity?.IsAuthenticated == true)
            {
                await RenuevaCookieAsync(user, jwt);
            }
        }

        response.EnsureSuccessStatusCode();
        return response;
    }

    private async Task RenuevaCookieAsync(ClaimsPrincipal user, string jwt)
    {
        // The backend re-reads the user from MySQL before refreshing, so prefer the
        // (possibly updated) name and role from the new token; fall back to current claims.
        var payload = LeePayload(jwt);
        string email = user.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
        string nombre = Lee(payload, GivenNameClaimUri) ?? user.FindFirstValue(ClaimTypes.GivenName) ?? string.Empty;
        string rol = Lee(payload, RoleClaimUri) ?? user.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        List<Claim> claims =
        [
            new(ClaimTypes.Name, email),
            new(ClaimTypes.GivenName, nombre),
            new("jwt", jwt),
            new(ClaimTypes.Role, rol),
        ];

        await auth.IniciaSesionAsync(claims);
        logger.LogInformation("JWT refreshed through Set-Authorization; cookie re-issued.");
    }

    private static string? Lee(Dictionary<string, JsonElement>? payload, string key) =>
        payload is not null
        && payload.TryGetValue(key, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    /// <summary>
    /// Decodes (does not validate) the JWT payload. The token was received directly from the
    /// backend over the server-to-server channel; the backend remains the only verifier.
    /// </summary>
    private static Dictionary<string, JsonElement>? LeePayload(string jwt)
    {
        try
        {
            var parts = jwt.Split('.');
            if (parts.Length != 3)
            {
                return null;
            }

            string base64 = parts[1].Replace('-', '+').Replace('_', '/');
            base64 = base64.PadRight(base64.Length + ((4 - (base64.Length % 4)) % 4), '=');
            string json = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
            return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
        }
        catch (Exception ex) when (ex is FormatException or JsonException or ArgumentException)
        {
            return null;
        }
    }
}
