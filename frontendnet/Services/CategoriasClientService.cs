using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>
/// Typed client for <c>api/categorias</c>. Non-success statuses surface as
/// <see cref="HttpRequestException"/> with <c>StatusCode</c> (via <c>RefrescaTokenDelegatingHandler</c>
/// and <c>EnsureSuccessStatusCode</c>).
/// </summary>
public class CategoriasClientService(HttpClient client)
{
    /// <summary><c>GET api/categorias</c>.</summary>
    public async Task<List<Categoria>> GetAsync()
    {
        using var response = await client.GetAsync("api/categorias");
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<Categoria>>() ?? [];
    }

    /// <summary><c>GET api/categorias/{id}</c>.</summary>
    public async Task<Categoria> GetAsync(int id)
    {
        using var response = await client.GetAsync($"api/categorias/{id}");
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Categoria>()
            ?? throw new InvalidOperationException("Respuesta de categoría vacía.");
    }

    /// <summary><c>POST api/categorias</c>. Sends only <c>nombre</c> (no mass assignment).</summary>
    public async Task<Categoria?> PostAsync(Categoria categoria)
    {
        using var response = await client.PostAsJsonAsync("api/categorias", new { nombre = categoria.Nombre });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Categoria>();
    }

    /// <summary><c>PUT api/categorias/{id}</c>. Sends only <c>nombre</c>; <c>protegida</c> is never sent.</summary>
    public async Task PutAsync(Categoria categoria)
    {
        using var response = await client.PutAsJsonAsync(
            $"api/categorias/{categoria.CategoriaId}", new { nombre = categoria.Nombre });
        response.EnsureSuccessStatusCode();
    }

    /// <summary><c>DELETE api/categorias/{id}</c>. Protected categories are rejected by the backend.</summary>
    public async Task DeleteAsync(int id)
    {
        using var response = await client.DeleteAsync($"api/categorias/{id}");
        response.EnsureSuccessStatusCode();
    }
}
