using System.Net.Http.Headers;
using frontendnet.Models;

namespace frontendnet.Services;

/// <summary>
/// Typed client for <c>/api/archivos</c>. Non-success statuses surface as
/// <see cref="HttpRequestException"/> with <c>StatusCode</c> (see <c>RefrescaTokenDelegatingHandler</c>).
/// </summary>
public class ArchivosClientService(HttpClient client)
{
    private const string FieldName = "file";

    /// <summary><c>GET api/archivos</c> (Administrador).</summary>
    public async Task<List<Archivo>> GetAsync() =>
        await client.GetFromJsonAsync<List<Archivo>>("api/archivos") ?? [];

    /// <summary><c>GET api/archivos/{id}/detalle</c> (Administrador).</summary>
    public async Task<Archivo?> GetAsync(int id) =>
        await client.GetFromJsonAsync<Archivo>($"api/archivos/{id}/detalle");

    /// <summary><c>GET api/archivos/{id}</c> (public) → JPEG bytes (≤ 100 KB by backend contract).</summary>
    public async Task<byte[]> GetBinaryAsync(int id) =>
        await client.GetByteArrayAsync($"api/archivos/{id}");

    /// <summary><c>POST api/archivos</c> → <c>201</c> metadata of the new file.</summary>
    public async Task<Archivo?> PostAsync(Upload upload)
    {
        using var content = CreaContenido(upload);
        using var response = await client.PostAsync("api/archivos", content);
        return await response.Content.ReadFromJsonAsync<Archivo>();
    }

    /// <summary><c>PUT api/archivos/{id}</c> → <c>204</c>.</summary>
    public async Task PutAsync(Upload upload)
    {
        using var content = CreaContenido(upload);
        using var response = await client.PutAsync($"api/archivos/{upload.ArchivoId}", content);
    }

    /// <summary><c>DELETE api/archivos/{id}</c> → <c>204</c>.</summary>
    public async Task DeleteAsync(int id)
    {
        using var response = await client.DeleteAsync($"api/archivos/{id}");
    }

    private static MultipartFormDataContent CreaContenido(Upload upload)
    {
        var portada = upload.Portada ?? throw new ArgumentException("Missing file.", nameof(upload));
        var file = new StreamContent(portada.OpenReadStream());
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        // Never forward the browser-supplied filename; the backend generates its own UUID name
        // and only needs a .jpg extension to pass its validation.
        return new MultipartFormDataContent { { file, FieldName, "portada.jpg" } };
    }
}
