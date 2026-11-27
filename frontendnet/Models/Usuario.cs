using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>
/// Backend <c>UsuarioDto</c> and edit form model. On <c>PUT</c> only <c>nombre</c> and
/// <c>rol</c> are sent; the email comes from the route (never from the form body).
/// </summary>
public class Usuario
{
    [Display(Name = "Id")]
    public string? Id { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [EmailAddress(ErrorMessage = "El campo {0} no es un correo electrónico válido.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Correo electrónico")]
    public required string Email { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Nombre")]
    public required string Nombre { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [Display(Name = "Rol")]
    public required string Rol { get; set; }
}
