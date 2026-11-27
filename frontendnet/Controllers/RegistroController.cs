using System.Net;
using System.Security.Claims;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace frontendnet.Controllers;

/// <summary>
/// Anonymous customer self-registration (DEC-013). Binds only <see cref="Registro"/> (no role field);
/// on <c>201</c> signs in through the regular login flow and lands on <c>/Comprar</c>.
/// The POST is covered by the global <c>AutoValidateAntiforgeryTokenAttribute</c> filter.
/// </summary>
[AllowAnonymous]
public class RegistroController(AuthClientService auth, ILogger<RegistroController> logger) : Controller
{
    // Same text for duplicates and other rejections: never reveal whether an email is registered.
    private const string MensajeGenerico = "No fue posible crear la cuenta. Verifique sus datos o inténtelo más tarde.";
    private const string MensajeValidacion =
        "No fue posible crear la cuenta. Revise que el correo sea válido y que la contraseña cumpla la política.";
    private const string MensajeLimite = "Se realizaron demasiados intentos. Espere unos minutos e inténtelo de nuevo.";
    private const string MensajeServicio = "El servicio no está disponible. Inténtelo más tarde.";

    [HttpGet]
    public IActionResult Index()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        return View();
    }

    [HttpPost]
    public async Task<IActionResult> IndexAsync([Bind(nameof(Registro.Email), nameof(Registro.Nombre),
        nameof(Registro.Password), nameof(Registro.ConfirmarPassword))] Registro model)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Index", "Home");
        }

        if (!ModelState.IsValid)
        {
            return View("Index", model);
        }

        string email = model.Email.Trim();
        string nombre = model.Nombre.Trim();

        try
        {
            await auth.RegistrarAsync(email, nombre, model.Password);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.Conflict)
        {
            logger.LogInformation("Self-registration rejected by backend (duplicate).");
            ModelState.AddModelError(string.Empty, MensajeGenerico);
            return View("Index", model);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.BadRequest)
        {
            logger.LogInformation("Self-registration rejected by backend validation.");
            ModelState.AddModelError(string.Empty, MensajeValidacion);
            return View("Index", model);
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.TooManyRequests)
        {
            logger.LogInformation("Self-registration throttled by backend.");
            ModelState.AddModelError(string.Empty, MensajeLimite);
            return View("Index", model);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Backend unavailable during self-registration (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, MensajeServicio);
            return View("Index", model);
        }

        // Account created: sign in exactly like /Auth does.
        AuthUser usuario;
        try
        {
            usuario = await auth.ObtenTokenAsync(email, model.Password);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Account created but automatic sign-in failed (status {Status}).", (int?)ex.StatusCode);
            return View("Creada");
        }

        List<Claim> claims =
        [
            new(ClaimTypes.Name, usuario.Email),
            new(ClaimTypes.GivenName, usuario.Nombre),
            new("jwt", usuario.Jwt),
            new(ClaimTypes.Role, usuario.Rol),
        ];

        await auth.IniciaSesionAsync(claims);
        return usuario.Rol == "Usuario"
            ? RedirectToAction("Index", "Comprar")
            : RedirectToAction("Index", "Home");
    }
}
