using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Infrastructure.Persistence;
using Npgsql;

namespace Noxen.Crm.Infrastructure.Finance;

/// <summary>
/// Gera a mensalidade do mês para cada cliente ativo. Idempotente: o índice único (cliente, mês) para
/// mensalidades garante que duas execuções (ou duas instâncias do Worker) não dupliquem cobranças.
/// </summary>
public sealed class ChargeGenerator(CrmDbContext db, TimeProvider clock)
{
    public async Task<int> GenerateAsync(DateOnly month, CancellationToken ct)
    {
        var first = new DateOnly(month.Year, month.Month, 1);
        var now = clock.GetUtcNow();

        var clients = await db.Clients.AsNoTracking()
            .Where(c => c.Status == ClientStatus.Ativo && c.MonthlyFee > 0)
            .Select(c => new { c.Id, c.MonthlyFee, c.DueDay })
            .ToListAsync(ct);
        var alreadyBilled = (await db.Payments.AsNoTracking()
            .Where(p => p.Kind == PaymentKind.Mensalidade && p.ReferenceMonth == first && p.Status != PaymentStatus.Cancelado)
            .Select(p => p.ClientId)
            .ToListAsync(ct)).ToHashSet();

        var created = 0;
        foreach (var c in clients.Where(c => !alreadyBilled.Contains(c.Id)))
        {
            db.Payments.Add(Payment.Create(c.Id, PaymentKind.Mensalidade, first, c.MonthlyFee,
                new DateOnly(first.Year, first.Month, c.DueDay), null, now));
            created++;
        }
        if (created == 0) return 0;

        try
        {
            await db.SaveChangesAsync(ct);
            return created;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Outra execução gerou as mesmas cobranças ao mesmo tempo: refaz só com o que ainda falta.
            db.ChangeTracker.Clear();
            return await GenerateAsync(month, ct);
        }
    }
}
