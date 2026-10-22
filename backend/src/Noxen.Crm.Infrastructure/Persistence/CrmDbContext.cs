using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Domain.Outbox;

namespace Noxen.Crm.Infrastructure.Persistence;

public sealed class CrmDbContext(DbContextOptions<CrmDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadStageChange> LeadStageChanges => Set<LeadStageChange>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<ApplicationUser>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(150).IsRequired();
        });

        b.Entity<Lead>(e =>
        {
            e.ToTable("leads");
            e.HasKey(x => x.Id);
            e.Property(x => x.Company).HasMaxLength(200).IsRequired();
            e.Property(x => x.ContactName).HasMaxLength(150);
            e.Property(x => x.Whatsapp).HasMaxLength(30);
            e.Property(x => x.Instagram).HasMaxLength(100);
            e.Property(x => x.Segment).HasMaxLength(100);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.State).HasMaxLength(2).IsFixedLength();
            e.Property(x => x.NextStep).HasMaxLength(300);
            e.Property(x => x.LostReason).HasMaxLength(300);
            e.Property(x => x.EstimatedValue).HasPrecision(14, 2);
            e.Property(x => x.Source).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Stage).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.Stage);
            e.HasIndex(x => x.NextStepDate);
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<LeadStageChange>(e =>
        {
            e.ToTable("lead_stage_changes");
            e.HasKey(x => x.Id);
            e.Property(x => x.FromStage).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.ToStage).HasConversion<string>().HasMaxLength(30);
            e.HasIndex(x => new { x.LeadId, x.ChangedAt });
            e.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Client>(e =>
        {
            e.ToTable("clients");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.LegalName).HasMaxLength(200);
            e.Property(x => x.Cnpj).HasMaxLength(14).IsFixedLength();
            e.Property(x => x.Segment).HasMaxLength(100);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.State).HasMaxLength(2).IsFixedLength();
            e.Property(x => x.ContactName).HasMaxLength(150);
            e.Property(x => x.ContactWhatsapp).HasMaxLength(30);
            e.Property(x => x.Notes).HasMaxLength(4000);
            e.Property(x => x.ImplementationFee).HasPrecision(14, 2);
            e.Property(x => x.MonthlyFee).HasPrecision(14, 2);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Version).IsRowVersion();
            // Unicidade garantida pelo banco: a conversão repetida do mesmo lead não duplica o cliente.
            e.HasIndex(x => x.LeadId).IsUnique().HasFilter("\"LeadId\" IS NOT NULL");
            e.HasIndex(x => x.Cnpj).IsUnique().HasFilter("\"Cnpj\" IS NOT NULL");
            e.HasIndex(x => x.Status);
            e.HasOne<Lead>().WithOne().HasForeignKey<Client>(x => x.LeadId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.ResponsibleId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<OutboxMessage>(e =>
        {
            e.ToTable("outbox_messages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(100).IsRequired();
            e.Property(x => x.Payload).HasColumnType("jsonb").IsRequired();
            e.Property(x => x.LastError).HasMaxLength(500);
            e.HasIndex(x => x.OccurredAt).HasFilter("\"ProcessedAt\" IS NULL");
        });

        b.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
