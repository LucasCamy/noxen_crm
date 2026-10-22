using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Domain;
using Npgsql;

namespace Noxen.Crm.Api.Common;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public static class Paging
{
    public const int MaxPageSize = 100;
    public const string LikeEscape = "\\";

    public static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, MaxPageSize));

    /// <summary>Padrão para ILIKE com os curingas do usuário escapados.</summary>
    public static string LikePattern(string search)
    {
        var escaped = search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
        return $"%{escaped}%";
    }
}

/// <summary>Traduz exceções esperadas em respostas ProblemDetails com o status HTTP correto.</summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problems, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var (status, title) = exception switch
        {
            DomainException d => (StatusCodes.Status422UnprocessableEntity, d.Message),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict,
                "O registro foi alterado por outra pessoa. Recarregue e tente novamente."),
            DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } } =>
                (StatusCodes.Status409Conflict, "Já existe um registro com esses dados."),
            _ => (0, ""),
        };
        if (status == 0)
        {
            logger.LogError(exception, "Erro não tratado em {Method} {Path}", http.Request.Method, http.Request.Path);
            return false;
        }

        http.Response.StatusCode = status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            Exception = exception,
            ProblemDetails = new ProblemDetails { Status = status, Title = title },
        });
    }
}
