using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>Backend <c>RolDto</c> (<c>GET /api/roles</c>).</summary>
public class Rol
{
    public required string Id { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [Display(Name = "Rol")]
    public required string Nombre { get; set; }
}
