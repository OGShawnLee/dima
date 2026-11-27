using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>Read-only audit log; timestamps are converted from UTC to Mexico City time.</summary>
[Authorize(Roles = "Administrador")]
public class BitacoraController(BitacoraClientService bitacora, ILogger<BitacoraController> logger) : Controller
{
    // IANA id: resolves on Linux and on .NET 10 for Windows (ICU).
    private static readonly TimeZoneInfo ZonaMexico = TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");

    [HttpGet]
    public async Task<IActionResult> IndexAsync()
    {
        List<Bitacora> lista;
        try
        {
            lista = await bitacora.GetAsync();
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            return RedirectToAction("Salir", "Auth");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Forbidden)
        {
            return RedirectToAction("AccessDenied", "Home");
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Could not load audit log (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, "No fue posible obtener la bitácora.");
            lista = [];
        }

        foreach (var item in lista)
        {
            if (item.Fecha is { } fecha)
            {
                item.Fecha = TimeZoneInfo.ConvertTime(fecha, ZonaMexico);
            }
        }

        return View("Index", lista);
    }
}
