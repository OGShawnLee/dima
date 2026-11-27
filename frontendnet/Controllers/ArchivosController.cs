using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>
/// Archivos CRUD (Administrador) plus the anonymous BFF image proxy (FDEC-002).
/// Backend RBAC and file validation are authoritative; the checks here only give early,
/// friendly feedback.
/// </summary>
[Authorize(Roles = "Administrador")]
public class ArchivosController(ArchivosClientService archivos, ILogger<ArchivosController> logger) : Controller
{
    public const int TamanoMaximo = 100 * 1024;
    private static readonly byte[] FirmaJpeg = [0xFF, 0xD8, 0xFF];
    private static readonly string[] ExtensionesPermitidas = [".jpg", ".jpeg"];

    private const string MensajeServicio = "El servicio no está disponible. Inténtelo más tarde.";

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        List<Archivo> lista = [];
        try
        {
            lista = await archivos.GetAsync();
        }
        catch (HttpRequestException ex)
        {
            if (Sesion(ex) is { } r) return r;
            logger.LogWarning(ex, "Could not list archivos.");
            ModelState.AddModelError(string.Empty, MensajeServicio);
        }

        return View(lista);
    }

    [HttpGet]
    public async Task<IActionResult> Detalle(int id) => await VistaArchivoAsync(id, "Detalle");

    [HttpGet]
    public IActionResult Crear() => View(new Upload());

    [HttpPost]
    public async Task<IActionResult> Crear(Upload model)
    {
        await ValidaPortadaAsync(model.Portada);
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            var creado = await archivos.PostAsync(model);
            TempData["Mensaje"] = "Imagen subida correctamente.";
            return creado?.ArchivoId is int id
                ? RedirectToAction(nameof(Detalle), new { id })
                : RedirectToAction(nameof(Index));
        }
        catch (HttpRequestException ex)
        {
            if (Sesion(ex) is { } r) return r;
            AgregaErrorBackend(ex);
            return View(model);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Editar(int id)
    {
        if (id <= 0) return NotFound();
        try
        {
            var archivo = await archivos.GetAsync(id);
            if (archivo is null) return NotFound();
            return View(new Upload { ArchivoId = id, Nombre = archivo.Nombre });
        }
        catch (HttpRequestException ex)
        {
            if (Sesion(ex) is { } r) return r;
            if (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest) return NotFound();
            logger.LogWarning(ex, "Could not load archivo {Id}.", id);
            return RedirectToAction(nameof(Index));
        }
    }

    [HttpPost]
    public async Task<IActionResult> Editar(int id, Upload model)
    {
        if (id <= 0) return NotFound();
        model.ArchivoId = id;

        await ValidaPortadaAsync(model.Portada);
        if (!ModelState.IsValid)
        {
            return View(model);
        }

        try
        {
            await archivos.PutAsync(model);
            TempData["Mensaje"] = "Imagen reemplazada correctamente.";
            return RedirectToAction(nameof(Detalle), new { id });
        }
        catch (HttpRequestException ex)
        {
            if (Sesion(ex) is { } r) return r;
            if (ex.StatusCode == HttpStatusCode.NotFound) return NotFound();
            AgregaErrorBackend(ex);
            return View(model);
        }
    }

    [HttpGet]
    public async Task<IActionResult> Eliminar(int id) => await VistaArchivoAsync(id, "Eliminar");

    [HttpPost]
    [ActionName("Eliminar")]
    public async Task<IActionResult> EliminarConfirmado(int id)
    {
        if (id <= 0) return NotFound();
        try
        {
            await archivos.DeleteAsync(id);
            TempData["Mensaje"] = "Imagen eliminada correctamente.";
            return RedirectToAction(nameof(Index));
        }
        catch (HttpRequestException ex)
        {
            if (Sesion(ex) is { } r) return r;
            if (ex.StatusCode == HttpStatusCode.NotFound) return NotFound();
            logger.LogWarning(ex, "Could not delete archivo {Id}.", id);
            ModelState.AddModelError(string.Empty, ex.StatusCode == HttpStatusCode.BadRequest
                ? "No fue posible eliminar la imagen. Verifique que no esté asignada a un producto."
                : MensajeServicio);
            return await VistaArchivoAsync(id, "Eliminar");
        }
    }

    /// <summary>
    /// Anonymous image proxy: streams <c>GET api/archivos/{id}</c> so the browser never talks to
    /// the API host. The <c>int</c> route constraint keeps callers from reaching other backend paths.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("Archivos/Imagen/{id:int}")]
    [ResponseCache(Duration = 300)]
    public async Task<IActionResult> Imagen(int id)
    {
        if (id <= 0)
        {
            return SinCache(BadRequest());
        }

        try
        {
            byte[] datos = await archivos.GetBinaryAsync(id);
            Response.Headers.XContentTypeOptions = "nosniff";
            return File(datos, "image/jpeg");
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
        {
            return SinCache(NotFound());
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Image proxy failed for archivo {Id} with status {Status}.", id, (int?)ex.StatusCode);
            return SinCache(NotFound());
        }
    }

    private IActionResult SinCache(IActionResult result)
    {
        Response.Headers.CacheControl = "no-store";
        return result;
    }

    private async Task<IActionResult> VistaArchivoAsync(int id, string vista)
    {
        if (id <= 0) return NotFound();
        try
        {
            var archivo = await archivos.GetAsync(id);
            return archivo is null ? NotFound() : View(vista, archivo);
        }
        catch (HttpRequestException ex)
        {
            if (Sesion(ex) is { } r) return r;
            if (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest) return NotFound();
            logger.LogWarning(ex, "Could not load archivo {Id}.", id);
            return RedirectToAction(nameof(Index));
        }
    }

    /// <summary>Maps an expired session (401) and missing role (403) to the auth flow.</summary>
    private IActionResult? Sesion(HttpRequestException ex) => ex.StatusCode switch
    {
        HttpStatusCode.Unauthorized => RedirectToAction("Salir", "Auth"),
        HttpStatusCode.Forbidden => RedirectToAction("AccessDenied", "Home"),
        _ => null,
    };

    private void AgregaErrorBackend(HttpRequestException ex)
    {
        logger.LogInformation("Upload rejected by backend with status {Status}.", (int?)ex.StatusCode);
        string mensaje = ex.StatusCode switch
        {
            HttpStatusCode.BadRequest or HttpStatusCode.UnsupportedMediaType =>
                "El archivo no es válido. Solo se permiten imágenes JPG de hasta 100 KB.",
            HttpStatusCode.RequestEntityTooLarge => "La imagen excede el tamaño máximo de 100 KB.",
            _ => MensajeServicio,
        };
        ModelState.AddModelError(nameof(Upload.Portada), mensaje);
    }

    /// <summary>Early checks mirroring the backend rules: size, extension, MIME type and JPEG magic bytes.</summary>
    private async Task ValidaPortadaAsync(IFormFile? portada)
    {
        const string campo = nameof(Upload.Portada);
        if (portada is null)
        {
            return; // [Required] already reports it.
        }

        if (portada.Length == 0)
        {
            ModelState.AddModelError(campo, "El archivo está vacío.");
            return;
        }

        if (portada.Length > TamanoMaximo)
        {
            ModelState.AddModelError(campo, "La imagen excede el tamaño máximo de 100 KB.");
            return;
        }

        string extension = Path.GetExtension(portada.FileName);
        if (!ExtensionesPermitidas.Contains(extension, StringComparer.OrdinalIgnoreCase)
            || !string.Equals(portada.ContentType, "image/jpeg", StringComparison.OrdinalIgnoreCase))
        {
            ModelState.AddModelError(campo, "Solo se permiten imágenes con extensión JPG.");
            return;
        }

        var cabecera = new byte[FirmaJpeg.Length];
        await using var stream = portada.OpenReadStream();
        int leidos = await stream.ReadAtLeastAsync(cabecera, cabecera.Length, throwOnEndOfStream: false);
        if (leidos < FirmaJpeg.Length || !cabecera.AsSpan().SequenceEqual(FirmaJpeg))
        {
            ModelState.AddModelError(campo, "El contenido del archivo no corresponde a una imagen JPG.");
        }
    }
}
