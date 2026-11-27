using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>
/// Typed client for <c>api/productos</c>. Non-success statuses surface as
/// <see cref="HttpRequestException"/> with <c>StatusCode</c> (via <c>RefrescaTokenDelegatingHandler</c>
/// and <c>EnsureSuccessStatusCode</c>).
/// </summary>
public class ProductosClientService(HttpClient client)
{
    /// <summary><c>GET api/productos</c> or <c>GET api/productos?s={escaped}</c>.</summary>
    public async Task<List<Producto>> GetAsync(string? search = null)
    {
        string url = string.IsNullOrWhiteSpace(search)
            ? "api/productos"
            : $"api/productos?s={Uri.EscapeDataString(search.Trim())}";
        using var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<List<Producto>>() ?? [];
    }

    /// <summary><c>GET api/productos/{id}</c>.</summary>
    public async Task<Producto> GetAsync(int id)
    {
        using var response = await client.GetAsync($"api/productos/{id}");
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Producto>()
            ?? throw new InvalidOperationException("Respuesta de producto vacía.");
    }

    /// <summary><c>POST api/productos</c> → <c>201 ProductoDto</c>. Sends only the writable fields.</summary>
    public async Task<Producto?> PostAsync(Producto producto)
    {
        using var response = await client.PostAsJsonAsync("api/productos", Cuerpo(producto));
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<Producto>();
    }

    /// <summary><c>PUT api/productos/{id}</c> → <c>204</c>.</summary>
    public async Task PutAsync(Producto producto)
    {
        int id = producto.ProductoId ?? throw new ArgumentException("Missing product id.", nameof(producto));
        using var response = await client.PutAsJsonAsync($"api/productos/{id}", Cuerpo(producto));
        response.EnsureSuccessStatusCode();
    }

    /// <summary><c>DELETE api/productos/{id}</c> → <c>204</c>.</summary>
    public async Task DeleteAsync(int id)
    {
        using var response = await client.DeleteAsync($"api/productos/{id}");
        response.EnsureSuccessStatusCode();
    }

    /// <summary><c>POST api/productos/{id}/categoria</c> (<c>{ categoriaid }</c>) → <c>204</c>; <c>409</c> if already linked.</summary>
    public async Task PostAsync(int id, int categoriaid)
    {
        using var response = await client.PostAsJsonAsync($"api/productos/{id}/categoria", new { categoriaid });
        response.EnsureSuccessStatusCode();
    }

    /// <summary><c>DELETE api/productos/{id}/categoria/{categoriaid}</c> → <c>204</c>.</summary>
    public async Task DeleteAsync(int id, int categoriaid)
    {
        using var response = await client.DeleteAsync($"api/productos/{id}/categoria/{categoriaid}");
        response.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// Explicit request body (no mass assignment): <c>precio</c> is a JSON number and the cover
    /// uses the backend's lowercase <c>archivoid</c>.
    /// </summary>
    private static object Cuerpo(Producto p) => new
    {
        titulo = p.Titulo,
        descripcion = p.Descripcion,
        precio = p.Precio ?? throw new ArgumentException("Missing price.", nameof(p)),
        archivoid = p.ArchivoId,
    };
}
