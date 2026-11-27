using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>
/// Category as returned by the backend <c>CategoriaDto</c> (<c>{ categoriaId, nombre, protegida }</c>).
/// Limits mirror the backend <c>CreateCategoriaRequestSchema</c> (<c>trim().min(1).max(255)</c>).
/// </summary>
public class Categoria
{
    [Display(Name = "Id")]
    public int? CategoriaId { get; set; }

    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Nombre")]
    public required string Nombre { get; set; }

    [Display(Name = "Protegida")]
    public bool Protegida { get; set; } = false;
}
