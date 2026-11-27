using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.ViewFeatures;

namespace frontendnet.Filters;

/// <summary>
/// Global safety net for backend failures that a controller did not handle itself (F009).
/// Controllers keep their own try/catch mappings (verified in F001–F007); exceptions they catch
/// never reach this filter. What still escapes is mapped as follows:
/// <list type="bullet">
/// <item>Client abort (<c>RequestAborted</c> fired): nothing is rendered and nothing is logged as an error.</item>
/// <item><see cref="HttpRequestException"/> <c>401</c> → <c>/Auth/Salir</c>; <c>403</c> → <c>/Home/AccessDenied</c>.</item>
/// <item>Timeouts (<see cref="TaskCanceledException"/>), connection failures (<see cref="HttpRequestException"/>
/// without status) and any other backend status → Spanish error page with <c>503</c>.</item>
/// </list>
/// Any other exception type is left alone, so genuine bugs still reach the default exception handler.
/// The page never includes exception details; they only go to the server log.
/// </summary>
public sealed class ErrorServicioExceptionFilter(
    IModelMetadataProvider metadataProvider,
    ILogger<ErrorServicioExceptionFilter> logger) : IAsyncExceptionFilter
{
    public const string MensajeServicio = "El servicio no está disponible, inténtelo más tarde.";
    private const string VistaError = "~/Views/Home/Error.cshtml";

    public Task OnExceptionAsync(ExceptionContext context)
    {
        if (context.ExceptionHandled)
        {
            return Task.CompletedTask;
        }

        var http = context.HttpContext;
        string path = http.Request.Path; // Path only: the query string may carry search terms.

        switch (context.Exception)
        {
            // The browser went away: there is nobody to answer and it is not a server error.
            case OperationCanceledException when http.RequestAborted.IsCancellationRequested:
                logger.LogDebug("Request aborted by the client on {Method} {Path}.", http.Request.Method, path);
                context.Result = new StatusCodeResult(StatusCodes.Status499ClientClosedRequest);
                break;

            case HttpRequestException { StatusCode: HttpStatusCode.Unauthorized }:
                logger.LogInformation("Backend answered 401 on {Path}; ending the session.", path);
                context.Result = new RedirectToActionResult("Salir", "Auth", null);
                break;

            case HttpRequestException { StatusCode: HttpStatusCode.Forbidden }:
                logger.LogInformation("Backend answered 403 on {Path}.", path);
                context.Result = new RedirectToActionResult("AccessDenied", "Home", null);
                break;

            // HttpClient.Timeout surfaces as TaskCanceledException with an inner TimeoutException.
            case TaskCanceledException ex:
                logger.LogWarning(ex, "Backend call timed out on {Method} {Path}.", http.Request.Method, path);
                context.Result = PaginaServicio(context);
                break;

            case HttpRequestException ex:
                logger.LogWarning(ex, "Backend call failed on {Method} {Path} (status {Status}, error {Error}).",
                    http.Request.Method, path, (int?)ex.StatusCode, ex.HttpRequestError);
                context.Result = PaginaServicio(context);
                break;

            default:
                return Task.CompletedTask;
        }

        context.ExceptionHandled = true;
        return Task.CompletedTask;
    }

    private ViewResult PaginaServicio(ExceptionContext context)
    {
        var http = context.HttpContext;
        http.Response.Headers.CacheControl = "no-store";
        http.Response.Headers.RetryAfter = "30";

        return new ViewResult
        {
            ViewName = VistaError,
            StatusCode = StatusCodes.Status503ServiceUnavailable,
            ViewData = new ViewDataDictionary(metadataProvider, context.ModelState)
            {
                ["Title"] = "Servicio no disponible",
                ["Mensaje"] = MensajeServicio,
                ["RequestId"] = System.Diagnostics.Activity.Current?.Id ?? http.TraceIdentifier,
            },
        };
    }
}
