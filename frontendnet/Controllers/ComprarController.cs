using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>
/// Product catalog (card grid + <c>?s=</c> search). Browsable by <c>Usuario</c> and
/// <c>Administrador</c>; only <c>Usuario</c> sees the "Agregar al carrito" form (cart POSTs are
/// <c>Usuario</c>-only in <see cref="CarritoController"/>). Backend RBAC stays authoritative.
/// </summary>
[Authorize(Roles = "Usuario,Administrador")]
public class ComprarController(ProductosClientService productos, ILogger<ComprarController> logger) : Controller
{
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
            switch (ex.StatusCode)
            {
                case HttpStatusCode.Unauthorized: return RedirectToAction("Salir", "Auth");
                case HttpStatusCode.Forbidden: return RedirectToAction("AccessDenied", "Home");
            }

            logger.LogWarning(ex, "Unable to list the catalog (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, ex.StatusCode == HttpStatusCode.BadRequest
                ? "La búsqueda no es válida."
                : "El servicio no está disponible. Inténtelo más tarde.");
        }

        return View(lista);
    }
}
