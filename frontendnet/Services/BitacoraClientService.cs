using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>Read-only audit log (<c>GET /api/bitacora</c>, ordered by id DESC).</summary>
public class BitacoraClientService(HttpClient client)
{
    public async Task<List<Bitacora>> GetAsync() =>
        await client.GetFromJsonAsync<List<Bitacora>>("api/bitacora") ?? [];
}
