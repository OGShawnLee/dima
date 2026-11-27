using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace frontendnet.Models;

/// <summary>File metadata returned by the backend (<c>ArchivoMetadataDto</c>).</summary>
public class Archivo
{
    [JsonPropertyName("archivoId")]
    [Display(Name = "Id")]
    public int? ArchivoId { get; set; }

    [JsonPropertyName("mime")]
    [Display(Name = "MIME")]
    public string? Mime { get; set; }

    [JsonPropertyName("nombre")]
    [Display(Name = "Nombre")]
    public string? Nombre { get; set; }

    [JsonPropertyName("size")]
    [Display(Name = "Tamaño")]
    public int? Size { get; set; }

    [JsonPropertyName("indb")]
    [Display(Name = "Repositorio")]
    public bool InDb { get; set; } = true;
}
