namespace frontendnet.Middlewares;

/// <summary>
/// Forwards the browser IP to the backend as <c>X-Forwarded-For</c> (FDEC-006) so the backend
/// rate limiter and <c>bitacora</c> see the real client instead of the BFF host.
/// The value comes from <c>Connection.RemoteIpAddress</c>, which <c>UseForwardedHeaders</c>
/// only rewrites when the request arrives from a trusted (loopback) proxy.
/// </summary>
public class ReenviaIpDelegatingHandler(IHttpContextAccessor httpContextAccessor) : DelegatingHandler
{
    private const string ForwardedForHeader = "X-Forwarded-For";

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // Never pass through a client-supplied chain; send exactly one hop.
        request.Headers.Remove(ForwardedForHeader);

        var remoteIp = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress;
        if (remoteIp is not null)
        {
            if (remoteIp.IsIPv4MappedToIPv6)
            {
                remoteIp = remoteIp.MapToIPv4();
            }

            request.Headers.TryAddWithoutValidation(ForwardedForHeader, remoteIp.ToString());
        }

        return base.SendAsync(request, cancellationToken);
    }
}
