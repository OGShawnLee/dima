using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>
/// Login form model. Limits mirror the backend <c>LoginRequestSchema</c>.
/// </summary>
public class Login
{
    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [EmailAddress(ErrorMessage = "El campo {0} no es un correo electrónico válido.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Correo electrónico")]
    public required string Email { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [StringLength(128, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [DataType(DataType.Password)]
    [Display(Name = "Contraseña")]
    public required string Password { get; set; }
}
