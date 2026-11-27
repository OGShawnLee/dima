using System.ComponentModel.DataAnnotations;
using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace frontendnet.Controllers;

/// <summary>
/// Session cart (FDEC-004), <c>Usuario</c> only. Every POST is covered by the global
/// <c>AutoValidateAntiforgeryTokenAttribute</c> filter. Inputs are explicit, range-validated
/// parameters (no model binding of prices or titles); prices are re-read from
/// <c>GET api/productos/{id}</c> on every render and are display only. Flash messages travel in the
/// TempData cookie, so they never include product titles or prices.
/// </summary>
[Authorize(Roles = "Usuario")]
public class CarritoController(ProductosClientService productos, ILogger<CarritoController> logger) : Controller
{
    private const string MensajeServicio = "El servicio no está disponible. Inténtelo más tarde.";
    private const string MensajeCantidad = "La cantidad debe ser un número entero entre 1 y 99.";
    private const string MensajeProducto = "El producto seleccionado no es válido.";
    private const string MensajeInexistente = "El producto seleccionado ya no existe; no se agregó al carrito.";
    private const int BusquedaMaxima = 255;

    [HttpGet]
    public async Task<IActionResult> Index()
    {
        var carrito = await CarritoAsync();
        var items = carrito.Obtener();
        var modelo = new CarritoViewModel { Elementos = items.Count };
        var inexistentes = new List<int>();

        foreach (var item in items)
        {
            try
            {
                var producto = await productos.GetAsync(item.ProductoId);
                modelo.Lineas.Add(new CarritoLinea { Producto = producto, Cantidad = item.Cantidad });
            }
            catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            {
                inexistentes.Add(item.ProductoId);
            }
            catch (HttpRequestException ex)
            {
                if (Redireccion(ex) is { } r) return r;
                // Backend unavailable: keep the cart intact and only warn.
                logger.LogWarning(ex, "Unable to load cart product {Id} (status {Status}).",
                    item.ProductoId, (int?)ex.StatusCode);
                modelo.PreciosNoDisponibles = true;
                break;
            }
        }

        if (inexistentes.Count > 0)
        {
            carrito.Quitar([.. inexistentes]);
            modelo.Elementos -= inexistentes.Count;
            modelo.Avisos.Add(inexistentes.Count == 1
                ? "Un producto de su carrito ya no está disponible y fue retirado."
                : $"{inexistentes.Count} productos de su carrito ya no están disponibles y fueron retirados.");
        }
        else
        {
            carrito.Sincronizar();
        }

        return View(modelo);
    }

    [HttpPost]
    public async Task<IActionResult> Agregar(
        [Required, Range(1, int.MaxValue)] int? productoId,
        [Required, Range(CarritoItem.CantidadMinima, CarritoItem.CantidadMaxima)] int? cantidad,
        string? s)
    {
        string? busqueda = string.IsNullOrWhiteSpace(s) || s.Length > BusquedaMaxima ? null : s.Trim();
        var volver = RedirectToAction("Index", "Comprar", new { s = busqueda });

        if (!ModelState.IsValid || productoId is not int id || cantidad is not int unidades)
        {
            TempData["Error"] = ModelState.GetFieldValidationState(nameof(productoId)) == ModelValidationState.Invalid
                ? MensajeProducto
                : MensajeCantidad;
            return volver;
        }

        // Never trust a posted id: the product must exist in the backend right now.
        try
        {
            await productos.GetAsync(id);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
        {
            logger.LogInformation("Ignored cart add for missing product {Id}.", id);
            TempData["Error"] = MensajeInexistente;
            return volver;
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogWarning(ex, "Unable to verify product {Id} (status {Status}).", id, (int?)ex.StatusCode);
            TempData["Error"] = MensajeServicio;
            return volver;
        }

        var carrito = await CarritoAsync();
        switch (carrito.Agregar(id, unidades))
        {
            case CarritoResultado.Ok:
                TempData["Mensaje"] = "Producto agregado al carrito.";
                break;
            case CarritoResultado.LimiteElementos:
                TempData["Error"] = $"El carrito admite como máximo {CarritoSessionService.MaximoElementos} productos distintos.";
                break;
            case CarritoResultado.LimiteCantidad:
                TempData["Error"] = $"No puede tener más de {CarritoItem.CantidadMaxima} unidades del mismo producto en el carrito.";
                break;
        }

        return volver;
    }

    [HttpPost]
    public async Task<IActionResult> Actualizar(
        [Required, Range(1, int.MaxValue)] int? productoId,
        [Required, Range(CarritoItem.CantidadMinima, CarritoItem.CantidadMaxima)] int? cantidad)
    {
        if (!ModelState.IsValid || productoId is not int id || cantidad is not int unidades)
        {
            TempData["Error"] = MensajeCantidad;
            return RedirectToAction(nameof(Index));
        }

        var carrito = await CarritoAsync();
        if (carrito.Actualizar(id, unidades) == CarritoResultado.Ok)
        {
            TempData["Mensaje"] = "Cantidad actualizada.";
        }
        else
        {
            TempData["Error"] = "El producto no está en su carrito.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    public async Task<IActionResult> Quitar([Required, Range(1, int.MaxValue)] int? productoId)
    {
        if (!ModelState.IsValid || productoId is not int id)
        {
            TempData["Error"] = MensajeProducto;
            return RedirectToAction(nameof(Index));
        }

        var carrito = await CarritoAsync();
        if (carrito.Quitar(id) == CarritoResultado.Ok)
        {
            TempData["Mensaje"] = "Producto retirado del carrito.";
        }
        else
        {
            TempData["Error"] = "El producto no está en su carrito.";
        }

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    public async Task<IActionResult> Vaciar()
    {
        var carrito = await CarritoAsync();
        carrito.Vaciar();
        TempData["Mensaje"] = "Se vació el carrito.";
        return RedirectToAction(nameof(Index));
    }

    private async Task<CarritoSessionService> CarritoAsync()
    {
        var carrito = new CarritoSessionService(HttpContext.Session);
        await carrito.CargaAsync();
        return carrito;
    }

    /// <summary>Session expired → <c>/Auth/Salir</c>; missing role → AccessDenied; otherwise <c>null</c>.</summary>
    private IActionResult? Redireccion(HttpRequestException ex) => ex.StatusCode switch
    {
        HttpStatusCode.Unauthorized => RedirectToAction("Salir", "Auth"),
        HttpStatusCode.Forbidden => RedirectToAction("AccessDenied", "Home"),
        _ => null,
    };
}
