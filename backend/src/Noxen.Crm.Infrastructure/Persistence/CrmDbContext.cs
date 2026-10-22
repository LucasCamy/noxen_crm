using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Noxen.Crm.Domain.Clients;
using Noxen.Crm.Domain.Finance;
using Noxen.Crm.Domain.Leads;
using Noxen.Crm.Domain.Marketing;
using Noxen.Crm.Domain.Outbox;
using Noxen.Crm.Domain.Studio;
using Noxen.Crm.Domain.Workspace;

namespace Noxen.Crm.Infrastructure.Persistence;

public sealed class CrmDbContext(DbContextOptions<CrmDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadStageChange> LeadStageChanges => Set<LeadStageChange>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<LedgerEntry> LedgerEntries => Set<LedgerEntry>();
    public DbSet<ClientMeeting> ClientMeetings => Set<ClientMeeting>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<MonthlyResult> MonthlyResults => Set<MonthlyResult>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<Idea> Ideas => Set<Idea>();
    public DbSet<ScriptTemplate> Scripts => Set<ScriptTemplate>();
    public DbSet<ContentItem> Contents => Set<ContentItem>();
    public DbSet<KnowledgeDoc> KnowledgeDocs => Set<KnowledgeDoc>();
    public DbSet<StudioProject> StudioProjects => Set<StudioProject>();
    public DbSet<BrandKit> BrandKits => Set<BrandKit>();
    public DbSet<ReferenceLink> ReferenceLinks => Set<ReferenceLink>();

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

        b.Entity<Payment>(e =>
        {
            e.ToTable("payments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Amount).HasPrecision(14, 2);
            e.Property(x => x.Description).HasMaxLength(300);
            e.Property(x => x.Version).IsRowVersion();
            // Uma mensalidade por cliente e mês: o gerador automático e o cadastro manual não duplicam.
            e.HasIndex(x => new { x.ClientId, x.ReferenceMonth }).IsUnique().HasFilter("\"Kind\" = 'Mensalidade' AND \"Status\" <> 'Cancelado'");
            e.HasIndex(x => x.DueDate);
            e.HasIndex(x => x.Status);
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<LedgerEntry>(e =>
        {
            e.ToTable("ledger_entries");
            e.HasKey(x => x.Id);
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Description).HasMaxLength(300).IsRequired();
            e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.Amount).HasPrecision(14, 2);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.Date);
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<ClientMeeting>(e =>
        {
            e.ToTable("client_meetings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Subject).HasMaxLength(200).IsRequired();
            e.Property(x => x.Notes).HasMaxLength(8000);
            e.Property(x => x.NextSteps).HasMaxLength(4000);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => new { x.ClientId, x.HeldAt });
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Campaign>(e =>
        {
            e.ToTable("campaigns");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Objective).HasMaxLength(500);
            e.Property(x => x.Audience).HasMaxLength(1000);
            e.Property(x => x.Creatives).HasMaxLength(2000);
            e.Property(x => x.Budget).HasPrecision(14, 2);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => new { x.ClientId, x.StartDate });
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<MonthlyResult>(e =>
        {
            e.ToTable("monthly_results");
            e.HasKey(x => x.Id);
            e.Property(x => x.AdSpend).HasPrecision(14, 2);
            e.Property(x => x.Revenue).HasPrecision(14, 2);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.Ignore(x => x.CostPerLead);
            e.Ignore(x => x.CostPerSale);
            e.Ignore(x => x.Roas);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => new { x.ClientId, x.Month }).IsUnique();
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<TaskItem>(e =>
        {
            e.ToTable("tasks");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Notes).HasMaxLength(4000);
            e.Property(x => x.Type).HasMaxLength(60);
            e.Property(x => x.Priority).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => new { x.Status, x.DueDate });
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<Lead>().WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.AssigneeId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Idea>(e =>
        {
            e.ToTable("ideas");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Category).HasMaxLength(100);
            e.Property(x => x.Notes).HasMaxLength(4000);
            e.Property(x => x.NextStep).HasMaxLength(500);
            e.Property(x => x.Priority).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Version).IsRowVersion();
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<ScriptTemplate>(e =>
        {
            e.ToTable("scripts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Stage).HasConversion<string>().HasMaxLength(30);
            e.Property(x => x.Channel).HasMaxLength(100);
            e.Property(x => x.Niche).HasMaxLength(100);
            e.Property(x => x.Usage).HasMaxLength(500);
            e.Property(x => x.Body).HasMaxLength(8000).IsRequired();
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.Stage);
        });

        b.Entity<ContentItem>(e =>
        {
            e.ToTable("contents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Format).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Channel).HasMaxLength(100);
            e.Property(x => x.Objective).HasMaxLength(500);
            e.Property(x => x.Body).HasMaxLength(20000);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => new { x.Status, x.PublishDate });
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<KnowledgeDoc>(e =>
        {
            e.ToTable("knowledge_docs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Body).HasMaxLength(20000).IsRequired();
            e.Property(x => x.Source).HasMaxLength(300);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.SortOrder);
        });

        b.Entity<StudioProject>(e =>
        {
            e.ToTable("studio_projects");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Brief).HasMaxLength(8000);
            e.Property(x => x.VisualDirection).HasMaxLength(4000);
            e.Property(x => x.Storyboard).HasMaxLength(8000);
            e.Property(x => x.Deliverables).HasMaxLength(4000);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.Status);
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<BrandKit>(e =>
        {
            e.ToTable("brand_kits");
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Colors).HasMaxLength(200).IsRequired();
            e.Property(x => x.Fonts).HasMaxLength(500);
            e.Property(x => x.Tone).HasMaxLength(2000);
            e.Property(x => x.Elements).HasMaxLength(2000);
            e.Property(x => x.LogoUrl).HasMaxLength(1000);
            e.Ignore(x => x.ColorList);
            e.Property(x => x.Version).IsRowVersion();
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<ReferenceLink>(e =>
        {
            e.ToTable("reference_links");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Url).HasMaxLength(1000).IsRequired();
            e.Property(x => x.Tags).HasMaxLength(300);
            e.Property(x => x.Note).HasMaxLength(2000);
            e.Property(x => x.Version).IsRowVersion();
            e.HasOne<Client>().WithMany().HasForeignKey(x => x.ClientId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
