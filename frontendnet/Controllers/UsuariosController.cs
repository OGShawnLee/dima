using System.Net;
using frontendnet.Models;
using frontendnet.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace frontendnet.Controllers;

/// <summary>
/// Admin user CRUD keyed by email (route parameter <c>id</c>, PDF fix #4). The backend is
/// authoritative: it rejects edits/deletes of <c>protegido</c> users and of the caller's own
/// account with <c>403</c>; this controller only hides those actions in the UI and maps
/// the backend status codes to Spanish form errors.
/// </summary>
[Authorize(Roles = "Administrador")]
public class UsuariosController(
    UsuariosClientService usuarios,
    RolesClientService roles,
    ILogger<UsuariosController> logger) : Controller
{
    private const string MensajeTempData = "Mensaje";

    [HttpGet]
    public async Task<IActionResult> IndexAsync()
    {
        List<Usuario> lista;
        try
        {
            lista = await usuarios.GetAsync();
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
            logger.LogWarning(ex, "Could not load users (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, "No fue posible obtener la lista de usuarios.");
            lista = [];
        }

        return View("Index", lista);
    }

    [HttpGet]
    public async Task<IActionResult> DetalleAsync(string id)
    {
        var resultado = await CargaUsuarioAsync(id);
        if (resultado.Accion is not null)
        {
            return resultado.Accion;
        }

        ViewBag.PuedeEditar = PuedeEditar(id);
        return View("Detalle", resultado.Usuario);
    }

    [HttpGet]
    public async Task<IActionResult> CrearAsync()
    {
        var redireccion = await RolesDropDownListAsync();
        if (redireccion is not null)
        {
            return redireccion;
        }

        return View("Crear");
    }

    [HttpPost]
    public async Task<IActionResult> CrearAsync(UsuarioPwd itemToCreate)
    {
        if (ModelState.IsValid)
        {
            try
            {
                await usuarios.PostAsync(itemToCreate);
                TempData[MensajeTempData] = "Usuario creado correctamente.";
                return RedirectToAction("Index");
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
            {
                return RedirectToAction("Salir", "Auth");
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Conflict)
            {
                ModelState.AddModelError(nameof(UsuarioPwd.Email), "Ya existe un usuario registrado con ese correo electrónico.");
            }
            catch (HttpRequestException ex)
            {
                AgregaError(ex, "crear");
            }
        }

        var redireccion = await RolesDropDownListAsync(itemToCreate.Rol);
        if (redireccion is not null)
        {
            return redireccion;
        }

        // Password inputs are rendered without a value attribute, so the password is never echoed back.
        return View("Crear", itemToCreate);
    }

    [HttpGet]
    public async Task<IActionResult> EditarAsync(string id)
    {
        var resultado = await CargaUsuarioAsync(id);
        if (resultado.Accion is not null)
        {
            return resultado.Accion;
        }

        var redireccion = await RolesDropDownListAsync(resultado.Usuario!.Rol);
        if (redireccion is not null)
        {
            return redireccion;
        }

        ViewBag.PuedeEditar = PuedeEditar(id);
        return View("Editar", resultado.Usuario);
    }

    [HttpPost]
    public async Task<IActionResult> EditarAsync(string id, Usuario itemToEdit)
    {
        // The route identifies the user; any email posted in the body is ignored.
        itemToEdit.Email = id;
        ModelState.Remove(nameof(Usuario.Email));

        if (ModelState.IsValid)
        {
            try
            {
                await usuarios.PutAsync(id, itemToEdit);
                TempData[MensajeTempData] = "Usuario actualizado correctamente.";
                return RedirectToAction("Index");
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
            {
                return RedirectToAction("Salir", "Auth");
            }
            catch (HttpRequestException ex)
            {
                AgregaError(ex, "editar");
            }
        }

        var redireccion = await RolesDropDownListAsync(itemToEdit.Rol);
        if (redireccion is not null)
        {
            return redireccion;
        }

        ViewBag.PuedeEditar = PuedeEditar(id);
        return View("Editar", itemToEdit);
    }

    [HttpGet]
    public async Task<IActionResult> EliminarAsync(string id)
    {
        var resultado = await CargaUsuarioAsync(id);
        if (resultado.Accion is not null)
        {
            return resultado.Accion;
        }

        ViewBag.PuedeEditar = PuedeEditar(id);
        return View("Eliminar", resultado.Usuario);
    }

    [HttpPost]
    [ActionName("Eliminar")]
    public async Task<IActionResult> EliminarConfirmadoAsync(string id)
    {
        try
        {
            await usuarios.DeleteAsync(id);
            TempData[MensajeTempData] = "Usuario eliminado correctamente.";
            return RedirectToAction("Index");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            return RedirectToAction("Salir", "Auth");
        }
        catch (HttpRequestException ex)
        {
            AgregaError(ex, "eliminar");
        }

        var resultado = await CargaUsuarioAsync(id);
        if (resultado.Accion is not null)
        {
            return resultado.Accion;
        }

        ViewBag.PuedeEditar = PuedeEditar(id);
        return View("Eliminar", resultado.Usuario);
    }

    private bool PuedeEditar(string email) =>
        !string.Equals(User.Identity?.Name, email, StringComparison.OrdinalIgnoreCase);

    private void AgregaError(HttpRequestException ex, string operacion)
    {
        logger.LogInformation("User {Operacion} rejected by backend with status {Status}.", operacion, (int?)ex.StatusCode);
        string mensaje = ex.StatusCode switch
        {
            HttpStatusCode.BadRequest => "Los datos enviados no son válidos. Revise el formulario.",
            HttpStatusCode.Forbidden => $"No es posible {operacion} este usuario: está protegido o es su propia cuenta.",
            HttpStatusCode.NotFound => "El usuario ya no existe.",
            HttpStatusCode.Conflict => "Ya existe un usuario registrado con ese correo electrónico.",
            _ => "El servicio no está disponible. Inténtelo más tarde.",
        };
        ModelState.AddModelError(string.Empty, mensaje);
    }

    /// <summary>Loads one user or returns the action to take (logout, 404, generic error).</summary>
    private async Task<(Usuario? Usuario, IActionResult? Accion)> CargaUsuarioAsync(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return (null, NotFound());
        }

        try
        {
            var usuario = await usuarios.GetAsync(id);
            return usuario is null ? (null, NotFound()) : (usuario, null);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            return (null, RedirectToAction("Salir", "Auth"));
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Forbidden)
        {
            return (null, RedirectToAction("AccessDenied", "Home"));
        }
        catch (HttpRequestException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
        {
            return (null, NotFound());
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Could not load user (status {Status}).", (int?)ex.StatusCode);
            return (null, RedirectToAction("Error", "Home"));
        }
    }

    /// <summary>Fills <c>ViewBag.Roles</c>; returns a redirect on expired session (PDF fix #8).</summary>
    private async Task<IActionResult?> RolesDropDownListAsync(string? seleccionado = null)
    {
        List<Rol> lista;
        try
        {
            lista = await roles.GetAsync();
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
            logger.LogWarning(ex, "Could not load roles (status {Status}).", (int?)ex.StatusCode);
            ModelState.AddModelError(string.Empty, "No fue posible obtener la lista de roles.");
            lista = [];
        }

        ViewBag.Roles = new SelectList(lista, nameof(Rol.Nombre), nameof(Rol.Nombre), seleccionado);
        return null;
    }
}
