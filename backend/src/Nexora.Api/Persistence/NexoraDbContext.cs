using System.Text.Json;
using Nexora.Modules.Finance.Entities;
using Nexora.Shared.Announcements;
using Nexora.Shared.Common;
using Nexora.Modules.Identity.Entities;
using Nexora.Modules.Company.Entities;
using Nexora.Modules.Onboarding.Entities;
using Nexora.Modules.Payroll.Entities;
using Nexora.Modules.HR.Entities;
using Nexora.Shared.Tenancy;
using Nexora.Modules.Projects.Entities;
using Nexora.Modules.Workflow.Entities;
using Nexora.Shared.Events;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Nexora.Api.Persistence;

public class NexoraDbContext : IdentityDbContext<AppUser, AppRole, Guid>
{
    private readonly ITenantContext _tenant;

    public NexoraDbContext(DbContextOptions<NexoraDbContext> options, ITenantContext tenant) : base(options)
    {
        _tenant = tenant;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<PermissionScope> PermissionScopes => Set<PermissionScope>();
    public DbSet<PermissionScopeRecord> PermissionScopeRecords => Set<PermissionScopeRecord>();
    public DbSet<RoleFieldPermission> RoleFieldPermissions => Set<RoleFieldPermission>();
    public DbSet<ReportAccessGrant> ReportAccessGrants => Set<ReportAccessGrant>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<JobTitle> JobTitles => Set<JobTitle>();
    public DbSet<EmployeeAssignmentHistory> EmployeeAssignmentHistories => Set<EmployeeAssignmentHistory>();
    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();

    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<LeaveBalance> LeaveBalances => Set<LeaveBalance>();
    public DbSet<AttendanceEntry> AttendanceEntries => Set<AttendanceEntry>();
    public DbSet<TimesheetEntry> TimesheetEntries => Set<TimesheetEntry>();
    public DbSet<TenantAttendanceSettings> TenantAttendanceSettings => Set<TenantAttendanceSettings>();

    public DbSet<OnboardingTask> OnboardingTasks => Set<OnboardingTask>();

    public DbSet<FnfCase> FnfCases => Set<FnfCase>();
    public DbSet<FnfClearanceItem> FnfClearanceItems => Set<FnfClearanceItem>();

    public DbSet<SalaryStructure> SalaryStructures => Set<SalaryStructure>();
    public DbSet<SalaryComponent> SalaryComponents => Set<SalaryComponent>();
    public DbSet<PayrollRun> PayrollRuns => Set<PayrollRun>();
    public DbSet<Payslip> Payslips => Set<Payslip>();
    public DbSet<PayslipLine> PayslipLines => Set<PayslipLine>();

    public DbSet<Announcement> Announcements => Set<Announcement>();

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<JournalLine> JournalLines => Set<JournalLine>();
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<VendorBill> VendorBills => Set<VendorBill>();

    public DbSet<WorkflowInstance> WorkflowInstances => Set<WorkflowInstance>();
    public DbSet<WorkflowDecision> WorkflowDecisions => Set<WorkflowDecision>();
    public DbSet<TenantApprovalSettings> TenantApprovalSettings => Set<TenantApprovalSettings>();
    public DbSet<ApprovalChainDefinition> ApprovalChainDefinitions => Set<ApprovalChainDefinition>();
    public DbSet<ApprovalChainStage> ApprovalChainStages => Set<ApprovalChainStage>();

    public DbSet<ReimbursementRequest> ReimbursementRequests => Set<ReimbursementRequest>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<ProjectEntity> Projects => Set<ProjectEntity>();
    public DbSet<ProjectExpense> ProjectExpenses => Set<ProjectExpense>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<ProjectTask> ProjectTasks => Set<ProjectTask>();
    public DbSet<ProjectMilestone> ProjectMilestones => Set<ProjectMilestone>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Every TenantEntity subtype gets the same two defenses applied automatically:
        // (1) a global query filter so a forgotten .Where(tenantId) can't leak another company's rows,
        // (2) a composite index so that filter is actually cheap at scale.
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (!typeof(TenantEntity).IsAssignableFrom(entityType.ClrType)) continue;

            var method = typeof(NexoraDbContext)
                .GetMethod(nameof(ApplyTenantFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                .MakeGenericMethod(entityType.ClrType);
            method.Invoke(this, new object[] { builder });

            // Transient in-memory queue, not a column — see TenantEntity.DomainEvents. Every
            // TenantEntity subtype gets this ignored the same way it gets the filter above.
            builder.Entity(entityType.ClrType).Ignore(nameof(TenantEntity.DomainEvents));
        }

        builder.Entity<Employee>().HasIndex(e => new { e.TenantId, e.WorkEmail }).IsUnique();
        builder.Entity<Employee>().HasIndex(e => new { e.TenantId, e.EmployeeCode }).IsUnique();
        builder.Entity<Tenant>().HasIndex(t => t.Slug).IsUnique();
        builder.Entity<LeaveBalance>().HasIndex(b => new { b.TenantId, b.EmployeeId, b.LeaveTypeId, b.Year }).IsUnique();
        builder.Entity<ProjectMember>().HasIndex(m => new { m.TenantId, m.ProjectId, m.EmployeeId }).IsUnique();
        builder.Entity<PayrollRun>().HasIndex(r => new { r.TenantId, r.PeriodYear, r.PeriodMonth }).IsUnique();
        builder.Entity<Payslip>().HasIndex(p => new { p.TenantId, p.PayrollRunId, p.EmployeeId }).IsUnique();
        builder.Entity<JobTitle>().HasIndex(j => new { j.TenantId, j.Name }).IsUnique();
        builder.Entity<Account>().HasIndex(a => new { a.TenantId, a.Code }).IsUnique();
        builder.Entity<ExchangeRate>().HasIndex(r => new { r.TenantId, r.CurrencyCode, r.EffectiveDate }).IsUnique();
        builder.Entity<PermissionScope>().HasIndex(s => new { s.TenantId, s.RoleId, s.PermissionKey }).IsUnique();
        builder.Entity<RoleFieldPermission>().HasIndex(f => new { f.TenantId, f.RoleId, f.Resource, f.FieldName }).IsUnique();
        builder.Entity<ReportAccessGrant>().HasIndex(g => new { g.TenantId, g.RoleId });
        builder.Entity<ReportAccessGrant>().HasIndex(g => new { g.TenantId, g.UserId, g.ReportKey });
        builder.Entity<TenantApprovalSettings>().HasIndex(s => s.TenantId).IsUnique();
        builder.Entity<ApprovalChainDefinition>().HasIndex(c => new { c.TenantId, c.EntityType, c.ScopeType, c.ScopeKey });
        builder.Entity<ApprovalChainStage>().HasIndex(s => new { s.TenantId, s.ChainDefinitionId, s.StageOrder });
        builder.Entity<VendorBill>().HasIndex(b => new { b.TenantId, b.VendorId, b.BillNumber }).IsUnique();
        builder.Entity<TenantAttendanceSettings>().HasIndex(s => s.TenantId).IsUnique();

        // Login no longer asks which workspace you're in — it looks the account up by email
        // alone and reads the tenant off of it. That only works if email is unique across the
        // whole platform, not just within one tenant, so (unlike role names, which legitimately
        // repeat per tenant — every company has an "Admin" role) Identity's default *global*
        // uniqueness on NormalizedUserName/NormalizedEmail is kept as-is here.
        builder.Entity<AppRole>(b =>
        {
            b.HasIndex(r => r.NormalizedName).IsUnique(false);
            b.HasIndex(r => new { r.TenantId, r.NormalizedName }).IsUnique();
        });
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder builder) where TEntity : TenantEntity
    {
        builder.Entity<TEntity>().HasIndex(nameof(TenantEntity.TenantId), nameof(TenantEntity.IsDeleted));
        builder.Entity<TEntity>().HasQueryFilter(e => e.TenantId == _tenant.TenantId && !e.IsDeleted);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTenantAndTimestamps();
        EnqueueOutboxMessages();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTenantAndTimestamps();
        EnqueueOutboxMessages();
        return base.SaveChangesAsync(cancellationToken);
    }

    // Belt-and-braces: even if a caller forgets to set TenantId on a new row, this forces it
    // onto the authenticated caller's own tenant. Combined with the query filter above,
    // cross-tenant writes and reads both fail closed rather than relying on every call site
    // remembering to scope. The one deliberate exception: platform-tenant code (see
    // PlatformController) provisions a brand-new tenant's rows and sets TenantId explicitly
    // before adding — that's server code we wrote, never client input, so an already-set,
    // non-empty TenantId on a newly Added row is trusted rather than overwritten.
    private void StampTenantAndTimestamps()
    {
        // Outside an authenticated request — migrations, the dev seeder, a future background
        // job — there is no ambient tenant to stamp from. In that case trust whatever TenantId
        // the caller already set explicitly rather than clobbering it with Guid.Empty.
        if (!_tenant.IsResolved) return;

        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.TenantId == Guid.Empty)
                {
                    entry.Entity.TenantId = _tenant.TenantId;
                }
                entry.Entity.CreatedAtUtc = DateTimeOffset.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.TenantId = _tenant.TenantId;
                entry.Entity.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        // AppUser/AppRole carry TenantId too but don't inherit TenantEntity (they inherit
        // Identity's own base classes instead), so they were missed by the loop above —
        // that gap is exactly what let UsersController.Create ship a user with TenantId
        // left at Guid.Empty. Stamped here as well so no future call site can repeat it.
        foreach (var entry in ChangeTracker.Entries<AppUser>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = _tenant.TenantId;
            }
        }
        foreach (var entry in ChangeTracker.Entries<AppRole>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = _tenant.TenantId;
            }
        }
    }

    // Runs after StampTenantAndTimestamps (so entry.Entity.TenantId is already correct) and
    // before base.SaveChanges (so the resulting Outbox rows are part of the exact same
    // transaction as whatever business data the event describes) — that ordering is the
    // entire point of the Outbox pattern: the business write and the event write either both
    // commit or neither does, so a crash between them can't lose the event.
    private void EnqueueOutboxMessages()
    {
        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.Entity.DomainEvents.Count == 0) continue;

            foreach (var domainEvent in entry.Entity.DomainEvents)
            {
                Set<OutboxMessage>().Add(new OutboxMessage
                {
                    TenantId = entry.Entity.TenantId,
                    AggregateId = entry.Entity.Id,
                    EventType = domainEvent.GetType().AssemblyQualifiedName!,
                    PayloadJson = JsonSerializer.Serialize(domainEvent, domainEvent.GetType()),
                    OccurredAtUtc = domainEvent.OccurredAtUtc,
                });
            }
            entry.Entity.ClearDomainEvents();
        }
    }
}
