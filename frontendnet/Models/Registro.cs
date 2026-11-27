using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>
/// Self-registration form (<c>POST api/auth/registro</c>, backend <c>RegisterRequest</c>).
/// Deliberately has no role or <c>protegido</c> property: the BFF only ever sends
/// <c>{ email, nombre, password }</c> and the backend forces <c>rol = 'Usuario'</c> (DEC-013).
/// </summary>
public class Registro
{
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
    [PasswordPolicy]
    [DataType(DataType.Password)]
    [Display(Name = "Contraseña")]
    public required string Password { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [Compare(nameof(Password), ErrorMessage = "La confirmación no coincide con la contraseña.")]
    [DataType(DataType.Password)]
    [Display(Name = "Confirmar contraseña")]
    public required string ConfirmarPassword { get; set; }
}
