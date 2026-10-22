using Noxen.Crm.Domain;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Domain.Marketing;

namespace Noxen.Crm.Tests;

public class PaymentRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 22);

    private static Payment NewPayment(DateOnly? due = null) =>
        Payment.Create(Guid.NewGuid(), PaymentKind.Mensalidade, new DateOnly(2026, 10, 17), 1500, due ?? new DateOnly(2026, 10, 10), null, Now);

    [Fact]
    public void Reference_month_is_normalized_to_day_one()
    {
        Assert.Equal(new DateOnly(2026, 10, 1), NewPayment().ReferenceMonth);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void Amount_must_be_positive(decimal amount)
    {
        Assert.Throws<DomainException>(() => Payment.Create(Guid.NewGuid(), PaymentKind.Avulso, Today, amount, Today, null, Now));
    }

    [Fact]
    public void Pending_and_past_due_is_overdue_until_paid()
    {
        var p = NewPayment(new DateOnly(2026, 10, 10));
        Assert.True(p.IsOverdue(Today));
        Assert.False(p.IsOverdue(new DateOnly(2026, 10, 10)));
        p.MarkPaid(Today, Today, Now);
        Assert.False(p.IsOverdue(Today));
    }

    [Fact]
    public void Paying_twice_or_in_the_future_is_rejected()
    {
        var p = NewPayment();
        Assert.Throws<DomainException>(() => p.MarkPaid(Today.AddDays(1), Today, Now));
        p.MarkPaid(Today, Today, Now);
        Assert.Throws<DomainException>(() => p.MarkPaid(Today, Today, Now));
    }

    [Fact]
    public void Paid_cannot_be_cancelled_and_cancelled_cannot_be_paid_or_edited()
    {
        var paid = NewPayment();
        paid.MarkPaid(Today, Today, Now);
        Assert.Throws<DomainException>(() => paid.Cancel(Now));

        var cancelled = NewPayment();
        cancelled.Cancel(Now);
        Assert.Throws<DomainException>(() => cancelled.MarkPaid(Today, Today, Now));
        Assert.Throws<DomainException>(() => cancelled.UpdateDetails(10, Today, null, Now));
        Assert.Throws<DomainException>(() => cancelled.Cancel(Now));
    }
}

public class LedgerRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 22);

    [Fact]
    public void Description_and_positive_amount_are_required()
    {
        Assert.Throws<DomainException>(() => LedgerEntry.Create(LedgerKind.Despesa, Today, " ", null, 10, null, Now));
        Assert.Throws<DomainException>(() => LedgerEntry.Create(LedgerKind.Despesa, Today, "Hospedagem", null, 0, null, Now));
    }

    [Fact]
    public void Lifecycle_previsto_to_realizado_blocks_cancel_and_double_settle()
    {
        var e = LedgerEntry.Create(LedgerKind.Receita, Today, "Projeto avulso", "Projeto", 3000, null, Now);
        Assert.Equal(LedgerStatus.Previsto, e.Status);
        e.Settle(Today, Today, Now);
        Assert.Equal(LedgerStatus.Realizado, e.Status);
        Assert.Throws<DomainException>(() => e.Settle(Today, Today, Now));
        Assert.Throws<DomainException>(() => e.Cancel(Now));
    }

    [Fact]
    public void Cancelled_cannot_be_edited_or_settled()
    {
        var e = LedgerEntry.Create(LedgerKind.Despesa, Today, "Ferramenta", null, 100, null, Now);
        e.Cancel(Now);
        Assert.Throws<DomainException>(() => e.Update(Today, "Outra", null, 50, null, Now));
        Assert.Throws<DomainException>(() => e.Settle(Today, Today, Now));
    }
}

public class MarketingRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 22, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Campaign_end_cannot_precede_start_and_budget_cannot_be_negative()
    {
        var start = new DateOnly(2026, 10, 1);
        Assert.Throws<DomainException>(() => Campaign.Create(Guid.NewGuid(), "Black Friday", null, null, null, start, start.AddDays(-1), 1000, CampaignStatus.Planejada, Now));
        Assert.Throws<DomainException>(() => Campaign.Create(Guid.NewGuid(), "Black Friday", null, null, null, start, null, -1, CampaignStatus.Planejada, Now));
        Assert.Throws<DomainException>(() => Campaign.Create(Guid.NewGuid(), " ", null, null, null, start, null, 1, CampaignStatus.Planejada, Now));
    }

    [Fact]
    public void Result_metrics_are_derived_and_safe_with_zeroes()
    {
        var r = MonthlyResult.Create(Guid.NewGuid(), new DateOnly(2026, 10, 15), 2000, 80, 10, 14000, null, Now);
        Assert.Equal(new DateOnly(2026, 10, 1), r.Month);
        Assert.Equal(25m, r.CostPerLead);
        Assert.Equal(200m, r.CostPerSale);
        Assert.Equal(7m, r.Roas);

        var empty = MonthlyResult.Create(Guid.NewGuid(), new DateOnly(2026, 10, 1), 0, 0, 0, 0, null, Now);
        Assert.Null(empty.CostPerLead);
        Assert.Null(empty.CostPerSale);
        Assert.Null(empty.Roas);
    }

    [Fact]
    public void Meeting_requires_a_subject()
    {
        Assert.Throws<DomainException>(() => ClientMeeting.Create(Guid.NewGuid(), Now, "  ", null, null, null, Now));
    }
}
