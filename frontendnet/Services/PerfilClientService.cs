namespace frontendnet.Services;

public class PerfilClientService(HttpClient client)
{
    /// <summary><c>GET api/auth/tiempo</c> → plain text <c>"00:MM:SS"</c>.</summary>
    public async Task<string> ObtenTiempoAsync()
    {
        using var response = await client.GetAsync("api/auth/tiempo");
        return (await response.Content.ReadAsStringAsync()).Trim();
    }
}
