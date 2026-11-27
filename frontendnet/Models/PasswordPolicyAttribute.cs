using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace frontendnet.Models;

/// <summary>
/// Strong password policy mirroring the backend <c>StrongPasswordSchema</c> (DEC-014):
/// 12–128 characters with at least one uppercase letter, one lowercase letter, one digit
/// and one symbol (any character outside <c>[A-Za-z0-9]</c>).
/// Validates server-side and emits the stock <c>jquery.validate.unobtrusive</c> <c>regex</c>
/// adapter attributes client-side, so no extra script is required (CSP-friendly).
/// Self-contained and reusable (F005 admin user creation, F007 self-registration).
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter, AllowMultiple = false)]
public sealed partial class PasswordPolicyAttribute : ValidationAttribute, IClientModelValidator
{
    public const int MinimumLength = 12;
    public const int MaximumLength = 128;

    /// <summary>
    /// Single-pattern equivalent of the rules, valid in both .NET and ECMAScript.
    /// The unobtrusive adapter requires the match to span the whole value.
    /// </summary>
    public const string ClientPattern =
        @"^(?=[\s\S]*[A-Z])(?=[\s\S]*[a-z])(?=[\s\S]*[0-9])(?=[\s\S]*[^A-Za-z0-9])[\s\S]{12,128}$";

    private const string DefaultMessage =
        "El campo {0} debe tener entre 12 y 128 caracteres e incluir al menos una letra mayúscula, " +
        "una letra minúscula, un dígito y un símbolo.";

    public PasswordPolicyAttribute() : base(DefaultMessage)
    {
    }

    public override bool IsValid(object? value)
    {
        // Null/empty is [Required]'s job.
        if (value is null)
        {
            return true;
        }

        if (value is not string password)
        {
            return false;
        }

        if (password.Length == 0)
        {
            return true;
        }

        return password.Length is >= MinimumLength and <= MaximumLength
            && UpperRegex().IsMatch(password)
            && LowerRegex().IsMatch(password)
            && DigitRegex().IsMatch(password)
            && SymbolRegex().IsMatch(password);
    }

    public void AddValidation(ClientModelValidationContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        string message = FormatErrorMessage(context.ModelMetadata.GetDisplayName());
        AddIfMissing(context.Attributes, "data-val", "true");
        AddIfMissing(context.Attributes, "data-val-regex", message);
        AddIfMissing(context.Attributes, "data-val-regex-pattern", ClientPattern);
        AddIfMissing(context.Attributes, "maxlength", MaximumLength.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    private static void AddIfMissing(IDictionary<string, string> attributes, string key, string value)
    {
        attributes.TryAdd(key, value);
    }

    [GeneratedRegex("[A-Z]", RegexOptions.CultureInvariant)]
    private static partial Regex UpperRegex();

    [GeneratedRegex("[a-z]", RegexOptions.CultureInvariant)]
    private static partial Regex LowerRegex();

    [GeneratedRegex("[0-9]", RegexOptions.CultureInvariant)]
    private static partial Regex DigitRegex();

    [GeneratedRegex("[^A-Za-z0-9]", RegexOptions.CultureInvariant)]
    private static partial Regex SymbolRegex();
}
