using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>
/// Productos CRUD plus the M:N category workflow. <c>[Authorize]</c> only shapes the UI; the backend
/// RBAC is authoritative. Every backend call (dropdown loaders included, PDF fix #8) catches
/// <see cref="HttpRequestException"/>: <c>401</c> → <c>/Auth/Salir</c>, <c>403</c> → AccessDenied,
/// <c>404</c> → NotFound, <c>400</c>/<c>409</c> → ModelState error + redisplay.
/// </summary>
[Authorize(Roles = "Administrador")]
public class ProductosController(
    ProductosClientService productos,
    ArchivosClientService archivos,
    CategoriasClientService categorias,
    ILogger<ProductosController> logger) : Controller
{
    private const string MensajeServicio = "El servicio no está disponible. Inténtelo más tarde.";
    private const int BusquedaMaxima = 255;

    [HttpGet]
    public async Task<IActionResult> Index(string? s)
    {
        string? busqueda = string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        ViewData["Busqueda"] = busqueda;
        List<Producto> lista = [];

        if (busqueda is { Length: > BusquedaMaxima })
        {
            ModelState.AddModelError(string.Empty, $"La búsqueda admite como máximo {BusquedaMaxima} caracteres.");
            return View(lista);
        }

        try
        {
            lista = await productos.GetAsync(busqueda);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogWarning(ex, "Unable to list products (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, ex.StatusCode == HttpStatusCode.BadRequest
                ? "La búsqueda no es válida."
                : MensajeServicio);
            return View(lista);
        }

        var nombres = await NombresArchivosAsync();
        if (nombres is null) return RedirectToAction("Salir", "Auth");
        ViewData["NombresArchivos"] = nombres;
        return View(lista);
    }

    [HttpGet]
    public async Task<IActionResult> Detalle(int id) => await VistaProductoAsync(id, "Detalle");

    [HttpGet]
    public async Task<IActionResult> Crear()
    {
        var modelo = new Producto();
        return await CargaArchivosAsync(modelo) ?? View(modelo);
    }

    [HttpPost]
    public async Task<IActionResult> Crear([Bind("Titulo,Descripcion,Precio,ArchivoId")] Producto model)
    {
        if (!ModelState.IsValid)
        {
            return await CargaArchivosAsync(model) ?? View(model);
        }

        Producto? creado;
        try
        {
            creado = await productos.PostAsync(model);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            ModelState.AddModelError(string.Empty, MensajeEscritura(ex));
            return await CargaArchivosAsync(model) ?? View(model);
        }

        TempData["Mensaje"] = "Producto creado correctamente.";
        return creado?.ProductoId is int id
            ? RedirectToAction(nameof(Detalle), new { id })
            : RedirectToAction(nameof(Index));
    }

    [HttpGet]
    public async Task<IActionResult> Editar(int id)
    {
        if (id <= 0) return NotFound();
        Producto producto;
        try
        {
            producto = await productos.GetAsync(id);
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
        }

        return await CargaArchivosAsync(producto) ?? View(producto);
    }

    [HttpPost]
    public async Task<IActionResult> Editar(int id, [Bind("Titulo,Descripcion,Precio,ArchivoId")] Producto model)
    {
        if (id <= 0) return NotFound();
        model.ProductoId = id;
        if (!ModelState.IsValid)
        {
            return await CargaArchivosAsync(model) ?? View(model);
        }

        try
        {
            await productos.PutAsync(model);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            ModelState.AddModelError(string.Empty, MensajeEscritura(ex));
            return await CargaArchivosAsync(model) ?? View(model);
        }

        TempData["Mensaje"] = "Producto actualizado correctamente.";
        return RedirectToAction(nameof(Detalle), new { id });
    }

    [HttpGet]
    public async Task<IActionResult> Eliminar(int id) => await VistaProductoAsync(id, "Eliminar");

    [HttpPost]
    [ActionName("Eliminar")]
    public async Task<IActionResult> EliminarConfirmado(int id)
    {
        if (id <= 0) return NotFound();
        try
        {
            await productos.DeleteAsync(id);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogInformation("Product {Id} deletion rejected with status {Status}.", id, (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, ex.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict
                ? "No se puede eliminar este producto: está en uso."
                : MensajeServicio);
            return await VistaProductoAsync(id, "Eliminar");
        }

        TempData["Mensaje"] = "Producto eliminado correctamente.";
        return RedirectToAction(nameof(Index));
    }

    /// <summary>Lists the product's categories with add/remove actions.</summary>
    [HttpGet]
    public async Task<IActionResult> Categorias(int id) => await VistaProductoAsync(id, "Categorias");

    [HttpGet]
    public async Task<IActionResult> CategoriasAgregar(int id)
    {
        if (id <= 0) return NotFound();
        var modelo = new ProductoCategoria();
        return await CargaAgregarAsync(id, modelo) ?? View(modelo);
    }

    [HttpPost]
    public async Task<IActionResult> CategoriasAgregar(int id, [Bind("CategoriaId")] ProductoCategoria model)
    {
        if (id <= 0) return NotFound();
        if (!ModelState.IsValid || model.CategoriaId is not int categoriaid)
        {
            return await CargaAgregarAsync(id, model) ?? View(model);
        }

        try
        {
            await productos.PostAsync(id, categoriaid);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogInformation("Category {CategoriaId} assignment to product {Id} rejected with status {Status}.",
                categoriaid, id, (int?)ex.StatusCode);
            ModelState.AddModelError(nameof(ProductoCategoria.CategoriaId), ex.StatusCode switch
            {
                HttpStatusCode.Conflict => "La categoría ya está asignada a este producto.",
                HttpStatusCode.BadRequest => "La categoría seleccionada no es válida.",
                _ => MensajeServicio,
            });
            return await CargaAgregarAsync(id, model) ?? View(model);
        }

        TempData["Mensaje"] = "Categoría asignada correctamente.";
        return RedirectToAction(nameof(Categorias), new { id });
    }

    [HttpGet]
    public async Task<IActionResult> CategoriasRemover(int id, int categoriaid)
    {
        if (id <= 0 || categoriaid <= 0) return NotFound();
        var (resultado, modelo) = await CargaRemoverAsync(id, categoriaid);
        return resultado ?? View(modelo);
    }

    [HttpPost]
    [ActionName("CategoriasRemover")]
    public async Task<IActionResult> CategoriasRemoverConfirmado(int id, int categoriaid)
    {
        if (id <= 0 || categoriaid <= 0) return NotFound();
        try
        {
            await productos.DeleteAsync(id, categoriaid);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogInformation("Category {CategoriaId} removal from product {Id} rejected with status {Status}.",
                categoriaid, id, (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, ex.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict
                ? "No fue posible quitar la categoría de este producto."
                : MensajeServicio);
            var (resultado, modelo) = await CargaRemoverAsync(id, categoriaid);
            return resultado ?? View(modelo);
        }

        TempData["Mensaje"] = "Categoría removida correctamente.";
        return RedirectToAction(nameof(Categorias), new { id });
    }

    private async Task<IActionResult> VistaProductoAsync(int id, string vista)
    {
        if (id <= 0) return NotFound();
        Producto producto;
        try
        {
            producto = await productos.GetAsync(id);
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
        }

        if (producto.ArchivoId is not null)
        {
            var nombres = await NombresArchivosAsync();
            if (nombres is null) return RedirectToAction("Salir", "Auth");
            ViewData["NombresArchivos"] = nombres;
        }

        return View(vista, producto);
    }

    /// <summary>
    /// Loads the cover dropdown (PDF fix #8). Returns a redirect when the session expired or the
    /// role is missing; otherwise <c>null</c> (a backend outage only shows a message).
    /// </summary>
    private async Task<IActionResult?> CargaArchivosAsync(Producto model)
    {
        List<Archivo> lista = [];
        try
        {
            lista = await archivos.GetAsync();
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogWarning(ex, "Unable to load the cover dropdown (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, "No fue posible cargar la lista de portadas.");
        }

        // Keep a cover that is no longer listed selectable, so editing never silently drops it.
        if (model.ArchivoId is int actual && lista.All(a => a.ArchivoId != actual))
        {
            lista.Insert(0, new Archivo { ArchivoId = actual, Nombre = $"Imagen {actual}" });
        }

        ViewData["Archivos"] = lista;
        return null;
    }

    /// <summary>Loads the product and the categories it does not have yet.</summary>
    private async Task<IActionResult?> CargaAgregarAsync(int id, ProductoCategoria model)
    {
        try
        {
            model.Producto = await productos.GetAsync(id);
            var asignadas = (model.Producto.Categorias ?? []).Select(c => c.CategoriaId).ToHashSet();
            ViewData["Categorias"] = (await categorias.GetAsync())
                .Where(c => !asignadas.Contains(c.CategoriaId))
                .OrderBy(c => c.Nombre, StringComparer.CurrentCultureIgnoreCase)
                .ToList();
            return null;
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
        }
    }

    private async Task<(IActionResult? Resultado, ProductoCategoria Modelo)> CargaRemoverAsync(int id, int categoriaid)
    {
        var modelo = new ProductoCategoria { CategoriaId = categoriaid };
        try
        {
            modelo.Producto = await productos.GetAsync(id);
        }
        catch (HttpRequestException ex)
        {
            return (Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex), modelo);
        }

        var categoria = modelo.Producto.Categorias?.FirstOrDefault(c => c.CategoriaId == categoriaid);
        if (categoria is null)
        {
            return (NotFound(), modelo);
        }

        modelo.Nombre = categoria.Nombre;
        return (null, modelo);
    }

    /// <summary>
    /// Archivo names used as <c>?v=</c> cache-busters for cover thumbnails. <c>null</c> means the
    /// session expired; any other failure just yields no cache-buster.
    /// </summary>
    private async Task<Dictionary<int, string>?> NombresArchivosAsync()
    {
        try
        {
            return (await archivos.GetAsync())
                .Where(a => a.ArchivoId is not null && a.Nombre is not null)
                .ToDictionary(a => a.ArchivoId!.Value, a => a.Nombre!);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            return null;
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Unable to load archivo names (status {Status}).", (int?)ex.StatusCode);
            return [];
        }
    }

    /// <summary>Maps session/authorization/not-found statuses to a result; <c>null</c> means "handle locally".</summary>
    private IActionResult? Redireccion(HttpRequestException ex, bool notFoundOn400 = false) => ex.StatusCode switch
    {
        HttpStatusCode.Unauthorized => RedirectToAction("Salir", "Auth"),
        HttpStatusCode.Forbidden => RedirectToAction("AccessDenied", "Home"),
        HttpStatusCode.NotFound => NotFound(),
        // An invalid id on a read is just a missing resource for the user.
        HttpStatusCode.BadRequest when notFoundOn400 => NotFound(),
        _ => null,
    };

    private IActionResult ErrorServicio(HttpRequestException ex)
    {
        logger.LogWarning(ex, "Products backend call failed (status {Status}).", (int?)ex.StatusCode);
        TempData["Error"] = MensajeServicio;
        return RedirectToAction(nameof(Index));
    }

    private static string MensajeEscritura(HttpRequestException ex) => ex.StatusCode switch
    {
        HttpStatusCode.BadRequest => "Los datos enviados no son válidos. Revise el producto y la portada seleccionada.",
        HttpStatusCode.Conflict => "El producto no pudo guardarse porque entra en conflicto con otro registro.",
        _ => MensajeServicio,
    };
}
