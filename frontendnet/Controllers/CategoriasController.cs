using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>
/// Categorías CRUD. <c>[Authorize]</c> only shapes the UI; the backend RBAC is authoritative.
/// Every backend call catches <see cref="HttpRequestException"/>: <c>401</c> → <c>/Auth/Salir</c>,
/// <c>403</c> → AccessDenied, <c>404</c> → NotFound, <c>400</c>/<c>409</c> → ModelState error + redisplay.
/// </summary>
[Authorize(Roles = "Administrador")]
public class CategoriasController(CategoriasClientService categorias, ILogger<CategoriasController> logger) : Controller
{
    private const string MensajeServicio = "El servicio no está disponible. Inténtelo más tarde.";

    [HttpGet]
    public async Task<IActionResult> IndexAsync()
    {
        List<Categoria> lista = [];
        try
        {
            lista = await categorias.GetAsync();
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } resultado)
            {
                return resultado;
            }

            logger.LogWarning(ex, "Unable to list categories (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, MensajeServicio);
        }

        return View("Index", lista);
    }

    [HttpGet]
    public async Task<IActionResult> DetalleAsync(int id)
    {
        try
        {
            return View("Detalle", await categorias.GetAsync(id));
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
        }
    }

    [HttpGet]
    public IActionResult Crear() => View("Crear");

    [HttpPost]
    public async Task<IActionResult> CrearAsync([Bind("Nombre")] Categoria model)
    {
        if (!ModelState.IsValid)
        {
            return View("Crear", model);
        }

        try
        {
            await categorias.PostAsync(model);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } resultado)
            {
                return resultado;
            }

            ModelState.AddModelError(string.Empty, MensajeEscritura(ex));
            return View("Crear", model);
        }

        TempData["Mensaje"] = "Categoría creada correctamente.";
        return RedirectToAction("Index");
    }

    [HttpGet]
    public async Task<IActionResult> EditarAsync(int id)
    {
        try
        {
            return View("Editar", await categorias.GetAsync(id));
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
        }
    }

    [HttpPost]
    public async Task<IActionResult> EditarAsync(int id, [Bind("Nombre")] Categoria model)
    {
        model.CategoriaId = id;
        if (!ModelState.IsValid)
        {
            return View("Editar", model);
        }

        try
        {
            await categorias.PutAsync(model);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } resultado)
            {
                return resultado;
            }

            ModelState.AddModelError(string.Empty, MensajeEscritura(ex));
            return View("Editar", model);
        }

        TempData["Mensaje"] = "Categoría actualizada correctamente.";
        return RedirectToAction("Index");
    }

    [HttpGet]
    public async Task<IActionResult> EliminarAsync(int id)
    {
        try
        {
            return View("Eliminar", await categorias.GetAsync(id));
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
        }
    }

    [HttpPost]
    [ActionName("Eliminar")]
    public async Task<IActionResult> EliminarConfirmadoAsync(int id)
    {
        try
        {
            await categorias.DeleteAsync(id);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.BadRequest
                                                  or HttpStatusCode.Forbidden
                                                  or HttpStatusCode.Conflict)
        {
            // The backend rejects protected categories (400) and the role check may answer 403:
            // show the refusal on the page instead of crashing.
            logger.LogInformation("Category {Id} deletion rejected with status {Status}.", id, (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, ex.StatusCode == HttpStatusCode.Forbidden
                ? "No tiene permisos para eliminar esta categoría."
                : "No se puede eliminar esta categoría: está protegida o en uso.");
            return await RedisplayEliminarAsync(id);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } resultado)
            {
                return resultado;
            }

            ModelState.AddModelError(string.Empty, MensajeServicio);
            return await RedisplayEliminarAsync(id);
        }

        TempData["Mensaje"] = "Categoría eliminada correctamente.";
        return RedirectToAction("Index");
    }

    private async Task<IActionResult> RedisplayEliminarAsync(int id)
    {
        try
        {
            return View("Eliminar", await categorias.GetAsync(id));
        }
        catch (HttpRequestException ex)
        {
            return Redireccion(ex, notFoundOn400: true) ?? ErrorServicio(ex);
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
        logger.LogWarning(ex, "Categories backend call failed (status {Status}).", (int?)ex.StatusCode);
        TempData["Error"] = MensajeServicio;
        return RedirectToAction("Index");
    }

    private static string MensajeEscritura(HttpRequestException ex) => ex.StatusCode switch
    {
        HttpStatusCode.BadRequest => "Los datos enviados no son válidos. Revise el nombre de la categoría.",
        HttpStatusCode.Conflict => "Ya existe una categoría con ese nombre.",
        _ => MensajeServicio,
    };
}
