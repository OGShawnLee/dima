using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>
/// Checkout and orders (FDEC-004 / DEC-015). <c>[Authorize]</c> only shapes the UI; the backend RBAC
/// and ownership checks are authoritative (non-owner <c>Usuario</c> gets <c>404</c>). Checkout sends
/// only <c>{ productoId, cantidad }</c> pairs read from the session cart — never prices — and every
/// amount shown here comes from the backend. The POST is covered by the global
/// <c>AutoValidateAntiforgeryTokenAttribute</c> filter.
/// </summary>
[Authorize(Roles = "Usuario,Administrador")]
public class PedidosController(PedidosClientService pedidos, ILogger<PedidosController> logger) : Controller
{
    // IANA id: resolves on Linux and on .NET 10 for Windows (ICU). Same as BitacoraController.
    private static readonly TimeZoneInfo ZonaMexico = TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");

    private const string MensajeServicio = "El servicio no está disponible. Inténtelo más tarde.";

    /// <summary>All orders (Administrador).</summary>
    [HttpGet]
    [Authorize(Roles = "Administrador")]
    public async Task<IActionResult> Index()
    {
        List<Pedido> lista = [];
        try
        {
            lista = await pedidos.GetAsync();
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogWarning(ex, "Could not load orders (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, "No fue posible obtener los pedidos.");
        }

        AjustaFechas(lista);
        return View(lista);
    }

    /// <summary>The caller's own orders (Usuario).</summary>
    [HttpGet]
    [Authorize(Roles = "Usuario")]
    public async Task<IActionResult> Mios()
    {
        List<Pedido> lista = [];
        try
        {
            lista = await pedidos.GetMiosAsync();
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogWarning(ex, "Could not load own orders (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, "No fue posible obtener sus pedidos.");
        }

        AjustaFechas(lista);
        return View(lista);
    }

    /// <summary>Order detail (owner Usuario or Administrador).</summary>
    [HttpGet("Pedidos/Detalle/{id:int}")]
    public async Task<IActionResult> Detalle(int id)
    {
        if (id <= 0) return NotFound();

        PedidoDetalle? pedido;
        try
        {
            pedido = await pedidos.GetAsync(id);
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            if (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest) return NotFound();
            logger.LogWarning(ex, "Could not load order {Id} (status {Status}).", id, (int?)ex.StatusCode);
            TempData["Error"] = "No fue posible obtener el pedido.";
            return User.IsInRole("Administrador") ? RedirectToAction(nameof(Index)) : RedirectToAction(nameof(Mios));
        }

        if (pedido is null) return NotFound();
        AjustaFechas([pedido]);
        return View(pedido);
    }

    /// <summary>Checkout (Usuario): turns the session cart into a backend order.</summary>
    [HttpPost]
    [Authorize(Roles = "Usuario")]
    public async Task<IActionResult> Confirmar()
    {
        var carrito = new CarritoSessionService(HttpContext.Session);
        await carrito.CargaAsync();
        var items = carrito.Obtener();

        if (items.Count == 0)
        {
            TempData["Error"] = "Su carrito está vacío.";
            return RedirectToAction("Index", "Carrito");
        }

        Pedido creado;
        try
        {
            creado = await pedidos.CrearAsync(items);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.BadRequest)
        {
            // Unknown product or out-of-range quantity: keep the cart so the user can fix it.
            logger.LogInformation("Checkout rejected by backend validation.");
            TempData["Error"] = "No fue posible confirmar el pedido: uno o más productos ya no están disponibles " +
                                "o las cantidades no son válidas. Revise su carrito.";
            return RedirectToAction("Index", "Carrito");
        }
        catch (HttpRequestException ex)
        {
            if (Redireccion(ex) is { } r) return r;
            logger.LogWarning(ex, "Checkout failed (status {Status}).", (int?)ex.StatusCode);
            TempData["Error"] = MensajeServicio + " Su carrito se conserva.";
            return RedirectToAction("Index", "Carrito");
        }
        catch (TaskCanceledException ex)
        {
            // Timeout: the backend may or may not have stored the order, so keep the cart and point
            // the user to "Mis pedidos" before retrying (avoids a silent duplicate purchase).
            logger.LogWarning(ex, "Checkout timed out.");
            TempData["Error"] = "No se recibió respuesta del servicio. Revise \"Mis pedidos\" antes de volver " +
                                "a intentarlo; su carrito se conserva.";
            return RedirectToAction("Index", "Carrito");
        }

        carrito.Vaciar();
        TempData["Mensaje"] = $"¡Gracias por su compra! Su pedido #{creado.PedidoId} fue registrado.";
        return RedirectToAction(nameof(Detalle), new { id = creado.PedidoId });
    }

    private static void AjustaFechas(IEnumerable<Pedido> lista)
    {
        foreach (var p in lista)
        {
            if (p.Fecha is { } fecha)
            {
                p.Fecha = TimeZoneInfo.ConvertTime(fecha, ZonaMexico);
            }
        }
    }

    /// <summary>Session expired → <c>/Auth/Salir</c>; missing role → AccessDenied; otherwise <c>null</c>.</summary>
    private IActionResult? Redireccion(HttpRequestException ex) => ex.StatusCode switch
    {
        HttpStatusCode.Unauthorized => RedirectToAction("Salir", "Auth"),
        HttpStatusCode.Forbidden => RedirectToAction("AccessDenied", "Home"),
        _ => null,
    };
}
