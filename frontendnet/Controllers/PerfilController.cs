using System.Net;
using System.Security.Claims;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

[Authorize]
public class PerfilController(PerfilClientService perfil, IWebHostEnvironment env) : Controller
{
    public async Task<IActionResult> IndexAsync()
    {
        string tiempo;
        try
        {
            tiempo = await perfil.ObtenTiempoAsync();
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            return RedirectToAction("Salir", "Auth");
        }
        catch (HttpRequestException)
        {
            tiempo = "No disponible";
        }

        bool mostrarJwt = env.IsDevelopment();
        var model = new AuthUser
        {
            Email = User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
            Nombre = User.FindFirstValue(ClaimTypes.GivenName) ?? string.Empty,
            Rol = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty,
            // The raw JWT never leaves the server outside Development.
            Jwt = mostrarJwt ? User.FindFirstValue("jwt") ?? string.Empty : string.Empty,
        };

        ViewBag.Tiempo = tiempo;
        ViewBag.MostrarJwt = mostrarJwt;
        return View("Index", model);
    }
}
