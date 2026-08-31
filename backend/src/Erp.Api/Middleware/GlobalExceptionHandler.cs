using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Erp.Api.Middleware;

// The one place an unhandled exception anywhere in the API ends up. Before this existed,
// an unhandled exception fell through to the framework default — a full stack trace in
// Development, and an undefined bare response in Production. This logs the real exception
// server-side (with a correlation id an operator can grep for) and always returns the same
// sanitized ProblemDetails shape to the client, regardless of what actually broke.
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var correlationId = httpContext.TraceIdentifier;
        _logger.LogError(exception, "Unhandled exception. CorrelationId={CorrelationId} Path={Path}", correlationId, httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Something went wrong on our end.",
            Detail = "The error has been logged. If this keeps happening, contact support and mention this reference.",
            Extensions = { ["correlationId"] = correlationId },
        };

        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
