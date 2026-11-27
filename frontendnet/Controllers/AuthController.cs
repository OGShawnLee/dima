using System.Net;
using System.Security.Claims;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

[AllowAnonymous]
public class AuthController(AuthClientService auth, ILogger<AuthController> logger) : Controller
{
    // Same text for unknown email, wrong password and throttling: never reveal whether an account exists.
    private const string MensajeGenerico =
        "No fue posible iniciar sesión. Verifique sus credenciales o inténtelo más tarde.";

    [HttpGet]
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedireccionPorRol(User.FindFirstValue(ClaimTypes.Role));
        }

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> IndexAsync(Login model)
    {
        if (!ModelState.IsValid)
        {
            return View("Index", model);
        }

        AuthUser usuario;
        try
        {
            usuario = await auth.ObtenTokenAsync(model.Email, model.Password);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.Unauthorized
                                                  or HttpStatusCode.TooManyRequests
                                                  or HttpStatusCode.BadRequest)
        {
            logger.LogInformation("Login rejected by backend with status {Status}.", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, MensajeGenerico);
            return View("Index", model);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Backend unavailable during login.");
            ModelState.AddModelError(string.Empty, "El servicio no está disponible. Inténtelo más tarde.");
            return View("Index", model);
        }

        List<Claim> claims =
        [
            new(ClaimTypes.Name, usuario.Email),
            new(ClaimTypes.GivenName, usuario.Nombre),
            new("jwt", usuario.Jwt),
            new(ClaimTypes.Role, usuario.Rol),
        ];

        await auth.IniciaSesionAsync(claims);
        return RedireccionPorRol(usuario.Rol);
    }

    [HttpGet]
    public async Task<IActionResult> SalirAsync()
    {
        HttpContext.Session.Clear();
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction("Index", "Auth");
    }

    private IActionResult RedireccionPorRol(string? rol) =>
        rol == "Administrador" ? Redirect("~/Productos") : RedirectToAction("Index", "Home");
}
