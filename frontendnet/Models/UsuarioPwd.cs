using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>Create form model, sent as backend <c>CreateUsuarioRequest</c>.</summary>
public class UsuarioPwd
{
    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [EmailAddress(ErrorMessage = "El campo {0} no es un correo electrónico válido.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Correo electrónico")]
    public required string Email { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [PasswordPolicy]
    [DataType(DataType.Password)]
    [Display(Name = "Contraseña")]
    public required string Password { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Nombre")]
    public required string Nombre { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [Display(Name = "Rol")]
    public required string Rol { get; set; }
}
