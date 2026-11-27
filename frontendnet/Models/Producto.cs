using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace frontendnet.Models;

/// <summary>
/// Product as returned by the backend <c>ProductoDto</c>
/// (<c>{ productoId, titulo, descripcion, precio, archivoid, categorias }</c>).
/// Limits mirror <c>CreateProductoRequestSchema</c>; the price range is stricter than the backend's.
/// </summary>
public class Producto
{
    public const double PrecioMinimo = 0.01;
    public const double PrecioMaximo = 9999999;

    [JsonPropertyName("productoId")]
    [Display(Name = "Id")]
    public int? ProductoId { get; set; }

    [JsonPropertyName("titulo")]
    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [StringLength(255, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [Display(Name = "Título")]
    public string Titulo { get; set; } = string.Empty;

    [JsonPropertyName("descripcion")]
    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [StringLength(5000, ErrorMessage = "El campo {0} admite como máximo {1} caracteres.")]
    [DataType(DataType.MultilineText)]
    [Display(Name = "Descripción")]
    public string Descripcion { get; set; } = "Sin descripción";

    /// <summary>
    /// Bound with <see cref="PrecioModelBinder"/> so <c>"."</c> is the decimal separator regardless
    /// of the server culture; serialized to the API as a JSON number.
    /// </summary>
    [JsonPropertyName("precio")]
    [Required(ErrorMessage = "El campo {0} es obligatorio.")]
    [Range(PrecioMinimo, PrecioMaximo, ErrorMessage = "El campo {0} debe estar entre 0.01 y 9999999.")]
    [PrecioFormato]
    [DataType(DataType.Currency)]
    [ModelBinder(typeof(PrecioModelBinder))]
    [Display(Name = "Precio")]
    public decimal? Precio { get; set; }

    /// <summary>Lowercase <c>archivoid</c> is the backend's canonical name (PDF fix #2).</summary>
    [JsonPropertyName("archivoid")]
    [Range(1, int.MaxValue, ErrorMessage = "Seleccione una portada válida.")]
    [Display(Name = "Portada")]
    public int? ArchivoId { get; set; }

    [JsonPropertyName("categorias")]
    [Display(Name = "Categorías")]
    public List<Categoria>? Categorias { get; set; }

    /// <summary>Culture-independent display (e.g. <c>$12,999.00</c>).</summary>
    public static string FormatoPrecio(decimal? precio) =>
        precio is decimal p ? "$" + p.ToString("#,##0.00", CultureInfo.InvariantCulture) : string.Empty;

    /// <summary>Culture-independent value for editable inputs (e.g. <c>12.50</c>).</summary>
    public static string ValorPrecio(decimal? precio) =>
        precio is decimal p ? p.ToString("0.00", CultureInfo.InvariantCulture) : string.Empty;
}

/// <summary>
/// Price format <c>^\d+(\.\d{1,2})?$</c> (escaped dot, PDF fix #9). Validates server-side using
/// the invariant culture and emits the stock unobtrusive <c>regex</c> adapter attributes client-side.
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed partial class PrecioFormatoAttribute : ValidationAttribute, IClientModelValidator
{
    public const string Patron = @"^\d+(\.\d{1,2})?$";

    public const string Mensaje =
        "El campo {0} debe ser un número positivo con hasta dos decimales, usando punto como separador (por ejemplo 1234.50).";

    public PrecioFormatoAttribute() : base(Mensaje)
    {
    }

    public override bool IsValid(object? value) => value switch
    {
        null => true, // [Required]'s job.
        decimal d => PrecioRegex().IsMatch(d.ToString(CultureInfo.InvariantCulture)),
        string s => s.Length == 0 || PrecioRegex().IsMatch(s),
        _ => false,
    };

    public void AddValidation(ClientModelValidationContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        string message = FormatErrorMessage(context.ModelMetadata.GetDisplayName());
        context.Attributes.TryAdd("data-val", "true");
        context.Attributes.TryAdd("data-val-regex", message);
        context.Attributes.TryAdd("data-val-regex-pattern", Patron);
    }

    [GeneratedRegex(Patron, RegexOptions.CultureInvariant)]
    internal static partial Regex PrecioRegex();
}

/// <summary>
/// Culture-safe binder for <see cref="Producto.Precio"/>: accepts only <c>^\d+(\.\d{1,2})?$</c>
/// and parses it with <see cref="CultureInfo.InvariantCulture"/>, so <c>"12.5"</c> binds as 12.5
/// on any server culture and <c>"12,5"</c>, <c>"12.5a"</c>, <c>"-1"</c>, <c>"1.234"</c> are rejected.
/// </summary>
public sealed class PrecioModelBinder : IModelBinder
{
    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        ArgumentNullException.ThrowIfNull(bindingContext);
        string nombre = bindingContext.ModelName;
        var valor = bindingContext.ValueProvider.GetValue(nombre);
        if (valor == ValueProviderResult.None)
        {
            return Task.CompletedTask;
        }

        bindingContext.ModelState.SetModelValue(nombre, valor);
        string texto = (valor.FirstValue ?? string.Empty).Trim();
        if (texto.Length == 0)
        {
            // Let [Required] report the missing value.
            bindingContext.Result = ModelBindingResult.Success(null);
            return Task.CompletedTask;
        }

        if (PrecioFormatoAttribute.PrecioRegex().IsMatch(texto)
            && decimal.TryParse(texto, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out decimal precio))
        {
            bindingContext.Result = ModelBindingResult.Success(precio);
            return Task.CompletedTask;
        }

        bindingContext.ModelState.TryAddModelError(nombre,
            string.Format(CultureInfo.InvariantCulture, PrecioFormatoAttribute.Mensaje,
                bindingContext.ModelMetadata.GetDisplayName()));
        bindingContext.Result = ModelBindingResult.Failed();
        return Task.CompletedTask;
    }
}
