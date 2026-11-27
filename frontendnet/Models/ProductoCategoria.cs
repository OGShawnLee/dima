using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>Form model for assigning/removing a category to/from a product (M:N link).</summary>
public class ProductoCategoria
{
    [Required(ErrorMessage = "Seleccione una categoría.")]
    [Range(1, int.MaxValue, ErrorMessage = "Seleccione una categoría válida.")]
    [Display(Name = "Categoría")]
    public int? CategoriaId { get; set; }

    [Display(Name = "Nombre")]
    public string? Nombre { get; set; }

    public Producto? Producto { get; set; }
}
