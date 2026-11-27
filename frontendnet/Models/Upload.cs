using System.ComponentModel.DataAnnotations;

namespace frontendnet.Models;

/// <summary>
/// Upload form for <c>Archivos/Crear</c> and <c>Archivos/Editar</c>. The file is posted to the
/// backend as <c>multipart/form-data</c> field <c>file</c>. <see cref="Portada"/> is nullable so the
/// GET of <c>Editar</c> can build the model; <c>[Required]</c> still enforces it on POST.
/// </summary>
public class Upload
{
    [Display(Name = "Id")]
    public int? ArchivoId { get; set; }

    public string? Nombre { get; set; }

    [Required(ErrorMessage = "Seleccione una imagen JPG.")]
    [DataType(DataType.Upload)]
    [Display(Name = "Portada")]
    public IFormFile? Portada { get; set; }
}
