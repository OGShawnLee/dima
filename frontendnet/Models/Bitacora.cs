using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace frontendnet.Models;

/// <summary>Backend <c>BitacoraDto</c> (<c>GET /api/bitacora</c>). <c>Fecha</c> arrives in UTC.</summary>
public class Bitacora
{
    public const string AccionLoginFallido = "usuario.login.fallido";

    [Display(Name = "Id")]
    public int? BitacoraId { get; set; }

    [Display(Name = "Acción")]
    public string? Accion { get; set; }

    [JsonPropertyName("elementoid")]
    [Display(Name = "Elemento Id")]
    public string? ElementoId { get; set; }

    [Display(Name = "IP")]
    public string? IP { get; set; }

    [Display(Name = "Usuario")]
    public string? Usuario { get; set; }

    [Display(Name = "Fecha")]
    public DateTimeOffset? Fecha { get; set; }
}
