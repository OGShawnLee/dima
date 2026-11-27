using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>Read-only role catalog (<c>GET /api/roles</c>).</summary>
public class RolesClientService(HttpClient client)
{
    public async Task<List<Rol>> GetAsync() =>
        await client.GetFromJsonAsync<List<Rol>>("api/roles") ?? [];
}
