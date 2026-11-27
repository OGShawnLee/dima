using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>
/// Admin user management against <c>/api/usuarios</c>. Users are keyed by email, always
/// escaped with <see cref="Uri.EscapeDataString(string)"/> in the path. Non-2xx responses
/// surface as <see cref="HttpRequestException"/> (see <c>RefrescaTokenDelegatingHandler</c>).
/// </summary>
public class UsuariosClientService(HttpClient client)
{
    private static string Ruta(string email) => $"api/usuarios/{Uri.EscapeDataString(email)}";

    public async Task<List<Usuario>> GetAsync() =>
        await client.GetFromJsonAsync<List<Usuario>>("api/usuarios") ?? [];

    public async Task<Usuario?> GetAsync(string email) =>
        await client.GetFromJsonAsync<Usuario>(Ruta(email));

    public async Task<Usuario?> PostAsync(UsuarioPwd usuario)
    {
        using var response = await client.PostAsJsonAsync("api/usuarios", new
        {
            email = usuario.Email,
            password = usuario.Password,
            nombre = usuario.Nombre,
            rol = usuario.Rol,
        });
        return await response.Content.ReadFromJsonAsync<Usuario>();
    }

    /// <summary>Only <c>nombre</c> and <c>rol</c> are sent (no mass assignment).</summary>
    public async Task PutAsync(string email, Usuario usuario)
    {
        using var response = await client.PutAsJsonAsync(Ruta(email), new
        {
            nombre = usuario.Nombre,
            rol = usuario.Rol,
        });
    }

    public async Task DeleteAsync(string email)
    {
        using var response = await client.DeleteAsync(Ruta(email));
    }
}
