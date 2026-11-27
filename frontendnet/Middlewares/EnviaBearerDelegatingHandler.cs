using System.Net.Http.Headers;
using System.Security.Claims;

namespace frontendnet.Middlewares;

/// <summary>
/// Attaches the JWT stored in the encrypted cookie claims as <c>Authorization: Bearer</c>.
/// </summary>
public class EnviaBearerDelegatingHandler(IHttpContextAccessor httpContextAccessor) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        string? jwt = httpContextAccessor.HttpContext?.User.FindFirstValue("jwt");
        if (!string.IsNullOrWhiteSpace(jwt))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        }

        return base.SendAsync(request, cancellationToken);
    }
}
